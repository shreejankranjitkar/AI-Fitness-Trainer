"use client";

import { useSignIn } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";

type Mode = "password" | "factor" | "recovery";

function getSafeReturnTo() {
  const candidate = new URLSearchParams(window.location.search).get("redirect_url");
  if (!candidate || candidate.startsWith("//") || candidate.includes("\\")) return "/dashboard";

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.pathname.replace(/\/+$/, "") === "/sign-in/tasks") return "/dashboard";
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    if (errors?.[0]) return errors[0].longMessage ?? errors[0].message ?? "Unable to sign in.";
  }
  return "Unable to complete sign in. Please try again.";
}

function Icon({ kind }: { kind: "google" | "github" | "email" | "lock" | "eye" }) {
  if (kind === "google") {
    return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-6 w-6"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 2-6.8 2-5.2 0-9.7-3.5-11.3-8.2H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.9a12 12 0 0 1 0-7.8v-5.3H5.8a20 20 0 0 0 0 18.4l6.9-5.3Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 14.8l6.9 5.3C14.3 15.4 18.8 11.9 24 11.9Z"/></svg>;
  }
  if (kind === "github") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-[#0b1f42]"><path d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.8 2.4 3.9 1.7.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.1 1.1-2.9-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10.5 10.5 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.7 1.1 2.9 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2v3c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9Z"/></svg>;
  }
  if (kind === "email") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#7183a0] stroke-[2.5]"><rect x="2.5" y="5" width="19" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>;
  if (kind === "lock") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#7183a0] stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export default function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorStrategy, setFactorStrategy] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!isLoaded || !signIn || !setActive) return <div className="h-64" aria-label="Loading sign in" />;

  const finish = async (sessionId: string) => {
    const returnTo = getSafeReturnTo();
    sessionStorage.setItem("codeflex.oauth.returnTo", returnTo);
    await setActive({
      session: sessionId,
      navigate: ({ session }) => {
        if (session.currentTask) {
          const taskKey = session.currentTask.key;
          if (["choose-organization", "reset-password", "setup-mfa"].includes(taskKey)) {
            window.location.assign(`/sign-in/tasks?returnTo=${encodeURIComponent(returnTo)}`);
            return;
          }
          window.location.assign(`/sign-in/tasks?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        sessionStorage.removeItem("codeflex.oauth.returnTo");
        window.location.assign(returnTo);
      },
    });
  };

  const handleError = (reason: unknown) => setError(errorMessage(reason));

  const startOAuth = async (strategy: "oauth_google" | "oauth_github") => {
    if (!isLoaded) return;
    setBusy(true);
    setError("");
    try {
      const returnTo = getSafeReturnTo();
      sessionStorage.setItem("codeflex.oauth.returnTo", returnTo);
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: returnTo,
        continueSignUp: true,
      });
    } catch (reason) {
      handleError(reason);
      setBusy(false);
    }
  };

  const startSecondFactor = async () => {
    const available = signIn.supportedSecondFactors ?? [];
    if (signIn.clientTrustState === "pending") {
      const deviceTrustFactor = available.find((factor) => factor.strategy === "email_code");
      if (!deviceTrustFactor) {
        throw new Error("Clerk requires a Device Trust challenge, but this SDK response did not include its supported email-code challenge. Sign in through Clerk support or try a trusted device.");
      }
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: deviceTrustFactor.emailAddressId });
      setFactorStrategy("email_code");
      setNotice(`Device Trust check: enter the code sent to ${deviceTrustFactor.safeIdentifier}.`);
      setMode("factor");
      return;
    }
    const selected = available.find((factor) => factor.strategy === "email_code")
      ?? available.find((factor) => factor.strategy === "phone_code")
      ?? available.find((factor) => factor.strategy === "totp")
      ?? available.find((factor) => factor.strategy === "backup_code");
    if (!selected) throw new Error("This account requires a verification method that this sign-in page cannot safely complete. Use the Clerk-hosted sign-in recovery route or contact support.");

    setFactorStrategy(selected.strategy);
    if (selected.strategy === "email_code") {
      await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: selected.emailAddressId });
      setNotice(`Enter the verification code sent to ${selected.safeIdentifier}.`);
    } else if (selected.strategy === "phone_code") {
      await signIn.prepareSecondFactor({ strategy: "phone_code", phoneNumberId: selected.phoneNumberId });
      setNotice(`Enter the verification code sent to ${selected.safeIdentifier}.`);
    } else if (selected.strategy === "totp") {
      setNotice("Enter the code from your authenticator app.");
    } else if (selected.strategy === "backup_code") {
      setNotice("Enter one of your backup codes.");
    }
    setMode("factor");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "password") {
        const attempt = await signIn.create({ identifier: email });
        if (attempt.status !== "needs_first_factor") throw new Error(`Unexpected sign-in status: ${String(attempt.status)}. Please restart sign-in.`);
        const result = await attempt.attemptFirstFactor({ strategy: "password", password });
        if (result.status === "complete" && result.createdSessionId) await finish(result.createdSessionId);
        else if (result.status === "needs_second_factor") await startSecondFactor();
        else if (result.status === "needs_new_password") {
          const reset = await signIn.create({ strategy: "reset_password_email_code", identifier: email });
          if (reset.status !== "needs_first_factor") throw new Error(`Unexpected password recovery status: ${String(reset.status)}.`);
          setMode("recovery");
          setNotice("Your password must be updated. A reset code was sent to your email; enter it with a new password.");
        } else throw new Error(`Unsupported sign-in status: ${String(result.status)}. Please restart sign-in.`);
      } else if (mode === "recovery") {
        const result = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password });
        if (result.status === "complete" && result.createdSessionId) await finish(result.createdSessionId);
        else if (result.status === "needs_second_factor") await startSecondFactor();
        else throw new Error(`Unsupported password recovery status: ${String(result.status)}. Restart password recovery.`);
      } else {
        let result;
        if (factorStrategy === "email_code" || factorStrategy === "phone_code") {
          result = await signIn.attemptSecondFactor({ strategy: factorStrategy, code });
        } else if (factorStrategy === "totp") {
          result = await signIn.attemptSecondFactor({ strategy: "totp", code });
        } else if (factorStrategy === "backup_code") {
          result = await signIn.attemptSecondFactor({ strategy: "backup_code", code });
        } else throw new Error("Unsupported verification method. Restart sign in.");

        if (result.status === "complete" && result.createdSessionId) await finish(result.createdSessionId);
        else throw new Error(`Unsupported verification status: ${String(result.status)}. Restart sign in.`);
      }
    } catch (reason) {
      handleError(reason);
    } finally {
      setBusy(false);
    }
  };

  const beginRecovery = async () => {
    if (!isLoaded || !email.trim()) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      if (result.status !== "needs_first_factor") throw new Error(`Unexpected password recovery status: ${String(result.status)}.`);
      setMode("recovery");
      setNotice("A password reset code was sent to your email. Enter the code and your new password.");
    } catch (reason) {
      handleError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {mode === "password" && <div className="grid gap-2"><button type="button" disabled={busy} onClick={() => void startOAuth("oauth_google")} className="flex h-12 w-full items-center justify-center gap-4 rounded-xl border border-[#dce4ef] bg-white text-[15px] font-medium tracking-[-0.01em] text-[#0b1f42] hover:bg-[#f8fafc] disabled:opacity-60"><Icon kind="google" />Continue with Google</button><button type="button" disabled={busy} onClick={() => void startOAuth("oauth_github")} className="flex h-12 w-full items-center justify-center gap-4 rounded-xl border border-[#dce4ef] bg-white text-[15px] font-medium tracking-[-0.01em] text-[#0b1f42] hover:bg-[#f8fafc] disabled:opacity-60"><Icon kind="github" />Continue with GitHub</button></div>}

      {mode === "password" && <div className="my-[18px] flex items-center gap-3"><span className="h-px flex-1 bg-[#dce4ef]"/><span className="text-[13px] font-medium leading-4 text-[#586b8c]">or</span><span className="h-px flex-1 bg-[#dce4ef]"/></div>}

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[15px] font-semibold tracking-[0.1px] text-[#0b1f42]">
          {mode === "factor" ? "Verification code" : mode === "recovery" ? "Reset code" : "Email address"}
          <span className="relative block">
            {mode === "password" && <span className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2"><Icon kind="email" /></span>}
            <input required autoComplete={mode === "password" ? "email" : "one-time-code"} type={mode === "password" ? "email" : "text"} value={mode === "password" ? email : code} onChange={(event) => mode === "password" ? setEmail(event.target.value) : setCode(event.target.value)} placeholder={mode === "password" ? "Enter your email address" : "Enter verification code"} className="h-12 w-full rounded-xl border border-[#dce4ef] bg-white pl-14 pr-4 text-[15px] font-normal tracking-normal text-[#0b1f42] outline-none placeholder:text-[#8999b3] focus:border-[#079b98]" />
          </span>
        </label>

        {mode !== "factor" && <div className="flex flex-col gap-1 text-[15px] font-semibold tracking-[0.1px] text-[#0b1f42]">
          <div className="flex min-h-6 items-center justify-between">
            <label htmlFor="sign-in-password">{mode === "recovery" ? "New password" : "Password"}</label>
            {mode === "password" && <button type="button" onClick={() => void beginRecovery()} disabled={busy} className="text-xs font-medium tracking-normal text-[#079b98] hover:text-[#078d8a]">Forgot password?</button>}
          </div>
          <span className="relative block">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2"><Icon kind="lock" /></span>
            <input id="sign-in-password" required autoComplete={mode === "recovery" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "recovery" ? "Enter a new password" : "Enter your password"} className="h-12 w-full rounded-xl border border-[#dce4ef] bg-white pl-14 pr-12 text-[15px] font-normal tracking-normal text-[#0b1f42] outline-none placeholder:text-[#8999b3] focus:border-[#079b98]" />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7183a0]"><Icon kind="eye" /></button>
          </span>
        </div>}
        {notice && <p role="status" className="text-sm leading-5 text-[#586b8c]">{notice}</p>}
        {error && <p role="alert" className="text-sm leading-5 text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#079b98] text-[16px] font-semibold text-white transition-colors hover:bg-[#078d8a] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Please wait…" : mode === "password" ? "Sign In" : mode === "recovery" ? "Reset password" : "Verify"}{!busy && mode === "password" && <span aria-hidden="true" className="text-xl leading-none">→</span>}</button>
        {mode !== "password" && <button type="button" onClick={() => { setMode("password"); setCode(""); setError(""); setNotice(""); }} className="self-center text-sm font-medium text-[#079b98] hover:text-[#078d8a]">Back to sign in</button>}
      </form>
    </div>
  );
}
