"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useState, type FormEvent } from "react";

function safeReturnTo() {
  const saved = sessionStorage.getItem("codeflex.oauth.returnTo") ?? "/dashboard";
  if (saved.startsWith("//") || saved.includes("\\")) return "/dashboard";
  try {
    const url = new URL(saved, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function getError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors?.[0]) return errors[0].longMessage ?? errors[0].message ?? "Unable to continue sign up.";
  }
  return "Unable to continue this sign up safely. Restart with Google or GitHub, or contact support.";
}

export default function OAuthSignUpContinuation() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [password, setPassword] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!isLoaded || !signUp || !setActive) return <main className="flex min-h-screen items-center justify-center">Loading secure account setup…</main>;

  const continueToFinish = async () => {
    if (signUp.status === "complete" && signUp.createdSessionId) {
      const returnTo = safeReturnTo();
      await setActive({
        session: signUp.createdSessionId,
        navigate: ({ session }) => {
          if (session.currentTask) {
            window.location.assign(`/sign-in/tasks?returnTo=${encodeURIComponent(returnTo)}`);
          } else window.location.assign(returnTo);
        },
      });
      return;
    }
    if (signUp.status !== "missing_requirements") {
      throw new Error(`Unexpected sign-up status: ${String(signUp.status)}.`);
    }

    const supportedMissing = signUp.missingFields.every((field) => field === "password" || field === "first_name" || field === "last_name" || field === "email_address");
    const supportedUnverified = signUp.unverifiedFields.every((field) => field === "email_address");
    if (!supportedMissing || !supportedUnverified) {
      throw new Error("This OAuth sign up requires information this continuation page cannot safely collect. Restart sign up or contact support.");
    }

    const update: { password?: string; emailAddress?: string; firstName?: string; lastName?: string } = {};
    if (signUp.missingFields.includes("password")) {
      if (!password) throw new Error("Create a password to finish setting up this account.");
      update.password = password;
    }
    if (signUp.missingFields.includes("email_address")) {
      if (!emailAddress.trim()) throw new Error("Enter an email address to finish setting up this account.");
      update.emailAddress = emailAddress.trim();
    }
    if (signUp.missingFields.includes("first_name")) {
      if (!firstName.trim()) throw new Error("Enter your first name to finish setting up this account.");
      update.firstName = firstName.trim();
    }
    if (signUp.missingFields.includes("last_name")) {
      if (!lastName.trim()) throw new Error("Enter your last name to finish setting up this account.");
      update.lastName = lastName.trim();
    }
    let currentSignUp = signUp;
    if (Object.keys(update).length) currentSignUp = await signUp.update(update);

    if (currentSignUp.unverifiedFields.includes("email_address")) {
      if (!verificationSent) {
        await currentSignUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setVerificationSent(true);
        setNotice(`A verification code was sent to ${currentSignUp.emailAddress}.`);
        return;
      }
      if (!code.trim()) throw new Error("Enter the email verification code to continue.");
      currentSignUp = await currentSignUp.attemptEmailAddressVerification({ code: code.trim() });
    }

    if (currentSignUp.status === "complete" && currentSignUp.createdSessionId) {
      const returnTo = safeReturnTo();
      await setActive({
        session: currentSignUp.createdSessionId,
        navigate: ({ session }) => {
          if (session.currentTask) window.location.assign(`/sign-in/tasks?returnTo=${encodeURIComponent(returnTo)}`);
          else window.location.assign(returnTo);
        },
      });
    } else {
      setNotice("Your information was saved. Complete any remaining required steps, then continue.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await continueToFinish();
    } catch (reason) {
      setError(getError(reason));
    } finally {
      setBusy(false);
    }
  };

  const hasEmail = Boolean(signUp.emailAddress);
  const needsPassword = signUp.missingFields.includes("password");
  const needsEmail = signUp.missingFields.includes("email_address");
  const needsFirstName = signUp.missingFields.includes("first_name");
  const needsLastName = signUp.missingFields.includes("last_name");
  const needsEmailVerification = signUp.unverifiedFields.includes("email_address");

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-8">
      <section className="w-full max-w-[520px] rounded-[24px] border border-[#dce4ef] bg-white p-8 shadow-[0_16px_38px_rgba(30,58,96,0.07)]">
        <h1 className="text-center text-2xl font-bold text-[#0b1f42]">Finish setting up your account</h1>
        <p className="mt-3 text-center text-sm leading-6 text-[#586b8c]">Clerk requires these steps to complete your Google or GitHub sign up.</p>
        {hasEmail && <p className="mt-5 text-center text-sm text-[#243b63]">Account email: <strong>{signUp.emailAddress}</strong></p>}
        <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-4">
          {needsPassword && <label className="flex flex-col gap-2 text-sm font-semibold text-[#0b1f42]">Create a password<input required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border border-[#dce4ef] px-4 font-normal outline-none focus:border-[#079b98]" /></label>}
          {needsEmail && <label className="flex flex-col gap-2 text-sm font-semibold text-[#0b1f42]">Email address<input required type="email" autoComplete="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} className="h-12 rounded-xl border border-[#dce4ef] px-4 font-normal outline-none focus:border-[#079b98]" /></label>}
          {needsFirstName && <label className="flex flex-col gap-2 text-sm font-semibold text-[#0b1f42]">First name<input required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-12 rounded-xl border border-[#dce4ef] px-4 font-normal outline-none focus:border-[#079b98]" /></label>}
          {needsLastName && <label className="flex flex-col gap-2 text-sm font-semibold text-[#0b1f42]">Last name<input required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} className="h-12 rounded-xl border border-[#dce4ef] px-4 font-normal outline-none focus:border-[#079b98]" /></label>}
          {needsEmailVerification && verificationSent && <label className="flex flex-col gap-2 text-sm font-semibold text-[#0b1f42]">Email verification code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-12 rounded-xl border border-[#dce4ef] px-4 font-normal outline-none focus:border-[#079b98]" /></label>}
          {notice && <p role="status" className="text-sm leading-5 text-[#586b8c]">{notice}</p>}
          {error && <p role="alert" className="text-sm leading-5 text-red-600">{error}</p>}
          <button disabled={busy} className="h-12 rounded-xl bg-[#079b98] font-semibold text-white hover:bg-[#078d8a] disabled:opacity-60">{busy ? "Please wait…" : needsEmailVerification && !verificationSent ? "Send verification code" : "Continue"}</button>
        </form>
        <Link href="/sign-in" className="mt-5 block text-center text-sm font-medium text-[#079b98]">Return to sign in</Link>
      </section>
    </main>
  );
}
