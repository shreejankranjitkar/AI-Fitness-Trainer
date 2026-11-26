import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const signUpAppearance = {
  layout: {
    logoPlacement: "none" as const,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#079b98",
    colorForeground: "#0b1f42",
    colorMutedForeground: "#586b8c",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0b1f42",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), sans-serif",
  },
  elements: {
    rootBox: { width: "100%", maxWidth: "none" },
    cardBox: {
      width: "100%",
      maxWidth: "none",
      overflow: "visible",
      border: 0,
      borderRadius: 0,
      background: "transparent",
      padding: 0,
      boxShadow: "none",
    },
    card: {
      width: "100%",
      maxWidth: "none",
      overflow: "visible",
      border: 0,
      borderRadius: 0,
      background: "transparent",
      padding: 0,
      margin: 0,
      boxShadow: "none",
    },
    logoBox: "hidden",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    main: { width: "100%", maxWidth: "none", padding: 0, margin: 0, gap: 0 },
    socialButtonsRoot: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
      width: "100%",
      maxWidth: "none",
    },
    socialButtons: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
      width: "100%",
      maxWidth: "none",
    },
    socialButtonsBlockButton: {
      width: "100%",
      maxWidth: "none",
      height: "48px",
      borderRadius: "12px",
      border: "1px solid #dce4ef",
      background: "#ffffff",
      color: "#0b1f42",
      boxShadow: "none",
      transition: "background-color 150ms ease",
      "&:hover": { background: "#f8fafc" },
    },
    socialButtonsBlockButtonText: {
      fontSize: "15px",
      fontWeight: 500,
      letterSpacing: "-0.01em",
    },
    socialButtonsProviderIcon: { width: "24px", height: "24px" },
    dividerRow: { marginTop: "18px", marginBottom: "14px" },
    dividerLine: "bg-[#dce4ef]",
    dividerText: "text-[13px] leading-4 font-medium text-[#586b8c]",
    formContainer: { width: "100%", maxWidth: "none" },
    form: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      width: "100%",
      maxWidth: "none",
    },
    formFieldLabel: {
      fontSize: "15px",
      lineHeight: "22px",
      fontWeight: 600,
      letterSpacing: "0.1px",
      color: "#0b1f42",
      marginBottom: "4px",
    },
    formFieldRow: { overflow: "visible", marginBottom: "-12px" },
    formFieldInput: {
      height: "48px",
      minHeight: "48px",
      borderRadius: "12px",
      border: "1px solid #dce4ef",
      background: "#ffffff",
      color: "#0b1f42",
      fontSize: "15px",
      paddingLeft: "16px",
      boxShadow: "none",
      "&::placeholder": { color: "#8999b3" },
      "&:focus": { borderColor: "#079b98", boxShadow: "none" },
    },
    formFieldInputGroup: { height: "48px", width: "100%" },
    formFieldInputShowPasswordButton: "text-[#7183a0]",
    formFieldInputShowPasswordIcon: "text-[#7183a0]",
    formButtonPrimary: {
      marginTop: "4px",
      height: "48px",
      minHeight: "48px",
      width: "100%",
      borderRadius: "12px",
      background: "#079b98",
      color: "#ffffff",
      fontSize: "16px",
      fontWeight: 600,
      boxShadow: "none",
      transition: "background-color 150ms ease",
      "&:hover": { background: "#078d8a" },
    },
    footer: {
      marginTop: "12px",
      padding: 0,
      border: 0,
      background: "transparent",
      boxShadow: "none",
      "& > div:last-child": { display: "none" },
    },
    footerAction: { margin: 0, padding: 0, border: 0, background: "transparent" },
    footerActionText: "text-sm text-[#243b63]",
    footerActionLink: "ml-1 font-semibold text-[#079b98] hover:text-[#078d8a]",
    footerPages: "hidden",
    lastAuthenticationStrategyBadge: "hidden",
  },
};

function SignUpBrandMark() {
  return (
    <span className="flex flex-col items-center">
      <svg
        aria-hidden="true"
        className="h-8 w-[60px] text-[#079b98]"
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
      <span className="whitespace-nowrap text-[20px] font-bold leading-6 tracking-[-0.04em] text-[#0b1f42] sm:text-[22px]">
        AI <span className="text-[#079b98]">FITNESS TRAINER</span>
      </span>
    </span>
  );
}

export default async function SignUpPage() {
  const { userId } = await auth();
  const homeHref = userId ? "/dashboard" : "/";

  return (
    <main className="-mt-24 flex min-h-screen items-center justify-center bg-white px-4 pt-16 md:pt-[72px] sm:px-6">
      <section
        aria-labelledby="sign-up-heading"
        className="my-3 w-full max-w-[520px] rounded-[20px] border border-[#dce4ef] bg-white px-5 pb-5 pt-5 shadow-[0_12px_30px_rgba(30,58,96,0.06)] sm:px-8"
      >
        <Link
          href={homeHref}
          aria-label="AI FITNESS TRAINER home"
          className="mx-auto mb-2 flex w-fit flex-col items-center"
        >
          <SignUpBrandMark />
        </Link>

        <header className="mb-3 text-center">
          <h1
            id="sign-up-heading"
            className="text-[26px] font-bold leading-[32px] tracking-[0.5px] text-[#0b1f42] sm:text-[28px]"
          >
            Create Your Account
          </h1>
          <p className="mt-1 text-sm leading-5 tracking-[0.15px] text-[#586b8c]">
            Welcome! Please fill in the details to get started.
          </p>
        </header>

        <SignUp appearance={signUpAppearance} fallbackRedirectUrl="/dashboard" />
      </section>
    </main>
  );
}
