"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DashboardSidebar from "@/components/DashboardSidebar";
import Vapi from "@vapi-ai/web";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  Heart,
  LoaderCircle,
  Phone,
  Sparkles,
  UserRound as UserIcon,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const GenerateProgramPage = () => {
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const [generationQueryOwnerId, setGenerationQueryOwnerId] = useState<string | null>(null);
  const [sessionGenerationId, setSessionGenerationId] = useState<string | null>(null);
  const [resumedGenerationId, setResumedGenerationId] = useState<string | null>(null);

  const { user } = useUser();
  const router = useRouter();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const generationBeforeCallRef = useRef<string | null>(null);
  const initializedGenerationOwnerRef = useRef<string | null>(null);
  const callStartedInPageRef = useRef(false);
  const redirectingGenerationIdRef = useRef<string | null>(null);
  const vapiClientRef = useRef<Vapi | null>(null);
  const vapiListenerCleanupRef = useRef<(() => void) | null>(null);
  const callSequenceRef = useRef(0);
  const activeCallEpochRef = useRef<number | null>(null);
  const startingCallEpochRef = useRef<number | null>(null);
  const endedCallEpochRef = useRef<number | null>(null);
  const callActiveRef = useRef(false);
  const connectingRef = useRef(false);
  const disconnectingRef = useRef(false);
  const latestGeneration = useQuery(
    api.generations.getLatestGeneration,
    user ? {} : "skip",
  );
  const recoverStaleGeneration = useMutation(api.generations.recoverStaleGeneration);
  const retryGeneration = useMutation(api.generations.retryGeneration);
  const generationForCurrentCall =
    latestGeneration && latestGeneration._id === sessionGenerationId
      ? latestGeneration
      : null;
  const generationQueryReady = Boolean(
    user?.id && latestGeneration !== undefined && generationQueryOwnerId === user.id,
  );
  const currentGenerationWasResumed =
    generationForCurrentCall !== null &&
    resumedGenerationId === generationForCurrentCall._id;
  const generationCallHasEnded =
    callEnded || (currentGenerationWasResumed && !callActive && !connecting);
  const shouldOpenProfile = Boolean(
    generationForCurrentCall?.status === "completed" &&
      !callActive &&
      !connecting &&
      generationCallHasEnded,
  );
  const generationPending =
    latestGeneration?.status === "queued" ||
    latestGeneration?.status === "generating";
  const retryAvailable =
    latestGeneration?.status === "failed" && latestGeneration.canRetry;

  const finishCall = useCallback((epoch: number) => {
    if (
      activeCallEpochRef.current !== epoch ||
      endedCallEpochRef.current === epoch
    ) return;

    endedCallEpochRef.current = epoch;
    activeCallEpochRef.current = null;
    startingCallEpochRef.current = null;
    vapiListenerCleanupRef.current?.();
    vapiListenerCleanupRef.current = null;
    vapiClientRef.current = null;
    callActiveRef.current = false;
    connectingRef.current = false;
    disconnectingRef.current = false;
    setCallActive(false);
    setConnecting(false);
    setDisconnecting(false);
    setIsSpeaking(false);
    setCallEnded(true);
  }, []);

  useEffect(() => {
    if (!user?.id || latestGeneration === undefined) return;

    if (initializedGenerationOwnerRef.current !== user.id) {
      initializedGenerationOwnerRef.current = user.id;
      callStartedInPageRef.current = false;
      generationBeforeCallRef.current = null;
      redirectingGenerationIdRef.current = null;

      const resumable =
        latestGeneration?.status === "queued" ||
        latestGeneration?.status === "generating";
      const generationId = resumable ? latestGeneration._id : null;
      setGenerationQueryOwnerId(user.id);
      setSessionGenerationId(generationId);
      setResumedGenerationId(generationId);
      setCallEnded(false);
      return;
    }

    if (
      callStartedInPageRef.current &&
      latestGeneration &&
      latestGeneration._id !== generationBeforeCallRef.current
    ) {
      setSessionGenerationId(latestGeneration._id);
      setResumedGenerationId(null);
    }
  }, [user?.id, latestGeneration]);

  useEffect(() => {
    if (!user?.id) return;
    void recoverStaleGeneration({}).catch(() => undefined);
  }, [user?.id, recoverStaleGeneration]);

  useEffect(() => {
    if (latestGeneration?.status !== "failed") setRetrying(false);
  }, [latestGeneration?.status]);

  // Keep Vapi's existing "Meeting has ended" suppression and restore it on unmount.
  useEffect(() => {
    const originalError = console.error;
    console.error = function (msg, ...args) {
      if (
        msg &&
        (msg.includes("Meeting has ended") ||
          (args[0] && args[0].toString().includes("Meeting has ended")))
      ) {
        console.log("Ignoring known error: Meeting has ended");
        return;
      }

      return originalError.call(console, msg, ...args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  useEffect(() => () => {
    vapiListenerCleanupRef.current?.();
    vapiListenerCleanupRef.current = null;
  }, []);

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const generationId = generationForCurrentCall?._id;
    if (
      !shouldOpenProfile ||
      !generationId ||
      redirectingGenerationIdRef.current === generationId
    ) return;

    redirectingGenerationIdRef.current = generationId;
    router.push("/profile");
  }, [generationForCurrentCall?._id, shouldOpenProfile, router]);

  const attachCallListeners = (client: Vapi, epoch: number) => {
    const handleCallStart = () => {
      console.log("Call started");
      if (
        activeCallEpochRef.current !== epoch ||
        startingCallEpochRef.current !== epoch
      ) return;
      callActiveRef.current = true;
      startingCallEpochRef.current = null;
      connectingRef.current = false;
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
    };

    const handleCallEnd = () => {
      console.log("Call ended");
      finishCall(epoch);
    };

    const handleSpeechStart = () => {
      if (activeCallEpochRef.current !== epoch) return;
      console.log("AI started Speaking");
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      if (activeCallEpochRef.current !== epoch) return;
      console.log("AI stopped Speaking");
      setIsSpeaking(false);
    };

    const handleMessage = (message: any) => {
      if (activeCallEpochRef.current !== epoch) return;
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { content: message.transcript, role: message.role };
        setMessages((previous) => [...previous, newMessage]);
      }
    };

    const handleError = () => {
      if (activeCallEpochRef.current !== epoch) return;
      console.log("Vapi call error");
      // An error does not always mean an active call disconnected. Let call-end
      // or the rejected start/stop promise reconcile that state.
    };

    client
      .on("call-start", handleCallStart)
      .on("call-end", handleCallEnd)
      .on("speech-start", handleSpeechStart)
      .on("speech-end", handleSpeechEnd)
      .on("message", handleMessage)
      .on("error", handleError);

    vapiListenerCleanupRef.current = () => {
      client
        .off("call-start", handleCallStart)
        .off("call-end", handleCallEnd)
        .off("speech-start", handleSpeechStart)
        .off("speech-end", handleSpeechEnd)
        .off("message", handleMessage)
        .off("error", handleError);
    };
  };

  const toggleCall = async () => {
    if (callActive) {
      const epoch = activeCallEpochRef.current;
      if (epoch === null || disconnectingRef.current) return;
      const client = vapiClientRef.current;
      if (!client) {
        finishCall(epoch);
        return;
      }

      disconnectingRef.current = true;
      setDisconnecting(true);
      try {
        await client.stop();
        // Vapi's call-end event normally performs this transition. The resolved
        // stop is also authoritative if that event was already emitted or missed.
        finishCall(epoch);
      } catch {
        // Keep the End Call action available if Vapi is still connected. If an
        // end event already arrived, finishCall has cleared this epoch already.
        if (activeCallEpochRef.current === epoch) {
          disconnectingRef.current = false;
          setDisconnecting(false);
        }
      }
      return;
    }
    if (
      connectingRef.current ||
      disconnectingRef.current ||
      retrying ||
      generationPending ||
      !generationQueryReady
    ) return;

    const epoch = ++callSequenceRef.current;
    activeCallEpochRef.current = epoch;
    startingCallEpochRef.current = epoch;
    endedCallEpochRef.current = null;
    callActiveRef.current = false;
    connectingRef.current = true;
    callStartedInPageRef.current = true;
    generationBeforeCallRef.current = latestGeneration?._id ?? null;
    redirectingGenerationIdRef.current = null;
    setSessionGenerationId(null);
    setResumedGenerationId(null);

    try {
      setConnecting(true);
      setMessages([]);
      setCallEnded(false);
      setRetryError(false);
      const fullName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : "There";

      const ticketResponse = await fetch("/api/vapi/generation-ticket", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!ticketResponse.ok) {
        throw new Error("Could not authorize this generation call.");
      }
      const { ticket } = (await ticketResponse.json()) as { ticket?: string };
      if (!ticket) throw new Error("Could not authorize this generation call.");

      const client = new Vapi(process.env.NEXT_PUBLIC_VAPI_API_KEY!);
      vapiClientRef.current = client;
      attachCallListeners(client, epoch);
      const startedCall = await client.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!, {
        variableValues: {
          full_name: fullName,
          user_id: user?.id,
          generation_ticket: ticket,
        },
      });
      if (activeCallEpochRef.current !== epoch) return;
      startingCallEpochRef.current = null;
      connectingRef.current = false;
      setConnecting(false);
      if (startedCall) {
        callActiveRef.current = true;
        setCallActive(true);
      } else {
        activeCallEpochRef.current = null;
        vapiListenerCleanupRef.current?.();
        vapiListenerCleanupRef.current = null;
        vapiClientRef.current = null;
        setCallActive(false);
      }
    } catch {
      console.log("Failed to start fitness coach call.");
      if (activeCallEpochRef.current === epoch) {
        activeCallEpochRef.current = null;
        startingCallEpochRef.current = null;
        callActiveRef.current = false;
        connectingRef.current = false;
        vapiListenerCleanupRef.current?.();
        vapiListenerCleanupRef.current = null;
        vapiClientRef.current = null;
        setCallActive(false);
        setConnecting(false);
      }
    }
  };

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Member";

  const coachStatus = generationCallHasEnded
    ? generationForCurrentCall?.status === "completed"
      ? "Plan ready"
      : generationForCurrentCall?.status === "failed"
        ? "Generation needs attention"
        : "Finishing your plan…"
    : connecting
      ? "Connecting…"
      : isSpeaking
        ? "Speaking…"
        : callActive
          ? "Listening…"
          : "Waiting…";

  const userStatus = connecting
    ? "Connecting…"
    : callActive
      ? "In conversation"
    : generationCallHasEnded && generationForCurrentCall?.status === "completed"
        ? "Complete"
      : generationCallHasEnded
        ? "Finishing"
        : "Ready";

  const handleRetryGeneration = async () => {
    if (!retryAvailable || !latestGeneration || retrying) return;
    setRetrying(true);
    setRetryError(false);
    try {
      const result = await retryGeneration({ generationId: latestGeneration._id });
      if (result.status === "queued" || result.status === "in_progress") {
        setSessionGenerationId(latestGeneration._id);
        setResumedGenerationId(latestGeneration._id);
      } else {
        setRetryError(true);
        setRetrying(false);
      }
    } catch {
      setRetryError(true);
      setRetrying(false);
    }
  };

  return (
    <div className="relative -mt-24 min-h-screen overflow-hidden bg-[#f4f7f7] text-[#172536]">
      <DashboardSidebar />

      <div className="min-h-screen lg:ml-60">
        <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <header className="relative isolate overflow-hidden rounded-3xl border border-[#dce8e7] bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8 lg:px-10">
            <div
              className="absolute inset-y-0 right-0 -z-10 hidden w-[48%] bg-contain bg-right bg-no-repeat opacity-90 sm:block"
              style={{ backgroundImage: "url('/dashboard-hero.png')" }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/95 to-white/30" aria-hidden="true" />
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#b9e6df] bg-[#e7f8f4] px-3 py-1.5 text-xs font-semibold text-[#087f7b]">
                <Zap className="size-3.5 fill-current" aria-hidden="true" />
                AI Powered
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#152131] sm:text-4xl lg:text-[2.65rem]">
                Generate Your Fitness Program
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#526276] sm:text-base">
                Let’s create a personalized workout and nutrition plan with AI to help you reach your goals.
              </p>
            </div>
          </header>

          {(generationPending || latestGeneration?.status === "failed") && (
            <Card
              aria-live="polite"
              className="rounded-2xl border-[#dce8e7] bg-white p-5 shadow-sm sm:p-6"
            >
              {generationPending ? (
                <div className="flex items-center gap-3 text-[#465463]">
                  <LoaderCircle className="size-5 animate-spin text-[#078f8b]" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-[#152131]">
                      {latestGeneration?.status === "queued"
                        ? "Your plan is queued"
                        : "Generating your plan"}
                    </h2>
                    <p className="mt-1 text-sm">
                      Your workout and nutrition plan will appear in your profile when ready.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-[#152131]">
                      {latestGeneration?.errorCode === "temporarily_unavailable"
                        ? "AI service temporarily unavailable"
                        : "We couldn’t generate your plan"}
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[#526276]">
                      {retryAvailable
                        ? "Your information is saved for a limited time. You can retry without repeating the conversation."
                        : "Please start a new coaching session to try again."}
                    </p>
                    {retryError && (
                      <p role="alert" className="mt-2 text-sm text-rose-700">
                        The retry could not be started. Please try again.
                      </p>
                    )}
                  </div>
                  {retryAvailable && (
                    <Button
                      type="button"
                      className="shrink-0 rounded-full bg-[#078f8b] px-5 text-white hover:bg-[#067b78]"
                      onClick={handleRetryGeneration}
                      disabled={retrying || generationPending}
                    >
                      {retrying ? (
                        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {retrying ? "Retrying…" : "Retry Generation"}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          <section aria-label="AI fitness coaching session" className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] lg:gap-3">
            <Card className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-colors ${isSpeaking ? "border-[#078f8b] ring-2 ring-[#078f8b]/10" : "border-[#dce6e8]"}`}>
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#e8f7f5]/80 to-transparent" aria-hidden="true" />
              <div className="relative flex min-h-[255px] flex-col justify-center p-5 sm:min-h-[278px] sm:p-7">
                <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#078f8b] px-3 py-1.5 text-xs font-semibold text-white sm:left-7 sm:top-7">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  AI Coach
                </span>
                <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className={`relative size-28 shrink-0 overflow-hidden rounded-full border-4 border-[#d9f2ee] bg-[#e8f7f5] shadow-md sm:size-32 ${isSpeaking ? "ring-4 ring-[#078f8b]/15" : ""}`}>
                    <Image
                      src="/hero-ai.png"
                      alt="AI FITNESS TRAINER coach avatar"
                      fill
                      sizes="128px"
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="whitespace-nowrap text-lg font-bold tracking-tight text-[#152131] sm:text-xl">AI <span className="text-[#078f8b]">FITNESS TRAINER</span></h2>
                    <p className="mt-1 text-sm font-medium text-[#526276]">Fitness &amp; Diet Coach</p>
                    <p className="mt-2 max-w-sm text-sm leading-5 text-slate-500">
                      Your personal AI fitness coach, ready to build a plan around your goals.
                    </p>
                    <StatusPill active={isSpeaking || callActive || connecting}>
                      {coachStatus}
                    </StatusPill>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex min-h-12 items-center justify-center lg:min-h-0" aria-hidden="true" />

            <Card className={`relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-colors ${callActive ? "border-[#078f8b] ring-2 ring-[#078f8b]/10" : "border-[#dce6e8]"}`}>
              <div className="relative flex min-h-[255px] flex-col justify-center p-5 sm:min-h-[278px] sm:p-7">
                <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#e1f6f2] px-3 py-1.5 text-xs font-semibold text-[#087f7b] sm:left-7 sm:top-7">
                  <UserIcon className="size-3.5" aria-hidden="true" />
                  You
                </span>
                <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#e0f2ef] bg-[#078f8b] text-4xl font-semibold text-white shadow-md sm:size-32">
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={`${displayName} profile photo`}
                        fill
                        sizes="128px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="max-w-full break-words text-xl font-bold text-[#152131] sm:text-2xl">{displayName}</h2>
                    <p className="mt-1 text-sm font-medium text-[#526276]">Active User</p>
                    <p className="mt-2 max-w-sm text-sm leading-5 text-slate-500">
                      Let’s work toward your fitness goals together.
                    </p>
                    <StatusPill active={callActive || connecting}>
                      {userStatus}
                    </StatusPill>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {messages.length > 0 && (
            <section
              ref={messageContainerRef}
              aria-label="Conversation transcript"
              aria-live="polite"
              className="max-h-64 w-full overflow-y-auto rounded-2xl border border-[#dce6e8] bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className="animate-fadeIn">
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      {message.role === "assistant" ? "AI FITNESS TRAINER" : "You"}
                    </p>
                    <p className="text-sm leading-6 text-[#26384a]">{message.content}</p>
                  </div>
                ))}
                {generationCallHasEnded && generationForCurrentCall?.status === "completed" && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-sm font-medium text-[#087f7b]">
                      Your fitness program has been created. Redirecting to your profile…
                    </p>
                  </div>
                )}
                {generationCallHasEnded && generationPending && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-sm font-medium text-[#087f7b]">
                      Your conversation is complete. We’re finishing your plan…
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="flex flex-col items-center gap-3 py-1 text-center">
            <Button
              type="button"
              className={`relative h-14 min-w-56 rounded-full px-8 text-base font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2 ${
                callActive
                  ? "bg-rose-600 hover:bg-rose-700"
                  : shouldOpenProfile
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#078f8b] hover:bg-[#067b78]"
              }`}
              onClick={toggleCall}
              disabled={connecting || disconnecting || (!callActive && (retrying || generationPending || !generationQueryReady || shouldOpenProfile))}
            >
              {connecting || disconnecting ? (
                <LoaderCircle className="mr-2 size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Phone className="mr-2 size-5" aria-hidden="true" />
              )}
              {callActive
                ? disconnecting ? "Ending Call…" : "End Call"
                : connecting
                  ? "Connecting…"
                  : shouldOpenProfile
                    ? "Opening Profile…"
                    : "Start Call"}
              {!callActive && !connecting && !callEnded && (
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              )}
            </Button>
            <p className="text-sm text-[#526276]">
              Talk to your AI coach and get a personalized fitness plan.
            </p>
          </div>

          <section aria-label="How AI FITNESS TRAINER helps" className="grid overflow-hidden rounded-2xl border border-[#dce6e8] bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <FeatureItem
              icon={<Zap className="size-7 fill-current" aria-hidden="true" />}
              title="Personalized Plans"
              description="Get a custom workout and nutrition plan from your AI coach."
            />
            <FeatureItem
              icon={<ChartNoAxesColumnIncreasing className="size-7" aria-hidden="true" />}
              title="Track Progress"
              description="Find your saved fitness plans anytime in your profile."
            />
            <FeatureItem
              icon={<Heart className="size-7 fill-current" aria-hidden="true" />}
              title="Achieve Goals"
              description="Talk through the goals you want your plan to support."
            />
          </section>
        </div>
      </div>
    </div>
  );
};

function StatusPill({ children, active }: { children: string; active: boolean }) {
  return (
    <div
      role="status"
      className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-[#b9e6df] bg-[#e3f8f3] text-[#087f7b]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <span className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
      {children}
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-[#e4ebed] p-5 last:border-b-0 sm:p-6 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f6f2] text-[#078f8b]">
        {icon}
      </span>
      <div>
        <h2 className="font-semibold text-[#172536]">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default GenerateProgramPage;
