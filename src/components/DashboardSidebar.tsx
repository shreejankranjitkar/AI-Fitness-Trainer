"use client";

import { Dumbbell, LayoutDashboard, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate-program", label: "Generate Program", icon: Dumbbell },
  { href: "/profile", label: "My Profile", icon: UserRound },
];

const DashboardSidebar = () => {
  const pathname = usePathname();

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
        aria-label="Dashboard navigation"
        className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-[#e2e8e7] bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
      >
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-[#152131]">
          <Dumbbell className="size-6 text-[#078f8b]" strokeWidth={2.4} aria-hidden="true" />
          <span className="hidden whitespace-nowrap text-xs font-bold tracking-tight sm:inline">
            AI <span className="text-[#078f8b]">FITNESS TRAINER</span>
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold leading-tight sm:flex-row sm:gap-1.5 sm:px-3 sm:text-xs ${
                  active ? "bg-[#e5f4f1] text-[#087f7b]" : "text-[#465463]"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="w-[68px] text-center leading-tight sm:w-auto sm:truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default DashboardSidebar;
