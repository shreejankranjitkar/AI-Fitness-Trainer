"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { DumbbellIcon, LayoutDashboard, UserIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";

const Navbar = () => {
  const { isSignedIn } = useUser();
  const pathname = usePathname();
  const isPublicHome = pathname === "/";
  const isSignInRoute = pathname === "/sign-in" || pathname.startsWith("/sign-in/");
  const isSignUpRoute = pathname === "/sign-up" || pathname.startsWith("/sign-up/");

  if (isSignUpRoute) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#e7edf4] bg-white md:h-[72px]">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8"
        >
          <Link href={isSignedIn ? "/dashboard" : "/"} aria-label="AI FITNESS TRAINER home" className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-7 w-9 text-[#079b98]"
              viewBox="0 0 110 58"
              fill="currentColor"
            >
              <g transform="translate(-7.15 0) scale(1.14 1)">
                <rect x="8" y="18" width="7" height="22" rx="3.5" />
                <rect x="19" y="10" width="8" height="38" rx="4" />
                <rect x="31" y="2" width="9" height="54" rx="4.5" />
                <rect x="43" y="24" width="24" height="10" rx="5" />
                <rect x="70" y="2" width="9" height="54" rx="4.5" />
                <rect x="83" y="10" width="8" height="38" rx="4" />
                <rect x="95" y="18" width="7" height="22" rx="3.5" />
              </g>
            </svg>
            <span className="whitespace-nowrap text-[10px] font-bold leading-none tracking-[-0.04em] text-[#0b1f42] sm:text-sm">
              AI <span className="text-[#079b98]">FITNESS TRAINER</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg bg-[#079b98] px-3 py-2 text-xs font-semibold text-white hover:bg-[#078d8a] sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              aria-current="page"
              className="rounded-lg border border-[#cce7e5] bg-[#eff8f7] px-3 py-2 text-xs font-semibold text-[#078d8a] sm:px-4 sm:text-sm"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>
    );
  }

  if (
    isSignInRoute ||
    pathname === "/dashboard" ||
    pathname === "/profile" ||
    pathname === "/generate-program"
  ) return null;

  return (
    <header
      className={
        isPublicHome
          ? "fixed inset-x-0 top-0 z-50 border-b border-[#e5e2dc] bg-[#fbf9f5]/95 py-3 text-[#152131] backdrop-blur-md"
          : "fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-md border-b border-border py-3"
      }
    >
      <div className={isPublicHome ? "container mx-auto flex items-center justify-between px-4" : "container mx-auto flex items-center justify-between"}>
        {/* LOGO */}
        <Link href={isSignedIn ? "/dashboard" : "/"} className={isPublicHome ? "flex items-center gap-2.5" : "flex items-center gap-2"}>
          <div className={isPublicHome ? "text-[#078f8b]" : "p-1 bg-primary/10 rounded"}>
            {isPublicHome ? (
              <DumbbellIcon className="h-7 w-7" strokeWidth={2.4} />
            ) : (
              <ZapIcon className="w-4 h-4 text-primary" />
            )}
          </div>
          <span className={isPublicHome ? "whitespace-nowrap text-[10px] font-bold tracking-[-0.04em] sm:text-sm md:text-base" : "whitespace-nowrap text-xs font-bold tracking-tight sm:text-sm"}>
            AI <span className={isPublicHome ? "text-[#078f8b]" : "text-primary"}>FITNESS TRAINER</span>
          </span>
        </Link>

        {/* NAVIGATION */}
        <nav className={isPublicHome ? "flex items-center gap-2 sm:gap-5" : "flex items-center gap-5"}>
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className={isPublicHome ? "flex items-center gap-1.5 text-sm font-medium text-[#465463] transition-colors hover:text-[#078f8b]" : "flex items-center gap-1.5 text-sm hover:text-primary transition-colors"}
              >
                <LayoutDashboard size={16} />
                <span className={isPublicHome ? "hidden sm:inline" : undefined}>Dashboard</span>
              </Link>

              <Link
                href="/generate-program"
                className={isPublicHome ? "flex items-center gap-1.5 text-sm font-medium text-[#465463] transition-colors hover:text-[#078f8b]" : "flex items-center gap-1.5 text-sm hover:text-primary transition-colors"}
              >
                <DumbbellIcon size={16} />
                <span className={isPublicHome ? "hidden sm:inline" : undefined}>Generate</span>
              </Link>

              <Link
                href="/profile"
                className={isPublicHome ? "flex items-center gap-1.5 text-sm font-medium text-[#465463] transition-colors hover:text-[#078f8b]" : "flex items-center gap-1.5 text-sm hover:text-primary transition-colors"}
              >
                <UserIcon size={16} />
                <span className={isPublicHome ? "hidden sm:inline" : undefined}>Profile</span>
              </Link>
              <Button
                asChild
                variant="outline"
                className={isPublicHome ? "ml-1 rounded-full border-[#078f8b] bg-transparent text-[#087f7b] hover:bg-[#e5f4f1]" : "ml-2 border-primary/50 text-primary hover:text-white hover:bg-primary/10"}
              >
                <Link href="/generate-program">Get Started</Link>
              </Button>
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton>
                <Button
                  variant={"outline"}
                  className={isPublicHome ? "rounded-full border-[#9ca5ad] bg-white/70 px-4 text-[#152131] hover:bg-white" : "border-primary/50 text-primary hover:text-white hover:bg-primary/10"}
                >
                  {isPublicHome ? "Sign in" : "Sign In"}
                </Button>
              </SignInButton>

              <SignUpButton>
                <Button className={isPublicHome ? "rounded-full bg-[#078f8b] px-4 text-white hover:bg-[#067b78]" : "bg-primary text-primary-foreground hover:bg-primary/90"}>
                  {isPublicHome ? "Sign up" : "Sign Up"}
                </Button>
              </SignUpButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
export default Navbar;
