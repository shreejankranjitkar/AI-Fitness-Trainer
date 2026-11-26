import { auth } from "@clerk/nextjs/server";
import {
  isVapiGenerationTicketConfigured,
  issueVapiGenerationTicket,
} from "@/lib/vapiGenerationTicket";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Request not allowed." }, { status: 403 });
  }

  let userId: string | null;
  try {
    ({ userId } = await auth());
  } catch {
    console.error("[vapi-generation-ticket] Clerk authentication service failed.");
    return Response.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  if (!userId) {
    return Response.json(
      { error: "Sign in to start a generation call." },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  if (!isVapiGenerationTicketConfigured()) {
    console.error(
      "[vapi-generation-ticket] VAPI_GENERATION_TICKET_SECRET is missing or shorter than 32 characters.",
    );
    return Response.json(
      { error: "Generation ticket signing is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const ticket = await issueVapiGenerationTicket(userId);
    return Response.json(
      { ticket },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    console.error("[vapi-generation-ticket] Ticket signing failed.");
    return Response.json(
      { error: "Generation calls are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
