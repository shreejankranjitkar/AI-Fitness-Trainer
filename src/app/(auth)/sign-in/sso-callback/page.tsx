"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignInOAuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-[#586b8c]">
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-in/oauth-continue"
        continueSignUpUrl="/sign-in/oauth-continue"
      />
      Completing secure sign in…
    </main>
  );
}
