import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import SignInForm from "@/components/auth/SignInForm";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`flex items-center ${compact ? "gap-2" : "flex-col gap-0"}`}>
      <svg
        aria-hidden="true"
        className={compact ? "h-7 w-9 text-[#079b98]" : "h-8 w-[60px] text-[#079b98]"}
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
      <span className={compact ? "whitespace-nowrap text-[10px] font-bold leading-none tracking-[-0.04em] text-[#0b1f42] sm:text-sm" : "whitespace-nowrap text-[20px] font-bold leading-6 tracking-[-0.04em] text-[#0b1f42] sm:text-[22px]"}>
        AI <span className="text-[#079b98]">FITNESS TRAINER</span>
      </span>
    </span>
  );
}

export default async function SignInPage() {
  const { userId } = await auth();
  const homeHref = userId ? "/dashboard" : "/";

  return (
    <div className="-mt-24 min-h-screen bg-white">
      <header className="h-16 border-b border-[#e7edf4] md:h-[72px]">
        <nav aria-label="Main navigation" className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href={homeHref} aria-label="AI FITNESS TRAINER home" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#079b98]">
            <BrandMark compact />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              aria-current="page"
              className="rounded-lg border border-[#cce7e5] bg-[#eff8f7] px-3 py-2 text-xs font-semibold text-[#078d8a] sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#079b98] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#078d8a] sm:px-4 sm:text-sm"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-8 md:min-h-[calc(100vh-72px)] sm:px-6">
        <section
          aria-labelledby="sign-in-heading"
          className="w-full max-w-[500px] rounded-[20px] border border-[#dce4ef] bg-white px-5 pb-6 pt-7 shadow-[0_12px_30px_rgba(30,58,96,0.06)] sm:px-8"
        >
          <Link
            href={homeHref}
            aria-label="AI FITNESS TRAINER home"
            className="mx-auto mb-[18px] flex w-fit flex-col items-center"
          >
            <BrandMark />
          </Link>

          <header className="mb-5 text-center">
            <h1
              id="sign-in-heading"
              className="text-[26px] font-bold leading-[32px] tracking-[0.5px] text-[#0b1f42] sm:text-[28px]"
            >
              Welcome Back
            </h1>
            <p className="mt-1 text-sm leading-5 tracking-[0.15px] text-[#586b8c]">
              Sign in to continue your fitness journey
            </p>
          </header>

          <SignInForm />

          <p className="mt-5 text-center text-sm leading-5 tracking-[0.1px] text-[#243b63]">
            Don&apos;t have an account?
            <Link
              href="/sign-up"
              className="ml-1 font-semibold text-[#079b98] hover:text-[#078d8a]"
            >
              Sign up
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
