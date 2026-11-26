import test from "node:test";
import assert from "node:assert/strict";
import {
  GENERATION_STALE_AFTER_MS,
  GENERATION_INPUT_RETENTION_MS,
  GENERATION_DEADLINE_MS,
  GEMINI_REQUEST_TIMEOUT_MS,
  classifyGeminiError,
  getBoundedRequestTimeoutMs,
  getProviderRetryDelayMs,
  getGroqRetryDelayMs,
  getGroqRequestOptions,
  getGenerationModelPriority,
  getRetryDelayMs,
  isDietOutputSafe,
  isGroqFallbackConfigured,
  isCurrentAttempt,
  isGenerationOwner,
  isRetryDelayWithinDeadline,
  isRetryableGenerationFailure,
  isStaleGeneration,
  isWorkoutOutputSafe,
  minimizeWorkoutPromptForGroq,
  classifyGroqError,
  shouldAttemptProviderModel,
} from "../convex/generationReliability.ts";

test("request timeout and total generation deadline are bounded", () => {
  const now = 1_000;
  assert.equal(getBoundedRequestTimeoutMs(now + 30_000, now), 25_000);
  assert.equal(getBoundedRequestTimeoutMs(now + 5_000, now), 5_000);
  assert.equal(getBoundedRequestTimeoutMs(now, now), 0);
  assert.equal(GENERATION_DEADLINE_MS, 150_000);
  assert.equal(GEMINI_REQUEST_TIMEOUT_MS, 25_000);
});

test("retry delay uses capped exponential full jitter and provider RetryInfo", () => {
  assert.equal(getRetryDelayMs(1, 0.5), 500);
  assert.equal(getRetryDelayMs(2, 0.5), 1_000);
  assert.equal(getRetryDelayMs(10, 1), 8_000);

  const error = {
    errorDetails: [
      {
        "@type": "type.googleapis.com/google.rpc.RetryInfo",
        retryDelay: "2.25s",
      },
    ],
  };
  assert.equal(getProviderRetryDelayMs(error), 2_250);
  assert.equal(getRetryDelayMs(1, 0.1, getProviderRetryDelayMs(error)), 2_250);
  assert.equal(isRetryDelayWithinDeadline(2_000, 10_000, 7_000), true);
  assert.equal(isRetryDelayWithinDeadline(3_000, 10_000, 7_000), false);
});

test("retry classification retries transient failures but stops on permanent errors", () => {
  assert.equal(classifyGeminiError({ status: 503 }).retryable, true);
  assert.equal(classifyGeminiError({ status: 429 }).retryable, true);
  assert.equal(
    classifyGeminiError({
      status: 429,
      errorDetails: [{ reason: "BILLING_DISABLED" }],
    }).retryable,
    false,
  );
  assert.equal(classifyGeminiError({ status: 400 }).retryable, false);
  assert.equal(classifyGeminiError(new Error("fetch failed")).retryable, true);
  assert.equal(classifyGeminiError(new Error("Request aborted")).retryable, true);
});

test("Groq stays disabled without both the explicit flag and a configured key", () => {
  assert.equal(isGroqFallbackConfigured(undefined, "secret"), false);
  assert.equal(isGroqFallbackConfigured("false", "secret"), false);
  assert.equal(isGroqFallbackConfigured("true", "  "), false);
  assert.equal(isGroqFallbackConfigured("true", "secret"), true);
  assert.deepEqual(getGenerationModelPriority(false).map((entry) => entry.model), [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
  ]);
  assert.deepEqual(getGenerationModelPriority(true).map((entry) => entry.model), [
    "gemini-3.5-flash-lite",
    "openai/gpt-oss-120b",
    "gemini-3.8-flash",
  ]);
});

test("Groq workout fallback omits height and weight while retaining required inputs", () => {
  const prompt = [
    "Age: 32",
    "Height: 175 cm",
    "Weight: 75 kg",
    "Injuries or limitations: knee pain",
    "Workout days per week: 3",
    "Fitness goal: strength",
    "Fitness level: Beginner",
  ].join("\n");
  const minimized = minimizeWorkoutPromptForGroq(prompt);
  assert.doesNotMatch(minimized, /175 cm|75 kg/);
  assert.match(minimized, /Age: 32/);
  assert.match(minimized, /knee pain/);
  assert.match(minimized, /Workout days per week: 3/);
  assert.match(minimized, /Fitness level: Beginner/);
});

test("provider-wide failure suppresses later models from that provider", () => {
  assert.equal(classifyGroqError({ status: 503 }).providerWide, true);
  assert.equal(classifyGeminiError({ status: 429 }).providerWide, true);
  assert.equal(classifyGeminiError({ status: 404 }).providerWide, false);
  const unavailableProviders = new Set(["gemini"]);
  assert.equal(
    shouldAttemptProviderModel("gemini", "gemini-3.8-flash", unavailableProviders, new Set()),
    false,
  );
  assert.equal(
    shouldAttemptProviderModel("groq", "openai/gpt-oss-120b", unavailableProviders, new Set()),
    true,
  );
});

test("Groq Retry-After guidance is read from SDK headers", () => {
  assert.equal(
    getGroqRetryDelayMs({ headers: new Headers({ "retry-after": "2.5" }) }),
    2_500,
  );
  assert.equal(getGroqRetryDelayMs({ headers: new Headers() }), undefined);
  assert.deepEqual(getGroqRequestOptions(12_345), { maxRetries: 0, timeout: 12_345 });
});

test("workout output is checked against requested days, injuries, and fitness level", () => {
  const context = {
    requestedDays: 2,
    injuries: "Knee injury",
    fitnessLevel: "Beginner",
  };
  const plan = {
    schedule: ["Monday", "Thursday"],
    exercises: [
      { day: "Monday", routines: [{ name: "Chair squats", sets: 3, reps: 12 }] },
      { day: "Thursday", routines: [{ name: "Wall push-ups", sets: 3, reps: 10 }] },
    ],
  };
  assert.equal(isWorkoutOutputSafe(plan, context), true);
  assert.equal(isWorkoutOutputSafe({ ...plan, schedule: ["Monday"] }, context), false);
  assert.equal(
    isWorkoutOutputSafe({
      ...plan,
      exercises: [
        { day: "Monday", routines: [{ name: "Box jumps", sets: 3, reps: 8 }] },
        plan.exercises[1],
      ],
    }, context),
    false,
  );
  assert.equal(
    isWorkoutOutputSafe({
      ...plan,
      exercises: [
        { day: "Monday", routines: [{ name: "Squat", sets: 5, reps: 10 }] },
        plan.exercises[1],
      ],
    }, context),
    false,
  );
});

test("diet output is checked against restrictions and extreme calorie values", () => {
  const context = { dietaryRestrictions: "Peanut allergy and gluten-free" };
  assert.equal(
    isDietOutputSafe({
      dailyCalories: 2_000,
      meals: [{ name: "Breakfast", foods: ["Oatmeal", "Banana"] }],
    }, context),
    true,
  );
  assert.equal(
    isDietOutputSafe({
      dailyCalories: 2_000,
      meals: [{ name: "Breakfast", foods: ["Peanut butter toast"] }],
    }, context),
    false,
  );
  assert.equal(
    isDietOutputSafe({ dailyCalories: 500, meals: [{ name: "Lunch", foods: ["Rice"] }] }, context),
    false,
  );
});

test("retry eligibility requires a failed retryable generation and a live snapshot", () => {
  const expiresAt = 10_000;
  const check = ({
    status = "failed",
    retryable = true,
    hasInput = true,
    expiry = expiresAt,
    now = 9_000,
  } = {}) =>
    isRetryableGenerationFailure(
      status,
      retryable,
      hasInput,
      expiry,
      now,
    );

  assert.equal(check(), true);
  assert.equal(
    isRetryableGenerationFailure("queued", true, true, expiresAt, 9_000),
    false,
  );
  assert.equal(
    isRetryableGenerationFailure("failed", false, true, expiresAt, 9_000),
    false,
  );
  assert.equal(
    isRetryableGenerationFailure("failed", true, false, expiresAt, 9_000),
    false,
  );
  assert.equal(
    isRetryableGenerationFailure("failed", true, true, expiresAt, 10_000),
    false,
  );
  assert.equal(GENERATION_INPUT_RETENTION_MS, 7 * 24 * 60 * 60 * 1_000);
});

test("stale attempts are recoverable and cannot pass the current-attempt guard", () => {
  const now = 100_000;
  assert.equal(
    isStaleGeneration("generating", now - GENERATION_STALE_AFTER_MS, now),
    true,
  );
  assert.equal(isStaleGeneration("queued", now - 1, now), false);
  assert.equal(isStaleGeneration("completed", now - 500_000, now), false);
  assert.equal(isCurrentAttempt("generating", 4, 4), true);
  assert.equal(isCurrentAttempt("generating", 5, 4), false);
  assert.equal(isCurrentAttempt("failed", 4, 4), false);
});

test("ownership checks reject missing or different authenticated subjects", () => {
  assert.equal(isGenerationOwner("user-a", "user-a"), true);
  assert.equal(isGenerationOwner("user-a", "user-b"), false);
  assert.equal(isGenerationOwner("user-a", null), false);
  assert.equal(isGenerationOwner("user-a", undefined), false);
});
