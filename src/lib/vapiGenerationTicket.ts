import { createHmac, randomBytes } from "node:crypto";

const TICKET_AUDIENCE = "/vapi/generate-program";
const TICKET_LIFETIME_SECONDS = 5 * 60;
const MIN_SECRET_LENGTH = 32;

type GenerationTicketClaims = {
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export function isVapiGenerationTicketConfigured() {
  const secret = process.env.VAPI_GENERATION_TICKET_SECRET;
  return Boolean(secret && secret.length >= MIN_SECRET_LENGTH);
}

export function issueVapiGenerationTicket(clerkUserId: string) {
  const secret = process.env.VAPI_GENERATION_TICKET_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("Generation ticket signing is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const claims: GenerationTicketClaims = {
    sub: clerkUserId,
    aud: TICKET_AUDIENCE,
    iat: now,
    exp: now + TICKET_LIFETIME_SECONDS,
    jti: randomBytes(24).toString("base64url"),
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}
