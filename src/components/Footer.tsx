"use client";

import { DumbbellIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Footer = () => {
  const pathname = usePathname();
  const isPublicHome = pathname === "/";
  const isSignInRoute =
    pathname === "/sign-in" || pathname.startsWith("/sign-in/");
  const isSignUpRoute =
    pathname === "/sign-up" || pathname.startsWith("/sign-up/");

  if (
    isSignInRoute ||
    isSignUpRoute ||
    pathname === "/dashboard" ||
    pathname === "/profile" ||
    pathname === "/generate-program"
  )
    return null;

  return (
    <footer
      className={
        isPublicHome
          ? "border-t border-[#e5e2dc] bg-[#fbf9f5] text-[#152131] "
          : "border-t border-border bg-background/80 backdrop-blur-sm"
      }
    >
      {/* Top border glow */}
      {!isPublicHome && (
        <div className="h-px w-full bg-gradient-to-r  from-transparent via-primary/30 to-transparent"></div>
      )}

      <div className="container flex items-center justify-between mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Logo and Copyright */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div
                className={
                  isPublicHome ? "text-[#078f8b]" : "p-1 bg-primary/10 rounded"
                }
              >
                {isPublicHome ? (
                  <DumbbellIcon className="h-6 w-6" strokeWidth={2.4} />
                ) : (
                  <ZapIcon className="w-4 h-4 text-primary" />
                )}
              </div>
              <span
                className={
                  isPublicHome
                    ? "whitespace-nowrap text-sm font-bold tracking-tight sm:text-base"
                    : "whitespace-nowrap text-sm font-bold"
                }
              >
                AI{" "}
                <span
                  className={isPublicHome ? "text-[#078f8b]" : "text-primary"}
                >
                  FITNESS TRAINER
                </span>
              </span>
            </Link>
          </div>
        </div>
        <p
          className={
            isPublicHome
              ? "text-sm text-[#687381]"
              : "text-sm text-muted-foreground"
          }
        >
          © {new Date().getFullYear()} AI FITNESS TRAINER - All rights reserved
        </p>
      </div>
    </footer>
  );
};
export default Footer;
