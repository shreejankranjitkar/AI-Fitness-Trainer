"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
} from "@google/generative-ai";
import Groq from "groq-sdk";
import {
  classifyGroqError,
  classifyGeminiError,
  getGroqRetryDelayMs,
  getGroqRequestOptions,
  getBoundedRequestTimeoutMs,
  GEMINI_REQUEST_TIMEOUT_MS,
  GENERATION_DEADLINE_MS,
  getGenerationModelPriority,
  isGroqFallbackConfigured,
  getProviderRetryDelayMs,
  getRemainingGenerationBudgetMs,
  getRetryDelayMs,
  isRetryDelayWithinDeadline,
  shouldAttemptProviderModel,
  minimizeWorkoutPromptForGroq,
  MAX_ATTEMPTS_PER_MODEL,
  isDietOutputSafe,
  isWorkoutOutputSafe,
  type GenerationErrorCode,
} from "./generationReliability";

// ==========================================
// FITNESS PROGRAM GENERATION
// ==========================================

export const generateProgram = internalAction({
  args: {
    generationId: v.id("generations"),
  },

  handler: async (ctx, actionArgs): Promise<
    | { success: true; planId: Id<"plans"> }
    | { success: false; errorCode: GenerationErrorCode | "stale_attempt" }
  > => {
    const deadlineAt = Date.now() + GENERATION_DEADLINE_MS;
    const claimed = await ctx.runMutation(
      internal.generations.claimGeneration,
      { generationId: actionArgs.generationId },
    );
    if (!claimed) return { success: false, errorCode: "stale_attempt" };

    const args = {
      generationId: actionArgs.generationId,
      userId: claimed.userId,
      ...claimed.input,
      attemptNumber: claimed.attemptNumber,
    };

    try {
      // Provider keys remain server-only. No Vapi transcript or account identity
      // is passed to either provider; only the generation fields below enter prompts.
      const geminiKey = process.env.GEMINI_API_KEY;
      const groqApiKey = process.env.GROQ_API_KEY;
      const groqFallbackEnabled = isGroqFallbackConfigured(
        process.env.GROQ_FALLBACK_ENABLED,
        groqApiKey,
      );
      const groqKey = groqFallbackEnabled ? groqApiKey?.trim() : undefined;
      const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
      const groq = groqKey
        ? new Groq({
            apiKey: groqKey,
            ...getGroqRequestOptions(GEMINI_REQUEST_TIMEOUT_MS),
          })
        : null;
      const modelState: GenerationProviderState = {
        unavailableModels: new Set(),
        unavailableProviders: new Set(),
        sawRetryableFailure: false,
        sawInvalidResponse: false,
      };

      const safeHeight = args.height || "Not provided";
      const safeWeight = args.weight || "Not provided";

      // ==========================================
      // GENERATE WORKOUT PLAN
      // ==========================================

      const workoutPrompt = `
You are a professional fitness program generator.

Create a safe, realistic, personalized weekly workout plan.

USER INFORMATION:
Age: ${args.age}
Height: ${safeHeight}
Weight: ${safeWeight}
Injuries or limitations: ${args.injuries}
Workout days per week: ${args.workout_days}
Fitness goal: ${args.fitness_goal}
Fitness level: ${args.fitness_level}

REQUIREMENTS:
- Create exactly ${args.workout_days} workout days.
- The schedule must contain exactly ${args.workout_days} unique days.
- The exercises array must contain exactly ${args.workout_days} entries.
- Each exercise entry must correspond to one day in the schedule.
- Use realistic exercises suitable for the user's fitness level.
- Respect all reported injuries and physical limitations.
- Include appropriate sets and repetitions.
- Do not prescribe dangerous or extreme exercises.
- Include appropriate recovery days.
- Make the schedule realistic and easy to follow.
- Do not add extra workout days.

Return ONLY valid JSON in this structure:

{
  "schedule": [
    "Monday",
    "Tuesday",
    "Thursday",
    "Friday",
    "Saturday"
  ],
  "exercises": [
    {
      "day": "Monday",
      "routines": [
        {
          "name": "Bodyweight Squats",
          "sets": 3,
          "reps": 12,
          "description": "Perform controlled bodyweight squats."
        }
      ]
    }
  ]
}

The example is illustrative. Generate exactly the requested number of days.

Return no Markdown, comments, or additional text.
`;

      console.log("Starting workout plan generation...");

      const workoutPlan = await generateWithFallback(
        genAI,
        groq,
        groqFallbackEnabled,
        workoutPrompt,
        modelState,
        deadlineAt,
        minimizeWorkoutPromptForGroq(workoutPrompt),
        (value) => {
          const plan = validateWorkoutPlan(value);
          if (!isWorkoutOutputSafe(plan, {
            requestedDays: args.workout_days,
            injuries: args.injuries,
            fitnessLevel: args.fitness_level,
          })) {
            throw new InvalidModelOutputError();
          }
          return plan;
        },
        WORKOUT_RESPONSE_FORMAT,
      );

      console.log("Workout plan generated successfully.");

      // ==========================================
      // GENERATE DIET PLAN
      // ==========================================

      const dietPrompt = `
You are a professional nutrition planning assistant.

Create a simple, realistic diet framework.

USER INFORMATION:
Age: ${args.age}
Height: ${safeHeight}
Weight: ${safeWeight}
Fitness goal: ${args.fitness_goal}
Fitness level: ${args.fitness_level}
        Dietary restrictions: ${args.dietary_restrictions || "Not provided"}

REQUIREMENTS:
- Respect dietary restrictions and allergies.
- Suggest realistic and affordable food options.
- Avoid extreme calorie restrictions.
- Provide balanced meals.
- Include suitable protein sources.
- Do not invent missing height or weight.
- Do not recommend extreme calorie deficits.
- Use reasonable calorie estimates only when sufficient information exists.
- Otherwise provide a balanced portion-based approach.
- Include breakfast, lunch, dinner, and suitable snacks.

Return ONLY valid JSON in this exact structure:

{
  "dailyCalories": 2200,
  "meals": [
    {
      "name": "Breakfast",
      "foods": [
        "Oatmeal",
        "Eggs",
        "Banana"
      ]
    },
    {
      "name": "Lunch",
      "foods": [
        "Rice",
        "Lentils",
        "Vegetables"
      ]
    },
    {
      "name": "Dinner",
      "foods": [
        "Rice",
        "Chicken",
        "Vegetables"
      ]
    }
  ]
}

Return no Markdown, comments, or additional text.
`;

      console.log("Starting diet plan generation...");

      const dietPlan = await generateWithFallback(
        genAI,
        groq,
        groqFallbackEnabled,
        dietPrompt,
        modelState,
        deadlineAt,
        dietPrompt,
        (value) => {
          const plan = validateDietPlan(value);
          if (!isDietOutputSafe(plan, {
            dietaryRestrictions: args.dietary_restrictions || "",
          })) {
            throw new InvalidModelOutputError();
          }
          return plan;
        },
        DIET_RESPONSE_FORMAT,
      );

      console.log("Diet plan generated successfully.");

      // ==========================================
      // SAVE FITNESS PLAN
      // ==========================================

      const completed = await ctx.runMutation(
        internal.plans.completeGeneratedPlan,
        {
          generationId: args.generationId,
          attemptNumber: args.attemptNumber,
        name: `${args.fitness_goal} Plan`,
        workoutPlan,
        dietPlan,
        },
      );

      if (!completed.committed || !completed.planId) {
        return { success: false, errorCode: "stale_attempt" };
      }

      console.log("Fitness plan generation completed.");

      return {
        success: true,
        planId: completed.planId,
      };
    } catch (error) {
      const failure =
        error instanceof GenerationFailure
          ? error
          : classifyFailure(error);

      console.error("Fitness generation failed.", {
        errorCode: failure.errorCode,
        retryable: failure.retryable,
      });

      try {
        await ctx.runMutation(internal.generations.failGenerationAttempt, {
          generationId: args.generationId,
          attemptNumber: args.attemptNumber,
          errorCode: failure.errorCode,
          retryable: failure.retryable,
        });
      } catch {
        console.error("Could not persist generation failure status.");
      }

      return { success: false, errorCode: failure.errorCode };
    }
  },
});

// ==========================================
// PROVIDER FALLBACK + RETRY
// ==========================================

async function generateWithFallback(
  genAI: GoogleGenerativeAI | null,
  groq: Groq | null,
  groqFallbackEnabled: boolean,
  prompt: string,
  modelState: GenerationProviderState,
  deadlineAt: number,
  groqPrompt: string,
  validate: (value: unknown) => unknown,
  groqResponseFormat: typeof WORKOUT_RESPONSE_FORMAT | typeof DIET_RESPONSE_FORMAT,
): Promise<any> {
  const models = getGenerationModelPriority(groqFallbackEnabled);
  let lastFailure: GenerationFailure | undefined;
  let hadRetryableFailure = false;

  for (const candidate of models) {
    ensureTimeRemaining(deadlineAt);
    const modelName = candidate.model;
    if (!shouldAttemptProviderModel(
      candidate.provider,
      modelName,
      modelState.unavailableProviders,
      modelState.unavailableModels,
    )) {
      continue;
    }

    const providerConfigured = candidate.provider === "gemini" ? Boolean(genAI) : Boolean(groq);
    if (!providerConfigured) {
      lastFailure = new GenerationFailure("configuration", false);
      if (candidate.provider === "gemini" || groqFallbackEnabled) {
        modelState.unavailableProviders.add(candidate.provider);
      }
      continue;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      ensureTimeRemaining(deadlineAt);
      try {
        const requestTimeout = getBoundedRequestTimeoutMs(deadlineAt, Date.now());
        if (requestTimeout <= 0) ensureTimeRemaining(deadlineAt);
        const responseText = candidate.provider === "gemini"
          ? await generateGeminiContent(genAI!, modelName, prompt, requestTimeout)
          : await generateGroqContent(groq!, groqPrompt, requestTimeout, groqResponseFormat);
        ensureTimeRemaining(deadlineAt);
        if (!responseText.trim()) {
          throw new InvalidModelOutputError();
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          throw new InvalidModelOutputError();
        }

        try {
          return validate(parsed);
        } catch {
          throw new InvalidModelOutputError();
        }
      } catch (error) {
        if (error instanceof InvalidModelOutputError) {
          lastFailure = new GenerationFailure("invalid_response", true);
          hadRetryableFailure = true;
          modelState.sawInvalidResponse = true;
          modelState.unavailableModels.add(modelName);
          break;
        }

        const providerClassification = candidate.provider === "gemini"
          ? classifyGeminiError(error)
          : classifyGroqError(error);
        const classification = new GenerationFailure(
          providerClassification.errorCode,
          providerClassification.retryable,
        );
        lastFailure = classification;
        if (!classification.retryable) {
          if (providerClassification.providerWide) {
            modelState.unavailableProviders.add(candidate.provider);
          } else {
            modelState.unavailableModels.add(modelName);
          }
          break;
        }
        hadRetryableFailure = true;
        modelState.sawRetryableFailure = true;

        if (attempt === MAX_ATTEMPTS_PER_MODEL) {
          if (providerClassification.providerWide) {
            modelState.unavailableProviders.add(candidate.provider);
          } else {
            modelState.unavailableModels.add(modelName);
          }
          break;
        }

        const delay = getRetryDelayMs(
          attempt,
          Math.random(),
          candidate.provider === "gemini"
            ? getProviderRetryDelayMs(error)
            : getGroqRetryDelayMs(error),
        );
        ensureTimeRemaining(deadlineAt);
        if (!isRetryDelayWithinDeadline(delay, deadlineAt, Date.now())) {
          if (providerClassification.providerWide) {
            modelState.unavailableProviders.add(candidate.provider);
          } else {
            modelState.unavailableModels.add(modelName);
          }
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  ensureTimeRemaining(deadlineAt);
  if (modelState.sawRetryableFailure) {
    throw new GenerationFailure("temporarily_unavailable", true);
  }
  if (modelState.sawInvalidResponse || hadRetryableFailure) {
    throw new GenerationFailure("invalid_response", true);
  }
  throw lastFailure ?? new GenerationFailure("configuration", false);
}

type GenerationProviderState = {
  unavailableModels: Set<string>;
  unavailableProviders: Set<"gemini" | "groq">;
  sawRetryableFailure: boolean;
  sawInvalidResponse: boolean;
};

async function generateGeminiContent(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
  timeout: number,
) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt, { timeout });
  return result.response.text();
}

async function generateGroqContent(
  groq: Groq,
  prompt: string,
  timeout: number,
  responseFormat: typeof WORKOUT_RESPONSE_FORMAT | typeof DIET_RESPONSE_FORMAT,
) {
  const response = await groq.chat.completions.create(
    {
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: responseFormat,
    },
    getGroqRequestOptions(timeout),
  );
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new InvalidModelOutputError();
  return content;
}

const WORKOUT_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "fitness_workout_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["schedule", "exercises"],
      properties: {
        schedule: { type: "array", items: { type: "string" } },
        exercises: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["day", "routines"],
            properties: {
              day: { type: "string" },
              routines: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "sets", "reps", "description", "duration", "exercises"],
                  properties: {
                    name: { type: "string" },
                    sets: { type: "number" },
                    reps: { type: "number" },
                    description: { type: ["string", "null"] },
                    duration: { type: ["string", "null"] },
                    exercises: {
                      anyOf: [
                        { type: "array", items: { type: "string" } },
                        { type: "null" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const DIET_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "fitness_diet_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["dailyCalories", "meals"],
      properties: {
        dailyCalories: { type: "number" },
        meals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "foods"],
            properties: {
              name: { type: "string" },
              foods: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

class InvalidModelOutputError extends Error {}

class GenerationFailure extends Error {
  constructor(
    readonly errorCode: GenerationErrorCode,
    readonly retryable: boolean,
  ) {
    super("Fitness plan generation failed.");
  }
}

function classifyFailure(error: unknown): GenerationFailure {
  if (error instanceof GenerationFailure) return error;
  if (error instanceof InvalidModelOutputError) {
    return new GenerationFailure("invalid_response", true);
  }

  const classification = classifyGeminiError(error);
  if (error instanceof GoogleGenerativeAIAbortError) {
    return new GenerationFailure("temporarily_unavailable", true);
  }

  return new GenerationFailure(
    classification.errorCode,
    classification.retryable,
  );
}

function ensureTimeRemaining(deadlineAt: number) {
  const remainingMs = getRemainingGenerationBudgetMs(deadlineAt, Date.now());
  if (remainingMs <= 0) {
    throw new GenerationFailure("temporarily_unavailable", true);
  }
  return remainingMs;
}

// ==========================================
// WORKOUT PLAN VALIDATION
// ==========================================

function validateWorkoutPlan(data: any) {
  if (
    !data ||
    !Array.isArray(data.schedule) ||
    !Array.isArray(data.exercises) ||
    data.schedule.length === 0 ||
    data.exercises.length === 0
  ) {
    throw new Error("Invalid workout plan generated by AI.");
  }

  if (
    !data.schedule.every(
      (day: unknown) => typeof day === "string" && day.trim(),
    )
  ) {
    throw new Error("Invalid workout schedule generated by AI.");
  }

  if (data.exercises.length !== data.schedule.length) {
    throw new Error("Workout schedule and exercise days do not match.");
  }

  const schedule = data.schedule.map((day: string) => day.trim());

  if (
    new Set(schedule.map((day: string) => day.toLowerCase())).size !==
    schedule.length
  ) {
    throw new Error("Workout schedule contains duplicate days.");
  }

  return {
    schedule,

    exercises: data.exercises.map((exercise: any) => {
      if (
        !exercise ||
        typeof exercise.day !== "string" ||
        !Array.isArray(exercise.routines)
      ) {
        throw new Error("Invalid workout day generated by AI.");
      }

      const day = exercise.day.trim();

      if (
        !schedule.some(
          (scheduledDay: string) =>
            scheduledDay.toLowerCase() === day.toLowerCase(),
        )
      ) {
        throw new Error(`Exercise day "${day}" is missing from the schedule.`);
      }

      return {
        day,

        routines: exercise.routines.map((routine: any) => {
          if (
            !routine ||
            typeof routine.name !== "string" ||
            !routine.name.trim()
          ) {
            throw new Error("Invalid exercise generated by AI.");
          }

          const sets = Number(routine.sets);
          const reps = Number(routine.reps);

          return {
            name: routine.name.trim(),

            sets: Number.isFinite(sets) && sets > 0 ? sets : 3,

            reps: Number.isFinite(reps) && reps > 0 ? reps : 10,

            ...(routine.duration != null
              ? {
                  duration: String(routine.duration),
                }
              : {}),

            ...(routine.description != null
              ? {
                  description: String(routine.description),
                }
              : {}),

            ...(Array.isArray(routine.exercises)
              ? {
                  exercises: routine.exercises.map((item: unknown) =>
                    String(item),
                  ),
                }
              : {}),
          };
        }),
      };
    }),
  };
}

// ==========================================
// DIET PLAN VALIDATION
// ==========================================

function validateDietPlan(data: any) {
  if (
    !data ||
    typeof data.dailyCalories !== "number" ||
    !Number.isFinite(data.dailyCalories) ||
    data.dailyCalories <= 0 ||
    !Array.isArray(data.meals) ||
    data.meals.length === 0
  ) {
    throw new Error("Invalid diet plan generated by AI.");
  }

  return {
    dailyCalories: data.dailyCalories,

    meals: data.meals.map((meal: any) => {
      if (
        !meal ||
        typeof meal.name !== "string" ||
        !meal.name.trim() ||
        !Array.isArray(meal.foods) ||
        !meal.foods.every((food: unknown) => typeof food === "string")
      ) {
        throw new Error("Invalid meal generated by AI.");
      }

      return {
        name: meal.name.trim(),

        foods: meal.foods.map((food: string) => food.trim()),
      };
    }),
  };
}
