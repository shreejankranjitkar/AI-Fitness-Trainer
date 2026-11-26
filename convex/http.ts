import { httpRouter } from "convex/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { Webhook } from "svix";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifyGenerationTicket } from "./lib/generationTicket";

const http = httpRouter();

// ==========================================
// CLERK WEBHOOK
// ==========================================

http.route({
  path: "/clerk-webhook",
  method: "POST",

  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return new Response("Missing Clerk webhook secret", {
        status: 500,
      });
    }

    const svix_id = req.headers.get("svix-id");
    const svix_timestamp = req.headers.get("svix-timestamp");
    const svix_signature = req.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response("Missing Svix headers", {
        status: 400,
      });
    }

    const body = await req.text();
    const wh = new Webhook(webhookSecret);

    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (error) {
      console.error("Clerk webhook verification failed:", error);

      return new Response("Invalid webhook signature", {
        status: 400,
      });
    }

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const id = evt.data.id;

      if (!id || typeof id !== "string") {
        return new Response("Invalid Clerk user ID", {
          status: 400,
        });
      }

      const email = evt.data.email_addresses?.find(
        (email) => email.id === evt.data.primary_email_address_id,
      )?.email_address;

      if (!email) {
        return new Response("User email not found", {
          status: 400,
        });
      }

      const name =
        [evt.data.first_name, evt.data.last_name].filter(Boolean).join(" ") ||
        "User";

      const image = evt.data.image_url;

      // syncUser is a PUBLIC mutation, so use api.
      await ctx.runMutation(api.users.syncUser, {
        clerkId: id,
        name,
        email,
        ...(image ? { image } : {}),
      });
    }

    return new Response("Webhook processed successfully", {
      status: 200,
    });
  }),
});

// ==========================================
// FITNESS PROGRAM GENERATION
// ==========================================

http.route({
  path: "/vapi/generate-program",
  method: "POST",

  handler: httpAction(async (ctx, req) => {
    let vapiToolCallId: string | undefined;
    try {
      const requestBody: unknown = await req.json();
      const extracted = extractGenerationRequest(requestBody);
      vapiToolCallId = extracted.toolCallId;
      const payload = extracted.payload;

      const verification = await verifyGenerationTicket(payload.generation_ticket);
      if (!verification.valid) {
        const hasGenerationTicket = Object.prototype.hasOwnProperty.call(
          payload,
          "generation_ticket",
        );
        const generationTicketType = hasGenerationTicket
          ? payload.generation_ticket === null
            ? "null"
            : Array.isArray(payload.generation_ticket)
              ? "array"
              : typeof payload.generation_ticket
          : "missing";
        console.warn(
          "[vapi-generate-program] Ticket verification rejected:",
          {
            requestShape: extracted.requestShape,
            stage: verification.reason,
            generationTicketPresent: hasGenerationTicket,
            generationTicketType,
          },
        );
        return generationErrorResponse(vapiToolCallId, "Authentication failed.", 401);
      }
      const ticket = verification.ticket;

      // user_id remains a compatibility field only. The signed ticket subject is authoritative.
      if (
        payload.user_id !== undefined &&
        (typeof payload.user_id !== "string" || payload.user_id !== ticket.subject)
      ) {
        console.warn(
          "[vapi-generate-program] Compatibility user_id did not match the authenticated ticket subject.",
        );
        return generationErrorResponse(vapiToolCallId, "Authentication failed.", 403);
      }

      const age = payload.age;
      const workoutDays = payload.workout_days;
      const fitnessGoal = nonBlankString(payload.fitness_goal);
      const fitnessLevel = nonBlankString(payload.fitness_level);
      const injuries = optionalString(payload.injuries);
      const height = optionalString(payload.height);
      const weight = optionalString(payload.weight);
      const dietaryRestrictions = optionalString(payload.dietary_restrictions);

      if (
        typeof age !== "number" ||
        !Number.isInteger(age) ||
        age <= 0 ||
        age > 120 ||
        typeof workoutDays !== "number" ||
        !Number.isInteger(workoutDays) ||
        workoutDays < 1 ||
        workoutDays > 7 ||
        !fitnessGoal ||
        !fitnessLevel ||
        injuries === null ||
        height === null ||
        weight === null ||
        dietaryRestrictions === null
      ) {
        return generationErrorResponse(vapiToolCallId, "Missing or invalid fitness information.", 400);
      }

      const generationId = await ctx.runMutation(
        internal.generations.queueGeneration,
        {
          userId: ticket.subject,
          ticketId: ticket.ticketId,
          ticketExpiresAt: ticket.expiresAt,
          age,
          ...(height ? { height } : {}),
          ...(weight ? { weight } : {}),
          injuries: injuries || "Not provided",
          workout_days: workoutDays,
          fitness_goal: fitnessGoal,
          fitness_level: fitnessLevel,
          ...(dietaryRestrictions ? { dietary_restrictions: dietaryRestrictions } : {}),
        },
      );

      if (vapiToolCallId) {
        return jsonResponse({
          results: [
            {
              toolCallId: vapiToolCallId,
              result: "Your fitness plan is queued for generation and has not been saved yet. The application will confirm when it is complete.",
            },
          ],
        });
      }

      return jsonResponse({
        success: true,
        status: "queued",
        generationId,
        message: "Your fitness plan is queued for generation and has not been saved yet. The application will confirm when it is complete.",
      });
    } catch {
      return generationErrorResponse(vapiToolCallId, "Unable to start fitness plan generation.", 400);
    }
  }),
});

// ==========================================
// JSON RESPONSE HELPER
// ==========================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  return value.trim() || undefined;
}

function nonBlankString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractGenerationRequest(body: unknown): {
  payload: Record<string, unknown>;
  toolCallId?: string;
  requestShape: "vapi_tool_call" | "direct_json" | "unrecognized_envelope";
} {
  if (!body || typeof body !== "object") throw new Error("Invalid request.");
  const root = body as Record<string, unknown>;
  const message = root.message;

  if (message && typeof message === "object") {
    const messageObject = message as Record<string, unknown>;
    const calls = messageObject.toolCallList;
    if (messageObject.type === "tool-calls" && Array.isArray(calls)) {
      if (calls.length !== 1 || !calls[0] || typeof calls[0] !== "object") {
        throw new Error("Invalid tool call.");
      }
      const call = calls[0] as Record<string, unknown>;
      const toolCallId = typeof call.id === "string" ? call.id : undefined;
      const func = call.function;
      if (!func || typeof func !== "object") throw new Error("Invalid tool call.");
      const args = (func as Record<string, unknown>).arguments;
      const parsedArgs = typeof args === "string" ? JSON.parse(args) : args;
      if (!parsedArgs || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
        throw new Error("Invalid tool arguments.");
      }
      return {
        payload: parsedArgs as Record<string, unknown>,
        toolCallId,
        requestShape: "vapi_tool_call",
      };
    }

    return {
      payload: root,
      requestShape: "unrecognized_envelope",
    };
  }

  return { payload: root, requestShape: "direct_json" };
}

function generationErrorResponse(
  toolCallId: string | undefined,
  message: string,
  status: number,
) {
  if (toolCallId) {
    return jsonResponse({
      results: [{ toolCallId, error: message }],
    });
  }
  return jsonResponse({ success: false, error: message }, status);
}

export default http;
