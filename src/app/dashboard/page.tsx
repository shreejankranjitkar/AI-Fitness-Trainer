"use client";

import DashboardSidebar from "@/components/DashboardSidebar";
import WeeklyActivity from "@/components/WeeklyActivity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../convex/_generated/api";
import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  Activity,
  Apple,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Salad,
} from "lucide-react";
import Link from "next/link";

const DashboardPage = () => {
  const { user, isLoaded } = useUser();
  const plans = useQuery(
    api.plans.getUserPlans,
    user ? { userId: user.id } : "skip",
  );

  const currentPlan = plans?.find((plan) => plan.isActive) ?? plans?.[0];
  const workoutDays = currentPlan?.workoutPlan.schedule.length;
  const calorieTarget = currentPlan?.dietPlan.dailyCalories;
  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "there";

  if (!isLoaded || (user && plans === undefined)) {
    return (
      <div className="-mt-24 min-h-screen bg-[#f7faf9] text-[#152131]">
        <DashboardSidebar />
        <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 lg:ml-60">
          <p className="text-sm font-medium text-[#687381]">Loading your dashboard…</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-mt-24 min-h-screen bg-[#f7faf9] text-[#152131]">
        <DashboardSidebar />
        <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 lg:ml-60">
          <p className="text-sm font-medium text-[#687381]">Sign in to view your dashboard.</p>
        </main>
      </div>
    );
  }

  const summaryCards = [
    {
      title: "Latest fitness plan",
      value: currentPlan?.name ?? "No plan yet",
      detail: currentPlan?.isActive ? "Active plan" : currentPlan ? "Most recent plan" : "Create your first plan",
      icon: ClipboardList,
    },
    {
      title: "Scheduled workouts",
      value: workoutDays === undefined ? "—" : `${workoutDays}`,
      detail: workoutDays === undefined ? "No saved schedule" : "days per week in this plan",
      icon: CalendarDays,
    },
    {
      title: "Plan calorie target",
      value: calorieTarget === undefined ? "—" : `${calorieTarget.toLocaleString()} kcal`,
      detail: calorieTarget === undefined ? "No saved nutrition plan" : "from your saved nutrition plan",
      icon: Apple,
    },
    {
      title: "Saved plans",
      value: `${plans?.length ?? 0}`,
      detail: "plans in your account",
      icon: Dumbbell,
    },
  ];

  return (
    <div className="-mt-24 min-h-screen bg-[#f7faf9] text-[#152131]">
      <DashboardSidebar />

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:ml-60 lg:px-8 lg:pt-7">
        <div className="mb-5 flex items-center justify-end">
          <UserButton />
        </div>

        <section className="relative isolate min-h-[220px] overflow-hidden rounded-2xl border border-[#cde5e1] bg-[#e8f5f2] shadow-[0_8px_28px_rgba(25,66,71,0.06)] sm:min-h-[230px]">
          <img
            src="/dashboard-hero.png"
            alt="Dumbbells and a water bottle on a gym bench"
            className="absolute inset-y-0 right-0 -z-10 h-full w-[72%] object-cover object-center sm:w-[64%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#e8f5f2] via-[#e8f5f2]/95 to-[#e8f5f2]/10" />
          <div className="relative z-10 flex min-h-[220px] max-w-2xl flex-col items-start justify-center px-5 py-7 sm:min-h-[230px] sm:px-8 sm:py-9">
            <p className="text-sm font-semibold text-[#465463] sm:text-base">Welcome back,</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.65rem]">
              {displayName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#465463] sm:text-base">
              Your fitness plans and weekly training details, all in one place.
            </p>
            <Button
              asChild
              className="mt-5 rounded-full bg-[#078f8b] px-5 text-white shadow-sm hover:bg-[#067b78]"
            >
              <Link href="/generate-program">
                Generate a Plan <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <section aria-label="Fitness plan summary" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ title, value, detail, icon: Icon }) => (
            <Card key={title} className="min-w-0 rounded-2xl border-[#e1e8e6] bg-white shadow-[0_4px_16px_rgba(24,52,55,0.035)]">
              <CardContent className="flex min-h-[112px] items-center gap-4 p-4 sm:p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f5f2] text-[#078f8b]">
                  <Icon className="size-6" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#687381] sm:text-sm">{title}</p>
                  <p className="mt-1 truncate text-xl font-bold tracking-tight text-[#152131]" title={value}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-xs text-[#687381]">{detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
          <Card className="rounded-2xl border-[#e1e8e6] bg-white shadow-[0_4px_16px_rgba(24,52,55,0.035)]">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-2 pt-5 sm:px-6">
              <Activity className="size-5 text-[#078f8b]" aria-hidden="true" />
              <CardTitle className="text-lg font-bold tracking-tight text-[#152131]">Weekly activity</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <WeeklyActivity planId={currentPlan?._id ?? null} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-2xl border-[#e1e8e6] bg-white shadow-[0_4px_16px_rgba(24,52,55,0.035)]">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-5 pb-2 pt-5">
                <Salad className="size-5 text-[#078f8b]" aria-hidden="true" />
                <CardTitle className="text-lg font-bold tracking-tight text-[#152131]">Your current plan</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {currentPlan ? (
                  <>
                    <p className="text-lg font-semibold text-[#152131]">{currentPlan.name}</p>
                    <p className="mt-1 text-sm text-[#687381]">
                      {currentPlan.isActive ? "Active fitness plan" : "Most recent fitness plan"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2" aria-label="Scheduled workout days">
                      {currentPlan.workoutPlan.schedule.map((day) => (
                        <span key={day} className="rounded-full bg-[#edf8f5] px-3 py-1 text-xs font-semibold text-[#087f7b]">
                          {day}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 border-t border-[#edf0ef] pt-3 text-sm text-[#465463]">
                      Plan calorie target: <span className="font-semibold text-[#152131]">{currentPlan.dietPlan.dailyCalories.toLocaleString()} kcal</span>
                    </p>
                    <Link href="/profile" className="mt-4 inline-flex items-center text-sm font-semibold text-[#087f7b] hover:text-[#065f5c]">
                      View plan details <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
                    </Link>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-[#687381]">
                    Your saved workout and nutrition plan will appear here after you create one.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#e1e8e6] bg-white shadow-[0_4px_16px_rgba(24,52,55,0.035)]">
              <CardHeader className="px-5 pb-2 pt-5">
                <CardTitle className="text-lg font-bold tracking-tight text-[#152131]">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 px-5 pb-5 sm:grid-cols-2">
                <Button
                  asChild
                  variant="outline"
                  className="h-10 w-full min-w-0 justify-start gap-2.5 rounded-xl border-[#e2e8e7] bg-[#fbfdfc] px-3.5 text-sm font-medium text-[#334353] shadow-none transition-colors duration-150 ease-out hover:border-[#b8dcd6] hover:bg-[#f2f8f6] hover:text-[#152131] focus-visible:ring-2 focus-visible:ring-[#78bcb3] focus-visible:ring-offset-2"
                >
                  <Link href="/generate-program">
                    <Dumbbell className="size-5 shrink-0 text-[#078f8b]" aria-hidden="true" />
                    <span>Generate Program</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 w-full min-w-0 justify-start gap-2.5 rounded-xl border-[#e2e8e7] bg-[#fbfdfc] px-3.5 text-sm font-medium text-[#334353] shadow-none transition-colors duration-150 ease-out hover:border-[#b8dcd6] hover:bg-[#f2f8f6] hover:text-[#152131] focus-visible:ring-2 focus-visible:ring-[#78bcb3] focus-visible:ring-offset-2"
                >
                  <Link href="/profile">
                    <ClipboardList className="size-5 shrink-0 text-[#078f8b]" aria-hidden="true" />
                    <span>My Profile</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {!currentPlan ? (
          <section className="mt-5 flex flex-col items-start gap-5 rounded-2xl border border-[#dcebe7] bg-white p-5 shadow-[0_4px_16px_rgba(24,52,55,0.035)] sm:flex-row sm:items-center sm:px-7 sm:py-6">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e8f5f2] text-[#078f8b]">
              <Dumbbell className="size-7" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#152131]">No fitness plan yet</h2>
              <p className="mt-1 text-sm leading-6 text-[#687381]">
                Create a personalized workout and nutrition plan to get started.
              </p>
            </div>
            <Button asChild className="shrink-0 rounded-full bg-[#078f8b] px-5 text-white hover:bg-[#067b78]">
              <Link href="/generate-program">Generate your first plan <ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link>
            </Button>
          </section>
        ) : (
          <Card className="mt-5 rounded-2xl border-[#e1e8e6] bg-white shadow-[0_4px_16px_rgba(24,52,55,0.035)]">
            <CardHeader className="px-5 pb-2 pt-5 sm:px-6">
              <CardTitle className="text-lg font-bold tracking-tight text-[#152131]">Workout schedule</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 px-5 pb-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
              {currentPlan.workoutPlan.exercises.map((dayPlan) => (
                <div key={dayPlan.day} className="flex items-center justify-between rounded-xl border border-[#e8eeec] bg-[#fbfdfc] px-4 py-3">
                  <span className="font-semibold text-[#334353]">{dayPlan.day}</span>
                  <span className="text-sm text-[#687381]">
                    {dayPlan.routines.length} {dayPlan.routines.length === 1 ? "routine" : "routines"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
