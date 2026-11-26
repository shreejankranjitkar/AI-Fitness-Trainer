
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const generationInputValidator = v.object({
  age: v.number(),
  height: v.optional(v.string()),
  weight: v.optional(v.string()),
  injuries: v.string(),
  workout_days: v.number(),
  fitness_goal: v.string(),
  fitness_level: v.string(),
  dietary_restrictions: v.optional(v.string()),
});

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    clerkId: v.string(),
    age: v.optional(v.number()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    fitnessLevel: v.optional(v.string()),
    fitnessGoal: v.optional(v.string()),
    dietaryRestrictions: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  plans: defineTable({
    userId: v.string(),
    name: v.string(),

    workoutPlan: v.object({
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
    }),

    dietPlan: v.object({
      dailyCalories: v.number(),
      meals: v.array(
        v.object({
          name: v.string(),
          foods: v.array(v.string()),
        })
      ),
    }),

    isActive: v.boolean(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_active", ["isActive"]),

  workoutChecklist: defineTable({
    userId: v.string(),
    planId: v.id("plans"),
    scheduledWorkoutId: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_plan_day", ["userId", "planId", "scheduledWorkoutId"])
    .index("by_user_plan", ["userId", "planId"]),

  generations: defineTable({
    userId: v.string(),

    status: v.union(
      v.literal("queued"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),

    planId: v.optional(v.id("plans")),
    errorCode: v.optional(
      v.union(
        v.literal("temporarily_unavailable"),
        v.literal("invalid_response"),
        v.literal("configuration"),
        v.literal("generation_failed"),
      ),
    ),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    input: v.optional(generationInputValidator),
    inputExpiresAt: v.optional(v.number()),
    attemptNumber: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  generationTickets: defineTable({
    ticketId: v.string(),
    expiresAt: v.number(),
    consumedAt: v.number(),
    generationId: v.id("generations"),
  })
    .index("by_ticket_id", ["ticketId"])
    .index("by_expiration", ["expiresAt"]),
});
