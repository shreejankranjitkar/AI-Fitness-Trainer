export const GEMINI_REQUEST_TIMEOUT_MS = 25_000;
export const PROVIDER_REQUEST_TIMEOUT_MS = GEMINI_REQUEST_TIMEOUT_MS;
export const AI_REQUEST_TIMEOUT_MS = GEMINI_REQUEST_TIMEOUT_MS;
export const GROQ_SDK_MAX_RETRIES = 0;
export const GENERATION_DEADLINE_MS = 150_000;
export const MAX_ATTEMPTS_PER_MODEL = 2;
export const RETRY_BASE_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 8_000;
export const GENERATION_STALE_AFTER_MS = 180_000;
export const GENERATION_INPUT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export type GenerationErrorCode =
  | "temporarily_unavailable"
  | "invalid_response"
  | "configuration"
  | "generation_failed";

export type ProviderFailure = {
  retryable: boolean;
  providerWide: boolean;
  errorCode: GenerationErrorCode;
};

export type WorkoutSafetyContext = {
  requestedDays: number;
  injuries: string;
  fitnessLevel: string;
};

export type DietSafetyContext = {
  dietaryRestrictions: string;
};

export type GenerationModel = { provider: "gemini" | "groq"; model: string };

export function getGenerationModelPriority(groqEnabled: boolean): GenerationModel[] {
  return [
    { provider: "gemini", model: "gemini-3.5-flash-lite" },
    ...(groqEnabled ? [{ provider: "groq" as const, model: "openai/gpt-oss-120b" }] : []),
    { provider: "gemini", model: "gemini-3.8-flash" },
  ];
}

export function isGroqFallbackConfigured(flag: string | undefined, apiKey: string | undefined) {
  return flag === "true" && Boolean(apiKey?.trim());
}

export function getGroqRequestOptions(timeout: number) {
  return { maxRetries: GROQ_SDK_MAX_RETRIES, timeout } as const;
}

export function minimizeWorkoutPromptForGroq(prompt: string) {
  return prompt.replace(/^(Height|Weight):[^\r\n]*$/gm, "$1: Not provided");
}

export function shouldAttemptProviderModel(
  provider: "gemini" | "groq",
  model: string,
  unavailableProviders: ReadonlySet<"gemini" | "groq">,
  unavailableModels: ReadonlySet<string>,
) {
  return !unavailableProviders.has(provider) && !unavailableModels.has(model);
}

export function isRetryableGenerationFailure(
  status: string,
  retryable: boolean | undefined,
  hasInput: boolean,
  inputExpiresAt: number | undefined,
  now: number,
) {
  return (
    status === "failed" &&
    retryable === true &&
    hasInput &&
    inputExpiresAt !== undefined &&
    inputExpiresAt > now
  );
}

export function isStaleGeneration(
  status: string,
  updatedAt: number,
  now: number,
) {
  return (
    (status === "queued" || status === "generating") &&
    now - updatedAt >= GENERATION_STALE_AFTER_MS
  );
}

export function isCurrentAttempt(
  status: string,
  currentAttempt: number | undefined,
  completedAttempt: number,
) {
  return status === "generating" && currentAttempt === completedAttempt;
}

export function isGenerationOwner(
  ownerId: string,
  authenticatedUserId: string | null | undefined,
) {
  return Boolean(authenticatedUserId) && ownerId === authenticatedUserId;
}

export function getRemainingGenerationBudgetMs(deadlineAt: number, now: number) {
  return Math.max(0, deadlineAt - now);
}

export function isRetryDelayWithinDeadline(
  delayMs: number,
  deadlineAt: number,
  now: number,
) {
  return delayMs < getRemainingGenerationBudgetMs(deadlineAt, now);
}

export function getBoundedRequestTimeoutMs(
  deadlineAt: number,
  now: number,
) {
  const remainingMs = getRemainingGenerationBudgetMs(deadlineAt, now);
  return remainingMs > 0
    ? Math.min(GEMINI_REQUEST_TIMEOUT_MS, remainingMs)
    : 0;
}

export function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  if ("status" in error) {
    const status = Number(error.status);
    if (Number.isInteger(status) && status > 0) return status;
  }

  return undefined;
}

export function getProviderRetryDelayMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("errorDetails" in error)) {
    return undefined;
  }

  const details = error.errorDetails;
  if (!Array.isArray(details)) return undefined;

  const retryInfo = details.find(
    (detail) =>
      detail &&
      typeof detail === "object" &&
      typeof detail["@type"] === "string" &&
      detail["@type"].includes("google.rpc.RetryInfo"),
  );
  if (!retryInfo || typeof retryInfo !== "object") return undefined;

  const rawDelay = retryInfo.retryDelay ?? retryInfo.retry_delay;
  if (typeof rawDelay !== "string") return undefined;

  const match = /^(\d+(?:\.\d+)?)s$/.exec(rawDelay);
  if (!match) return undefined;

  const delayMs = Number(match[1]) * 1_000;
  return Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : undefined;
}

export function getGroqRetryDelayMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("headers" in error)) {
    return undefined;
  }

  const headers = error.headers;
  let value: string | null | undefined;
  if (headers && typeof headers === "object" && "get" in headers && typeof headers.get === "function") {
    value = headers.get("retry-after");
  } else if (headers && typeof headers === "object") {
    const entry = Object.entries(headers).find(
      ([name]) => name.toLowerCase() === "retry-after",
    );
    value = entry?.[1] == null ? undefined : String(entry[1]);
  }

  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : undefined;
}

export function getRetryDelayMs(
  attempt: number,
  randomValue: number,
  providerDelayMs?: number,
) {
  if (providerDelayMs !== undefined) return providerDelayMs;

  const cap = Math.min(
    RETRY_MAX_DELAY_MS,
    RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
  );
  const safeRandom = Math.min(1, Math.max(0, randomValue));
  return Math.floor(safeRandom * cap);
}

export function classifyGeminiError(error: unknown): {
  retryable: boolean;
  errorCode: GenerationErrorCode;
  providerWide: boolean;
} {
  const status = getHttpStatus(error);
  const message = error instanceof Error ? error.message : "";

  if (status === 404) {
    return { retryable: false, errorCode: "configuration", providerWide: false };
  }

  if (status === 429) {
    const detailText = getErrorDetailText(error);
    const permanentQuotaFailure =
      /billing|prepay|spend.?cap|payment|credit balance|api key|permission/i.test(
        detailText,
      );
    return permanentQuotaFailure
      ? { retryable: false, errorCode: "configuration", providerWide: true }
      : { retryable: true, errorCode: "temporarily_unavailable", providerWide: true };
  }

  if ([408, 500, 502, 503, 504].includes(status ?? 0)) {
    return { retryable: true, errorCode: "temporarily_unavailable", providerWide: true };
  }

  if (status === 401 || status === 403) {
    return { retryable: false, errorCode: "configuration", providerWide: true };
  }

  if (status !== undefined) {
    return { retryable: false, errorCode: "configuration", providerWide: false };
  }

  if (
    status === undefined &&
    /abort|timeout|fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
      message,
    )
  ) {
    return { retryable: true, errorCode: "temporarily_unavailable", providerWide: true };
  }

  return { retryable: false, errorCode: "configuration", providerWide: false };
}

export function classifyGroqError(error: unknown): ProviderFailure {
  const status = getHttpStatus(error);
  const message = error instanceof Error ? error.message : "";

  if (status === 404) {
    return { retryable: false, errorCode: "configuration", providerWide: false };
  }

  if (status === 429) {
    const groqErrorCode = getGroqErrorCode(error);
    if (/insufficient_quota|billing|spend.?cap|quota_exceeded/i.test(groqErrorCode)) {
      return { retryable: false, errorCode: "configuration", providerWide: true };
    }
    return {
      retryable: true,
      errorCode: "temporarily_unavailable",
      providerWide: true,
    };
  }

  if ([408, 500, 502, 503, 504].includes(status ?? 0)) {
    return {
      retryable: true,
      errorCode: "temporarily_unavailable",
      providerWide: true,
    };
  }

  if (status === 401 || status === 403) {
    return { retryable: false, errorCode: "configuration", providerWide: true };
  }

  if (status !== undefined) {
    return { retryable: false, errorCode: "configuration", providerWide: false };
  }

  if (/abort|timeout|fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
    return {
      retryable: true,
      errorCode: "temporarily_unavailable",
      providerWide: true,
    };
  }

  return { retryable: false, errorCode: "configuration", providerWide: false };
}

/** Shared post-parse safety gate used for output from every provider. */
export function isWorkoutOutputSafe(
  plan: {
    schedule?: string[];
    exercises?: Array<{
      day?: string;
      routines?: Array<{
        name?: string;
        description?: string;
        exercises?: string[];
        sets?: number;
        reps?: number;
      }>;
    }>;
  },
  context: WorkoutSafetyContext,
) {
  if (
    !Array.isArray(plan.schedule) ||
    plan.schedule.length !== context.requestedDays ||
    !Array.isArray(plan.exercises) ||
    plan.exercises.length !== context.requestedDays ||
    !plan.schedule.every((day) => typeof day === "string" && day.trim())
  ) {
    return false;
  }

  const scheduledDays = new Set(plan.schedule.map((day) => day.trim().toLowerCase()));
  const exerciseDays = plan.exercises.map((day) => day.day?.trim().toLowerCase());
  if (
    scheduledDays.size !== context.requestedDays ||
    exerciseDays.some((day) => !day || !scheduledDays.has(day)) ||
    new Set(exerciseDays).size !== context.requestedDays
  ) return false;

  const level = context.fitnessLevel.toLowerCase();
  const beginner = /beginner|novice/.test(level);
  const setsLimit = beginner ? 4 : 6;
  const repsLimit = beginner ? 20 : 40;
  const injury = context.injuries.toLowerCase();
  const blockedPatterns: RegExp[] = [];

  if (/knee|acl|meniscus|patella/.test(injury)) {
    blockedPatterns.push(/\b(jump(?:s|ing)?|box jump(?:s)?|burpee(?:s)?|sprint(?:s|ing)?|jump rope|plyometric)\b/i);
  }
  if (/ankle|foot|achilles/.test(injury)) {
    blockedPatterns.push(/\b(jump(?:s|ing)?|box jump(?:s)?|burpee(?:s)?|sprint(?:s|ing)?|jump rope|plyometric|running)\b/i);
  }
  if (/back|spine|disc|sciatica/.test(injury)) {
    blockedPatterns.push(/\b(deadlift|good morning|bent[- ]over row|sit[- ]up|russian twist)\b/i);
  }
  if (/shoulder|rotator cuff|collarbone/.test(injury)) {
    blockedPatterns.push(/\b(overhead press|behind[- ]the[- ]neck|snatch|dip(?:s)?|upright row)\b/i);
  }

  return plan.exercises.every((day) =>
    Array.isArray(day.routines) && day.routines.length > 0 && day.routines.every((routine) => {
      const sets = Number(routine.sets);
      const reps = Number(routine.reps);
      const description = `${routine.name ?? ""} ${routine.description ?? ""} ${(routine.exercises ?? []).join(" ")}`;
      return (
        Number.isFinite(sets) && sets >= 1 && sets <= setsLimit &&
        Number.isFinite(reps) && reps >= 1 && reps <= repsLimit &&
        !blockedPatterns.some((pattern) => pattern.test(description)) &&
        !/\b(ignore|push through) (the )?pain\b/i.test(description)
      );
    }),
  );
}

const DIETARY_RESTRICTION_GROUPS: Array<{ trigger: RegExp; forbidden: RegExp }> = [
  { trigger: /\bvegan\b/i, forbidden: /\b(meat|beef|pork|chicken|turkey|fish|seafood|egg|milk|cheese|yogurt|butter|cream|whey|honey|gelatin)\b/i },
  { trigger: /\bvegetarian\b/i, forbidden: /\b(meat|beef|pork|chicken|turkey|fish|seafood|gelatin)\b/i },
  { trigger: /\b(gluten[- ]free|celiac|coeliac|gluten allergy|avoid gluten)\b/i, forbidden: /\b(wheat|barley|rye|couscous|seitan|regular pasta|regular bread)\b/i },
  { trigger: /\b(dairy[- ]free|lactose|milk allergy|avoid dairy)\b/i, forbidden: /\b(milk|cheese|yogurt|butter|cream|whey|casein)\b/i },
  { trigger: /\b(peanut allergy|avoid peanuts|peanut[- ]free)\b/i, forbidden: /\b(peanut|groundnut)\w*\b/i },
  { trigger: /\b(tree nut allergy|nut allergy|avoid nuts|nut[- ]free)\b/i, forbidden: /\b(almond|cashew|walnut|pistachio|pecan|hazelnut|macadamia|pine nut)\w*\b/i },
  { trigger: /\b(shellfish allergy|avoid shellfish|shellfish[- ]free)\b/i, forbidden: /\b(shrimp|prawn|crab|lobster|crayfish|clam|oyster|mussel|scallop)\w*\b/i },
  { trigger: /\b(egg allergy|avoid eggs|egg[- ]free)\b/i, forbidden: /\begg\w*\b/i },
  { trigger: /\b(fish allergy|avoid fish|fish[- ]free)\b/i, forbidden: /\b(salmon|tuna|cod|tilapia|sardine|anchov\w*|fish)\b/i },
  { trigger: /\bhalal\b/i, forbidden: /\b(pork|bacon|ham|alcohol|wine|beer)\b/i },
];

/** Rejects explicit dietary conflicts; unknown restrictions are also checked literally. */
export function isDietOutputSafe(
  plan: { dailyCalories?: unknown; meals?: Array<{ name?: string; foods?: string[] }> },
  context: DietSafetyContext,
) {
  if (
    typeof plan.dailyCalories !== "number" ||
    !Number.isFinite(plan.dailyCalories) ||
    plan.dailyCalories < 800 ||
    plan.dailyCalories > 8_000 ||
    !Array.isArray(plan.meals)
  ) {
    return false;
  }

  const restrictions = context.dietaryRestrictions.trim();
  if (!restrictions) return true;
  const output = plan.meals.flatMap((meal) => meal.foods ?? []).join(" ");

  for (const group of DIETARY_RESTRICTION_GROUPS) {
    if (group.trigger.test(restrictions) && group.forbidden.test(output)) return false;
  }

  const explicitAvoidance = restrictions.match(/(?:avoid|no|without|allergic to|allergy to)\s+([a-z][a-z -]{1,35})/gi) ?? [];
  for (const phrase of explicitAvoidance) {
    const ingredient = phrase.replace(/^(?:avoid|no|without|allergic to|allergy to)\s+/i, "").trim();
    if (ingredient && new RegExp(`\\b${escapeRegExp(ingredient)}\\b`, "i").test(output)) return false;
  }

  return true;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getErrorDetailText(error: unknown): string {
  if (!error || typeof error !== "object" || !("errorDetails" in error)) {
    return "";
  }

  const details = error.errorDetails;
  return Array.isArray(details)
    ? details
        .filter((detail) => detail && typeof detail === "object")
        .map((detail) => JSON.stringify(detail))
        .join(" ")
    : "";
}

function getGroqErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("error" in error)) return "";
  const body = error.error;
  if (!body || typeof body !== "object" || !("code" in body)) return "";
  return typeof body.code === "string" ? body.code : "";
}
