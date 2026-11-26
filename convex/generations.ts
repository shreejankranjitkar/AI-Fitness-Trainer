import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  GENERATION_INPUT_RETENTION_MS,
  GENERATION_STALE_AFTER_MS,
  isGenerationOwner,
  isRetryableGenerationFailure,
  isStaleGeneration,
} from "./generationReliability";

const fitnessInputValidator = v.object({
  age: v.number(),
  height: v.optional(v.string()),
  weight: v.optional(v.string()),
  injuries: v.string(),
  workout_days: v.number(),
  fitness_goal: v.string(),
  fitness_level: v.string(),
  dietary_restrictions: v.optional(v.string()),
});

const errorCodeValidator = v.union(
  v.literal("temporarily_unavailable"),
  v.literal("invalid_response"),
  v.literal("configuration"),
  v.literal("generation_failed"),
);

const activeStatuses = ["queued", "generating"] as const;

// Queue one generation per user at a time. Vapi's signed one-use ticket remains
// required for initial requests; retries use the authenticated mutation below.
export const queueGeneration = internalMutation({
  args: {
    userId: v.string(),
    ...fitnessInputValidator.fields,
    ticketId: v.string(),
    ticketExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    validateGenerationInput(args, now);

    const consumedTicket = await ctx.db
      .query("generationTickets")
      .withIndex("by_ticket_id", (q) => q.eq("ticketId", args.ticketId))
      .first();
    if (consumedTicket) throw new Error("Generation ticket has already been used.");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();
    if (!user) throw new Error("The authenticated profile could not be found.");

    const active = await getActiveGenerations(ctx, args.userId);
    const current: Doc<"generations">[] = [];
    for (const generation of active) {
      if (isStaleGeneration(generation.status, generation.updatedAt, now)) {
        await markStaleGeneration(ctx, generation, now);
      } else {
        current.push(generation);
      }
    }

    if (current.length > 0) {
      const existing = current.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      await consumeTicket(ctx, args.ticketId, args.ticketExpiresAt, existing._id, now);
      return existing._id;
    }

    await ctx.db.patch(user._id, {
      age: args.age,
      fitnessLevel: args.fitness_level.trim(),
      fitnessGoal: args.fitness_goal.trim(),
      ...(args.height?.trim() ? { height: args.height.trim() } : {}),
      ...(args.weight?.trim() ? { weight: args.weight.trim() } : {}),
      ...(args.dietary_restrictions?.trim()
        ? { dietaryRestrictions: args.dietary_restrictions.trim() }
        : {}),
    });

    const inputExpiresAt = now + GENERATION_INPUT_RETENTION_MS;
    const input = {
      age: args.age,
      ...(args.height ? { height: args.height.trim() } : {}),
      ...(args.weight ? { weight: args.weight.trim() } : {}),
      injuries: args.injuries.trim(),
      workout_days: args.workout_days,
      fitness_goal: args.fitness_goal.trim(),
      fitness_level: args.fitness_level.trim(),
      ...(args.dietary_restrictions
        ? { dietary_restrictions: args.dietary_restrictions.trim() }
        : {}),
    };

    const generationId = await ctx.db.insert("generations", {
      userId: args.userId,
      status: "queued",
      input,
      inputExpiresAt,
      retryable: false,
      attemptNumber: 0,
      createdAt: now,
      updatedAt: now,
    });

    await consumeTicket(ctx, args.ticketId, args.ticketExpiresAt, generationId, now);
    await ctx.scheduler.runAfter(0, internal.fitnessActions.generateProgram, {
      generationId,
    });
    await ctx.scheduler.runAt(
      inputExpiresAt,
      internal.generations.expireGenerationInput,
      { generationId, inputExpiresAt },
    );

    return generationId;
  },
});

function validateGenerationInput(
  args: {
    ticketId: string;
    ticketExpiresAt: number;
    age: number;
    workout_days: number;
    fitness_goal: string;
    fitness_level: string;
    injuries: string;
  },
  now: number,
) {
  if (
    !args.ticketId.trim() ||
    args.ticketExpiresAt <= now ||
    args.ticketExpiresAt > now + 5 * 60 * 1000 + 30_000 ||
    !Number.isInteger(args.age) ||
    args.age <= 0 ||
    args.age > 120 ||
    !Number.isInteger(args.workout_days) ||
    args.workout_days < 1 ||
    args.workout_days > 7 ||
    !args.fitness_goal.trim() ||
    !args.fitness_level.trim() ||
    !args.injuries.trim()
  ) {
    throw new Error("Invalid generation request.");
  }
}

async function getActiveGenerations(ctx: MutationCtx, userId: string) {
  const queued = await ctx.db
    .query("generations")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "queued"),
    )
    .collect();
  const generating = await ctx.db
    .query("generations")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "generating"),
    )
    .collect();
  return [...queued, ...generating];
}

async function consumeTicket(
  ctx: MutationCtx,
  ticketId: string,
  ticketExpiresAt: number,
  generationId: Doc<"generations">["_id"],
  now: number,
) {
  await ctx.db.insert("generationTickets", {
    ticketId,
    expiresAt: ticketExpiresAt,
    consumedAt: now,
    generationId,
  });
  await ctx.scheduler.runAt(
    ticketExpiresAt + 24 * 60 * 60 * 1000,
    internal.generations.cleanupGenerationTicket,
    { ticketId },
  );
}

async function markStaleGeneration(
  ctx: MutationCtx,
  generation: Doc<"generations">,
  now: number,
) {
  const canRetry = isRetryableGenerationFailure(
    "failed",
    true,
    Boolean(generation.input),
    generation.inputExpiresAt,
    now,
  );
  await ctx.db.patch(generation._id, {
    status: "failed",
    attemptNumber: (generation.attemptNumber ?? 0) + 1,
    errorCode: "temporarily_unavailable",
    retryable: canRetry,
    updatedAt: now,
    ...(!canRetry ? { input: undefined } : {}),
  });
}

export const cleanupGenerationTicket = internalMutation({
  args: { ticketId: v.string() },
  handler: async (ctx, { ticketId }) => {
    const ticket = await ctx.db
      .query("generationTickets")
      .withIndex("by_ticket_id", (q) => q.eq("ticketId", ticketId))
      .first();
    if (ticket && ticket.expiresAt + 24 * 60 * 60 * 1000 <= Date.now()) {
      await ctx.db.delete(ticket._id);
    }
  },
});

export const expireGenerationInput = internalMutation({
  args: {
    generationId: v.id("generations"),
    inputExpiresAt: v.number(),
  },
  handler: async (ctx, { generationId, inputExpiresAt }) => {
    const generation = await ctx.db.get(generationId);
    if (!generation || generation.inputExpiresAt !== inputExpiresAt) return;
    if (inputExpiresAt > Date.now()) return;

    await ctx.db.patch(generationId, {
      input: undefined,
      retryable: false,
      ...(generation.status === "queued" || generation.status === "generating"
        ? {
            status: "failed" as const,
            attemptNumber: (generation.attemptNumber ?? 0) + 1,
            errorCode: "temporarily_unavailable" as const,
          }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

// Public status is identity-scoped and never includes the private retry snapshot.
export const getLatestGeneration = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    const generation = await ctx.db
      .query("generations")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    if (!generation) return null;

    const now = Date.now();
    return {
      _id: generation._id,
      status: generation.status,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
      errorCode: generation.errorCode,
      canRetry: isRetryableGenerationFailure(
        generation.status,
        generation.retryable,
        Boolean(generation.input),
        generation.inputExpiresAt,
        now,
      ),
      isStale:
        (generation.status === "queued" || generation.status === "generating") &&
        now - generation.updatedAt >= GENERATION_STALE_AFTER_MS,
    };
  },
});

// Recover jobs whose scheduled action never started or stopped before recording
// its result. Attempt number invalidation prevents late actions from committing.
export const recoverStaleGeneration = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    const now = Date.now();
    const active = await getActiveGenerations(ctx, identity.subject);
    for (const generation of active) {
      if (isStaleGeneration(generation.status, generation.updatedAt, now)) {
        await markStaleGeneration(ctx, generation, now);
      }
    }
    return { recovered: active.some((generation) =>
      isStaleGeneration(generation.status, generation.updatedAt, now),
    ) };
  },
});

export const retryGeneration = mutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, { generationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Unauthenticated");

    const generation = await ctx.db.get(generationId);
    if (!generation || !isGenerationOwner(generation.userId, identity.subject)) {
      throw new Error("Generation not found.");
    }

    const now = Date.now();
    if (generation.status === "queued" || generation.status === "generating") {
      if (isStaleGeneration(generation.status, generation.updatedAt, now)) {
        await markStaleGeneration(ctx, generation, now);
        return { status: "expired_attempt" as const };
      }
      return { status: "in_progress" as const };
    }
    if (generation.status !== "failed") return { status: "unavailable" as const };

    const canRetry = isRetryableGenerationFailure(
      generation.status,
      generation.retryable,
      Boolean(generation.input),
      generation.inputExpiresAt,
      now,
    );
    if (!canRetry) {
      if (generation.input) {
        await ctx.db.patch(generationId, {
          input: undefined,
          retryable: false,
        });
      }
      return { status: "unavailable" as const };
    }

    await ctx.db.patch(generationId, {
      status: "queued",
      retryable: false,
      errorCode: undefined,
      attemptNumber: generation.attemptNumber ?? 0,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.fitnessActions.generateProgram, {
      generationId,
    });
    return { status: "queued" as const };
  },
});

export const claimGeneration = internalMutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, { generationId }) => {
    const generation = await ctx.db.get(generationId);
    if (!generation || generation.status !== "queued") return null;

    const now = Date.now();
    if (
      !generation.input ||
      generation.inputExpiresAt === undefined ||
      generation.inputExpiresAt <= now
    ) {
      await ctx.db.patch(generationId, {
        status: "failed",
        input: undefined,
        retryable: false,
        errorCode: "generation_failed",
        updatedAt: now,
      });
      return null;
    }

    const attemptNumber = (generation.attemptNumber ?? 0) + 1;
    await ctx.db.patch(generationId, {
      status: "generating",
      attemptNumber,
      updatedAt: now,
      retryable: false,
      errorCode: undefined,
    });

    return {
      userId: generation.userId,
      input: generation.input,
      attemptNumber,
    };
  },
});

export const failGenerationAttempt = internalMutation({
  args: {
    generationId: v.id("generations"),
    attemptNumber: v.number(),
    errorCode: errorCodeValidator,
    retryable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId);
    if (
      !generation ||
      generation.status !== "generating" ||
      generation.attemptNumber !== args.attemptNumber
    ) {
      return { updated: false };
    }

    const now = Date.now();
    const canRetry = isRetryableGenerationFailure(
      "failed",
      args.retryable,
      Boolean(generation.input),
      generation.inputExpiresAt,
      now,
    );
    await ctx.db.patch(args.generationId, {
      status: "failed",
      errorCode: args.errorCode,
      retryable: canRetry,
      updatedAt: now,
      ...(!canRetry ? { input: undefined } : {}),
    });
    return { updated: true };
  },
});
