"use client";

import { ClerkProvider, useAuth, useSession } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const AUTH_RETURN_TO_KEY = "codeflex.oauth.returnTo";

function getSafeReturnTo(candidate: string | null) {
  if (!candidate || candidate.startsWith("//") || candidate.includes("\\")) return null;

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname.replace(/\/+$/, "") === "/sign-in/tasks") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function ClearCompletedAuthReturnTo() {
  const { isLoaded, isSignedIn, session } = useSession();
  const pathname = usePathname();
  const isAuthEntryRoute = pathname === "/sign-in" || pathname === "/sign-up";
  const isAuthFlowRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  useEffect(() => {
    if (!isLoaded) return;

    if (isAuthEntryRoute) {
      const candidate = new URLSearchParams(window.location.search).get("redirect_url");
      const safeReturnTo = getSafeReturnTo(candidate);
      if (safeReturnTo) window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, safeReturnTo);
      else window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
      return;
    }

    if (!isSignedIn || session?.status !== "active" || isAuthFlowRoute) return;
    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  }, [isLoaded, isSignedIn, session?.status, isAuthEntryRoute, isAuthFlowRoute]);

  return null;
}

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignInRoute = pathname === "/sign-in" || pathname.startsWith("/sign-in/");

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      afterSignOutUrl="/"
      taskUrls={{
        "choose-organization": "/sign-in/tasks",
        "reset-password": "/sign-in/tasks",
        "setup-mfa": "/sign-in/tasks",
      }}
      localization={
        isSignInRoute
          ? {
              formButtonPrimary: "Sign In →",
              socialButtonsBlockButton: "Continue with {{provider}}",
              socialButtonsBlockButtonManyInView: "Continue with {{provider}}",
            }
          : undefined
      }
    >
      <ClearCompletedAuthReturnTo />
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default ConvexClerkProvider;
