"use client";

import {
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useSession,
} from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const DASHBOARD_PATH = "/dashboard";
const TASK_ROUTE_PATH = "/sign-in/tasks";
const AUTH_RETURN_TO_KEY = "codeflex.oauth.returnTo";

function getSafeReturnTo(candidate: string | null, origin: string) {
  if (!candidate || candidate.startsWith("//") || candidate.includes("\\")) {
    return DASHBOARD_PATH;
  }

  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return DASHBOARD_PATH;

    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === TASK_ROUTE_PATH) return DASHBOARD_PATH;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DASHBOARD_PATH;
  }
}

function RecoveryOptions({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-[#586b8c]">
      <p role="alert" className="text-sm leading-6">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[#079b98] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#078d8a]"
        >
          Retry
        </button>
        <Link
          href="/sign-in"
          className="rounded-lg border border-[#cce7e5] px-4 py-2 text-sm font-semibold text-[#078d8a] hover:bg-[#eff8f7]"
        >
          Return to sign in
        </Link>
      </div>
    </main>
  );
}

export default function SignInSessionTasks({ returnTo }: { returnTo: string | null }) {
  const { isLoaded, isSignedIn, session } = useSession();
  const [redirectUrlComplete, setRedirectUrlComplete] = useState<string | null>(null);
  const task = session?.currentTask?.key;

  useEffect(() => {
    const savedReturnTo = window.sessionStorage.getItem(AUTH_RETURN_TO_KEY);
    const candidate = returnTo ?? savedReturnTo;
    setRedirectUrlComplete(getSafeReturnTo(candidate, window.location.origin));
  }, [returnTo]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !session || !redirectUrlComplete || task) return;
    if (session.status !== "active") return;

    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    window.location.replace(redirectUrlComplete);
  }, [isLoaded, isSignedIn, session, task, redirectUrlComplete]);

  if (!isLoaded || !redirectUrlComplete) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex min-h-[50vh] items-center justify-center gap-3 px-6 text-sm text-[#586b8c]"
      >
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-[#dce9e7] border-t-[#078f8b]"
        />
        Checking your secure session…
      </main>
    );
  }

  const hasPendingTask = session?.status === "pending" && Boolean(task);

  if (hasPendingTask && task === "choose-organization") {
    return <TaskChooseOrganization redirectUrlComplete={redirectUrlComplete} />;
  }
  if (hasPendingTask && task === "reset-password") {
    return <TaskResetPassword redirectUrlComplete={redirectUrlComplete} />;
  }
  if (hasPendingTask && task === "setup-mfa") {
    return <TaskSetupMFA redirectUrlComplete={redirectUrlComplete} />;
  }
  if (hasPendingTask) {
    return (
      <main
        role="alert"
        className="mx-auto mt-16 max-w-xl p-8 text-center text-[#0b1f42]"
      >
        This account has a required step that this app version cannot safely complete. Your session remains pending. Contact support or return to{" "}
        <Link className="text-[#079b98]" href="/sign-in">
          Sign In
        </Link>
        .
      </main>
    );
  }

  if (task || !isSignedIn || !session || session.status !== "active") {
    return (
      <RecoveryOptions message="Your sign-in could not be confirmed as active. Return to sign in and try again." />
    );
  }

  return null;
}
