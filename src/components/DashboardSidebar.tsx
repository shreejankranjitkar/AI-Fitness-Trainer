"use client";

import { UserButton } from "@clerk/nextjs";
import { Dumbbell, LayoutDashboard, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate-program", label: "Generate Program", icon: Dumbbell },
  { href: "/profile", label: "My Profile", icon: UserRound },
];

const DashboardSidebar = () => {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !mobileNavRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnDesktopResize = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    const desktopBreakpoint = window.matchMedia("(min-width: 1024px)");
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    desktopBreakpoint.addEventListener("change", closeOnDesktopResize);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      desktopBreakpoint.removeEventListener("change", closeOnDesktopResize);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#e2e8e7] bg-white px-5 py-7 lg:flex">
        <Link href="/dashboard" className="mb-12 flex items-center gap-2.5 px-1 text-[#152131]">
          <span className="text-[#078f8b]">
            <Dumbbell className="size-7" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap text-sm font-bold tracking-tight">
            AI <span className="text-[#078f8b]">FITNESS TRAINER</span>
          </span>
        </Link>

        <nav aria-label="Dashboard navigation" className="space-y-2">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#e5f4f1] text-[#087f7b]"
                    : "text-[#465463] hover:bg-[#f2f7f6] hover:text-[#087f7b]"
                }`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#e5e9e8] pt-5 text-xs leading-5 text-[#687381]">
          © {new Date().getFullYear()} AI FITNESS TRAINER
          <br />
          Build a healthier you.
        </div>
      </aside>

      <nav
        ref={mobileNavRef}
        aria-label="Dashboard navigation"
        className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-[#e2e8e7] bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
      >
        <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-2 text-[#152131]">
          <Dumbbell className="size-6 text-[#078f8b]" strokeWidth={2.4} aria-hidden="true" />
          <span className="whitespace-nowrap text-[10px] font-bold tracking-tight sm:text-sm">
            AI <span className="text-[#078f8b]">FITNESS TRAINER</span>
          </span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <UserButton />
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#dce8e7] bg-white text-[#087f7b] transition-colors hover:bg-[#f2f8f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
        <div
          id="mobile-dashboard-menu"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`absolute right-4 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-[#dce8e7] bg-white p-2 shadow-xl shadow-[#152131]/10 transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${
            menuOpen
              ? "visible translate-y-0 scale-100 opacity-100"
              : "invisible pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
          }`}
        >
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#e5f4f1] text-[#087f7b]"
                    : "text-[#465463] hover:bg-[#f2f7f6] hover:text-[#087f7b]"
                }`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default DashboardSidebar;
