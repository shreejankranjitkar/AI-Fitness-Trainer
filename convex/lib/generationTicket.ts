const EXPECTED_AUDIENCE = "/vapi/generate-program";
const MAX_TICKET_LIFETIME_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 30;

type VerifiedGenerationTicket = {
  subject: string;
  ticketId: string;
  expiresAt: number;
};

export type GenerationTicketVerification =
  | { valid: true; ticket: VerifiedGenerationTicket }
  | { valid: false; reason: string };

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonSegment<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

export async function verifyGenerationTicket(
  token: unknown,
): Promise<GenerationTicketVerification> {
  if (typeof token !== "string" || !token) {
    return { valid: false, reason: "missing_or_non_string_body_field" };
  }
  if (token.length > 4096) {
    return { valid: false, reason: "ticket_exceeds_size_limit" };
  }

  const secret = process.env.VAPI_GENERATION_TICKET_SECRET;
  if (!secret || secret.length < 32) {
    return { valid: false, reason: "convex_signing_secret_missing_or_too_short" };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { valid: false, reason: "invalid_token_format" };
  }

  try {
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    let header: { alg?: unknown; typ?: unknown };
    try {
      header = decodeJsonSegment(encodedHeader);
    } catch {
      return { valid: false, reason: "invalid_header_encoding" };
    }
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return { valid: false, reason: "unsupported_header_algorithm_or_type" };
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    );
    if (!validSignature) {
      return { valid: false, reason: "signature_invalid_check_shared_secret_and_transport" };
    }

    let claims: {
      sub?: unknown;
      aud?: unknown;
      iat?: unknown;
      exp?: unknown;
      jti?: unknown;
    };
    try {
      claims = decodeJsonSegment(encodedClaims);
    } catch {
      return { valid: false, reason: "invalid_claims_encoding" };
    }
    const now = Math.floor(Date.now() / 1000);

    if (typeof claims.sub !== "string" || !claims.sub.trim()) {
      return { valid: false, reason: "subject_claim_invalid" };
    }
    if (claims.aud !== EXPECTED_AUDIENCE) {
      return { valid: false, reason: "audience_mismatch" };
    }
    if (typeof claims.iat !== "number" || !Number.isInteger(claims.iat)) {
      return { valid: false, reason: "issued_at_claim_invalid" };
    }
    if (typeof claims.exp !== "number" || !Number.isInteger(claims.exp)) {
      return { valid: false, reason: "expiry_claim_invalid" };
    }
    if (typeof claims.jti !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(claims.jti)) {
      return { valid: false, reason: "ticket_id_claim_invalid" };
    }
    if (claims.iat > now + CLOCK_SKEW_SECONDS) {
      return { valid: false, reason: "issued_at_is_in_the_future" };
    }
    if (claims.exp <= now) {
      return { valid: false, reason: "ticket_expired_before_tool_request" };
    }
    if (claims.exp <= claims.iat) {
      return { valid: false, reason: "expiry_not_after_issued_at" };
    }
    if (claims.exp - claims.iat > MAX_TICKET_LIFETIME_SECONDS) {
      return { valid: false, reason: "ticket_lifetime_exceeds_limit" };
    }

    return {
      valid: true,
      ticket: {
        subject: claims.sub,
        ticketId: claims.jti,
        expiresAt: claims.exp * 1000,
      },
    };
  } catch {
    return { valid: false, reason: "ticket_verification_runtime_error" };
  }
}
