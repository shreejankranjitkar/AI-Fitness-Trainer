
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isCurrentAttempt } from "./generationReliability";
import { v } from "convex/values";

const workoutPlanValidator = v.object({
  schedule: v.array(v.string()),
  exercises: v.array(
    v.object({
      day: v.string(),
      routines: v.array(
        v.object({
          name: v.string(),
          sets: v.optional(v.number()),
          reps: v.optional(v.number()),
          duration: v.optional(v.string()),
          description: v.optional(v.string()),
          exercises: v.optional(v.array(v.string())),
        })
      ),
    })
  ),
});

const dietPlanValidator = v.object({
  dailyCalories: v.number(),
  meals: v.array(
    v.object({
      name: v.string(),
      foods: v.array(v.string()),
    })
  ),
});

export const createPlan = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    workoutPlan: workoutPlanValidator,
    dietPlan: dietPlanValidator,
    isActive: v.boolean(),
  },

  handler: async (ctx, args) => {
    // Deactivate previous active plans for this user.
    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const plan of activePlans) {
      await ctx.db.patch(plan._id, {
        isActive: false,
      });
    }

    // Insert the new plan.
    const planId = await ctx.db.insert("plans", {
      ...args,
      isActive: true,
    });

    return planId;
  },
});

// The plan and generation completion are committed in one transaction. A
// superseded or duplicate attempt cannot deactivate an existing active plan.
export const completeGeneratedPlan = internalMutation({
  args: {
    generationId: v.id("generations"),
    attemptNumber: v.number(),
    name: v.string(),
    workoutPlan: workoutPlanValidator,
    dietPlan: dietPlanValidator,
  },
  handler: async (ctx, args): Promise<{
    committed: boolean;
    planId?: Id<"plans">;
  }> => {
    const generation = await ctx.db.get(args.generationId);
    if (!generation) return { committed: false };

    if (
      generation.status === "completed" &&
      generation.attemptNumber === args.attemptNumber &&
      generation.planId
    ) {
      return { committed: true, planId: generation.planId };
    }

    if (
      !isCurrentAttempt(
        generation.status,
        generation.attemptNumber,
        args.attemptNumber,
      )
    ) {
      return { committed: false };
    }

    const activePlans = await ctx.db
      .query("plans")
      .withIndex("by_user_id", (q) => q.eq("userId", generation.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const plan of activePlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    const planId = await ctx.db.insert("plans", {
      userId: generation.userId,
      name: args.name,
      workoutPlan: args.workoutPlan,
      dietPlan: args.dietPlan,
      isActive: true,
    });

    await ctx.db.patch(args.generationId, {
      status: "completed",
      planId,
      input: undefined,
      retryable: false,
      errorCode: undefined,
      updatedAt: Date.now(),
    });

    return { committed: true, planId };
  },
});

export const archivePlan = mutation({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");

    const profile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    const ownsPlan =
      plan.userId === identity.subject ||
      (profile !== null && plan.userId === String(profile._id));
    if (!ownsPlan) throw new Error("You are not authorized to archive this plan");

    // Treat repeat requests as successful no-ops after verifying ownership.
    if (plan.archivedAt !== undefined) return { archived: true };

    await ctx.db.patch(plan._id, {
      archivedAt: Date.now(),
      isActive: false,
    });

    return { archived: true };
  },
});

export const getUserPlans = query({
  args: {
    userId: v.string(),
  },

  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", args.userId)
      )
      .order("desc")
      .collect();

    return plans.filter((plan) => plan.archivedAt === undefined);
  },
});
