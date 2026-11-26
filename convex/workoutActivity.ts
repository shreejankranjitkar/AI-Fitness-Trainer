import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

function normalizeWeekday(value: string): Weekday | undefined {
  return WEEKDAYS.find((day) => day.toLowerCase() === value.trim().toLowerCase());
}

async function getAuthenticatedActivePlan(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"plans">,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Unauthenticated");

  const plans = await ctx.db
    .query("plans")
    .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
    .order("desc")
    .collect();
  const eligiblePlans = plans.filter((plan) => plan.archivedAt === undefined);
  const activePlan = eligiblePlans.find((plan) => plan.isActive) ?? eligiblePlans[0];

  if (!activePlan || activePlan._id !== planId || activePlan.userId !== identity.subject) {
    throw new Error("The requested plan is not your active plan");
  }

  return { identity, activePlan };
}

export const getActivePlanChecklist = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const { identity, activePlan } = await getAuthenticatedActivePlan(ctx, args.planId);
    const scheduledDays = new Set(
      activePlan.workoutPlan.schedule
        .map(normalizeWeekday)
        .filter((day): day is Weekday => day !== undefined),
    );

    const records = await ctx.db
      .query("workoutChecklist")
      .withIndex("by_user_plan", (q) =>
        q.eq("userId", identity.subject).eq("planId", activePlan._id),
      )
      .collect();
    const recordsByDay = new Map(
      records.map((record) => [record.scheduledWorkoutId, record]),
    );

    return {
      days: WEEKDAYS.filter((day) => scheduledDays.has(day)).map((day) => {
        const record = recordsByDay.get(day.toLowerCase());
        const routines = activePlan.workoutPlan.exercises
          .filter((dayPlan) => normalizeWeekday(dayPlan.day) === day)
          .flatMap((dayPlan) => dayPlan.routines.map((routine) => routine.name));

        return {
          id: day.toLowerCase(),
          day,
          routines,
          completed: record?.completed ?? false,
          completedAt: record?.completedAt,
        };
      }),
    };
  },
});

export const getProfileWorkoutStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    // Match the dashboard/checklist plan selection: active plan, otherwise newest plan.
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
    const eligiblePlans = plans.filter((plan) => plan.archivedAt === undefined);
    const activePlan = eligiblePlans.find((plan) => plan.isActive) ?? eligiblePlans[0];
    const plansById = new Map(
      plans.map((plan) => [
        plan._id,
        new Set(
          plan.workoutPlan.schedule
            .map(normalizeWeekday)
            .filter((day): day is Weekday => day !== undefined)
            .map((day) => day.toLowerCase()),
        ),
      ]),
    );

    const checklistRecords = await ctx.db
      .query("workoutChecklist")
      .withIndex("by_user_plan", (q) => q.eq("userId", identity.subject))
      .collect();

    // Validate each completed row against its owning plan's actual schedule. Deduplicate
    // by plan and weekday so stale/duplicate records cannot inflate the statistics.
    const completedByPlanDay = new Map<
      string,
      { planId: (typeof plans)[number]["_id"]; scheduledWorkoutId: string; completedAt?: number }
    >();
    for (const record of checklistRecords) {
      if (!record.completed) continue;
      const day = normalizeWeekday(record.scheduledWorkoutId)?.toLowerCase();
      const scheduledDays = plansById.get(record.planId);
      if (!day || !scheduledDays?.has(day)) continue;

      const key = `${record.planId}:${day}`;
      const existing = completedByPlanDay.get(key);
      if (!existing || (record.completedAt ?? 0) > (existing.completedAt ?? 0)) {
        completedByPlanDay.set(key, {
          planId: record.planId,
          scheduledWorkoutId: day,
          completedAt: record.completedAt,
        });
      }
    }

    const activeScheduledWorkoutIds = activePlan
      ? [...(plansById.get(activePlan._id) ?? [])]
      : [];
    const activeCompletedWorkoutIds = activePlan
      ? [...completedByPlanDay.values()]
          .filter((record) => record.planId === activePlan._id)
          .map((record) => record.scheduledWorkoutId)
      : [];

    return {
      activeScheduledWorkoutIds,
      activeCompletedWorkoutIds,
      completedWorkouts: [...completedByPlanDay.values()].map((record) => ({
        planId: record.planId,
        scheduledWorkoutId: record.scheduledWorkoutId,
        completedAt: record.completedAt ?? null,
      })),
    };
  },
});

export const setWorkoutCompleted = mutation({
  args: {
    planId: v.id("plans"),
    scheduledWorkoutId: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity, activePlan } = await getAuthenticatedActivePlan(ctx, args.planId);
    const day = normalizeWeekday(args.scheduledWorkoutId);
    if (!day || !activePlan.workoutPlan.schedule.some((item) => normalizeWeekday(item) === day)) {
      throw new Error("That day is not scheduled in your active plan");
    }

    const scheduledWorkoutId = day.toLowerCase();
    const existing = await ctx.db
      .query("workoutChecklist")
      .withIndex("by_user_plan_day", (q) =>
        q
          .eq("userId", identity.subject)
          .eq("planId", activePlan._id)
          .eq("scheduledWorkoutId", scheduledWorkoutId),
      )
      .unique();
    const now = Date.now();

    if (existing) {
      if (existing.completed !== args.completed) {
        await ctx.db.patch(existing._id, {
          completed: args.completed,
          completedAt: args.completed ? now : undefined,
          updatedAt: now,
        });
      }
      return;
    }

    // A pending day needs no stored record. The first check creates its durable state.
    if (args.completed) {
      await ctx.db.insert("workoutChecklist", {
        userId: identity.subject,
        planId: activePlan._id,
        scheduledWorkoutId,
        completed: true,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
