"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Activity,
  Apple,
  CalendarDays,
  Dumbbell as DumbbellIcon,
  HeartPulse,
  LoaderCircle,
  Settings2,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";

import DashboardSidebar from "@/components/DashboardSidebar";
import ProfileHeader from "@/components/ProfileHeader";
import NoFitnessPlan from "@/components/NoFitnessPlan";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function getLocalDateOrdinal(timestamp: number, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(new Date(timestamp));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function getActivityStreak(activeDays: Set<number>, today: number) {
  let day = activeDays.has(today) ? today : today - 1;
  if (!activeDays.has(day)) return 0;

  let streak = 0;
  while (activeDays.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

const profileTabTriggerClasses =
  "font-medium text-slate-700 dark:text-slate-700 hover:bg-slate-50 hover:text-[#152131] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2 data-[state=active]:border-[#b9e6df] data-[state=active]:bg-white data-[state=active]:text-[#087f7b] data-[state=active]:shadow-sm data-[state=active]:hover:text-[#087f7b] dark:data-[state=active]:border-[#b9e6df] dark:data-[state=active]:bg-white dark:data-[state=active]:text-[#087f7b]";

const ProfilePage = () => {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planToArchive, setPlanToArchive] = useState<{
    id: Id<"plans">;
    name: string;
  } | null>(null);
  const [isArchivingPlan, setIsArchivingPlan] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const archiveDialogRef = useRef<HTMLDialogElement>(null);
  const archivePlan = useMutation(api.plans.archivePlan);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const dialog = archiveDialogRef.current;
    if (!dialog) return;

    if (planToArchive && !dialog.open) dialog.showModal();
    if (!planToArchive && dialog.open) dialog.close();
  }, [planToArchive]);

  const confirmArchivePlan = async () => {
    if (!planToArchive || isArchivingPlan) return;

    setIsArchivingPlan(true);
    setArchiveError(null);
    try {
      await archivePlan({ planId: planToArchive.id });
      setSelectedPlanId(null);
      setPlanToArchive(null);
    } catch {
      setArchiveError("The plan could not be archived. Please try again.");
    } finally {
      setIsArchivingPlan(false);
    }
  };

  const workoutStats = useQuery(
    api.workoutActivity.getProfileWorkoutStats,
    user ? {} : "skip",
  );

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const dateFormatter = useMemo(
    () =>
      timeZone
        ? new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : null,
    [timeZone],
  );

  const completedWorkouts = workoutStats?.completedWorkouts ?? [];
  const hasUndatedCompletions = completedWorkouts.some(
    (workout) => workout.completedAt === null,
  );
  const activeLocalDays = new Set<number>();
  if (dateFormatter) {
    for (const workout of completedWorkouts) {
      if (workout.completedAt === null) continue;
      const ordinal = getLocalDateOrdinal(workout.completedAt, dateFormatter);
      if (ordinal !== null) activeLocalDays.add(ordinal);
    }
  }
  const todayOrdinal =
    now !== null && dateFormatter
      ? getLocalDateOrdinal(now, dateFormatter)
      : null;
  const loadingStats = workoutStats === undefined || todayOrdinal === null;
  const activityStreak =
    todayOrdinal === null ? 0 : getActivityStreak(activeLocalDays, todayOrdinal);
  const scheduledDays = workoutStats?.activeScheduledWorkoutIds ?? [];
  const completedActiveDays = workoutStats?.activeCompletedWorkoutIds.length ?? 0;
  const planProgress = scheduledDays.length
    ? Math.round((completedActiveDays / scheduledDays.length) * 100)
    : null;

  const fitnessStats = [
    {
      label: "Activity Streak",
      icon: Activity,
      value: loadingStats
        ? "—"
        : hasUndatedCompletions
          ? "—"
          : `${activityStreak} ${activityStreak === 1 ? "day" : "days"}`,
      detail: loadingStats
        ? "Loading statistics…"
        : hasUndatedCompletions
          ? "Completion dates unavailable"
          : activityStreak === 0
            ? "No consecutive activity yet"
            : "Consecutive local calendar days",
    },
    {
      label: "Plan Progress",
      icon: TrendingUp,
      value: loadingStats ? "—" : planProgress === null ? "—" : `${planProgress}%`,
      detail: loadingStats
        ? "Loading statistics…"
        : planProgress === null
          ? "No scheduled workouts in active plan"
          : `${completedActiveDays} of ${scheduledDays.length} scheduled workouts`,
    },
    {
      label: "Workouts Completed",
      icon: DumbbellIcon,
      value: loadingStats ? "—" : `${completedWorkouts.length}`,
      detail: loadingStats
        ? "Loading statistics…"
        : completedWorkouts.length === 0
          ? "No completed workouts yet"
          : "Across all generated programs",
    },
    {
      label: "Active Workout Days",
      icon: CalendarDays,
      value: loadingStats
        ? "—"
        : hasUndatedCompletions
          ? "—"
          : `${activeLocalDays.size}`,
      detail: loadingStats
        ? "Loading statistics…"
        : hasUndatedCompletions
          ? "Completion dates unavailable"
          : activeLocalDays.size === 0
            ? "No activity dates recorded yet"
            : "Unique local calendar days",
    },
  ];

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user ? { clerkId: user.id } : "skip",
  );

  // Plans have been saved with both Clerk IDs and Convex user document IDs.
  // Query both supported keys, then deduplicate by the plan document ID.
  const clerkPlans = useQuery(
    api.plans.getUserPlans,
    user ? { userId: user.id } : "skip",
  );
  const convexPlanUserId = convexUser?._id;
  const shouldQueryConvexId = Boolean(
    convexPlanUserId && convexPlanUserId !== user?.id,
  );
  const convexIdPlans = useQuery(
    api.plans.getUserPlans,
    shouldQueryConvexId ? { userId: convexPlanUserId! } : "skip",
  );

  const plansReady = Boolean(
    isLoaded &&
      user &&
      convexUser !== undefined &&
      clerkPlans !== undefined &&
      (!shouldQueryConvexId || convexIdPlans !== undefined),
  );
  const allPlans = plansReady
    ? Array.from(
        new Map(
          [...(clerkPlans ?? []), ...(convexIdPlans ?? [])].map((plan) => [
            plan._id,
            plan,
          ]),
        ).values(),
      )
    : undefined;

  const activePlan = allPlans?.find((plan) => plan.isActive);
  const selectedPlan = selectedPlanId
    ? allPlans?.find((plan) => plan._id === selectedPlanId)
    : undefined;
  const currentPlan = selectedPlan ?? activePlan ?? allPlans?.[0];

  if (!isLoaded || (user && (convexUser === undefined || !plansReady))) {
    return (
      <ProfileShell>
        <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          Loading your profile…
        </div>
      </ProfileShell>
    );
  }

  if (!user) {
    return (
      <ProfileShell>
        <div className="mx-auto max-w-6xl px-4 py-12 text-center text-sm text-slate-600 sm:px-6 lg:px-8">
          Please sign in to view your profile.
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell>
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-[#078f8b]">YOUR ACCOUNT</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172536] sm:text-3xl">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your account details, fitness plans, and preferences.
          </p>
        </div>

        <ProfileHeader user={user} />

        <section aria-labelledby="activity-title">
          <div className="mb-3 flex items-center gap-2">
            <HeartPulse className="size-5 text-[#078f8b]" aria-hidden="true" />
            <h2 id="activity-title" className="text-lg font-semibold text-[#172536]">
              Fitness Statistics
            </h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Based on completed scheduled workouts across your generated programs.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {fitnessStats.map(({ label, icon: Icon, value, detail }) => (
              <div
                key={label}
                className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e6f5f2] text-[#078f8b]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-600">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800" aria-live="polite">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList
            aria-label="Profile sections"
            className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-4"
          >
            <TabsTrigger value="personal" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-xs sm:text-sm`}>
              <UserRound className="size-4" aria-hidden="true" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="goals" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-xs sm:text-sm`}>
              <Target className="size-4" aria-hidden="true" />
              Fitness Goals
            </TabsTrigger>
            <TabsTrigger value="preferences" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-xs sm:text-sm`}>
              <Apple className="size-4" aria-hidden="true" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="settings" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-xs sm:text-sm`}>
              <Settings2 className="size-4" aria-hidden="true" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="personal-info-title">
              <div className="mb-5">
                <h2 id="personal-info-title" className="text-lg font-semibold text-[#172536]">
                  Personal Information
                </h2>
              <p className="mt-1 text-sm text-slate-500">Your account information and body metrics.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Full name" value={user.fullName || "Not provided"} />
                <InfoField label="Email" value={user.primaryEmailAddress?.emailAddress || "Not provided"} />
                <InfoField label="Age" value={convexUser?.age != null ? `${convexUser.age}` : "Not provided"} />
                <InfoField label="Height" value={convexUser?.height || "Not provided"} />
                <InfoField label="Weight" value={convexUser?.weight || "Not provided"} />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="goals" className="mt-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="goals-title">
              <h2 id="goals-title" className="text-lg font-semibold text-[#172536]">Fitness Goals</h2>
              <p className="mt-1 text-sm text-slate-500">Your fitness level and current goal, when shared with your coach.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoField label="Fitness level" value={convexUser?.fitnessLevel || "Not provided"} />
                <InfoField label="Fitness goal" value={convexUser?.fitnessGoal || "Not provided"} />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="preferences-title">
              <h2 id="preferences-title" className="text-lg font-semibold text-[#172536]">Preferences</h2>
              <p className="mt-1 text-sm text-slate-500">Preferences are shown when you share them with your coach.</p>
              <div className="mt-5 max-w-md">
                <InfoField label="Dietary preference" value={convexUser?.dietaryRestrictions || "Not provided"} />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="settings-title">
              <h2 id="settings-title" className="text-lg font-semibold text-[#172536]">Account Settings</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Manage your name, email address, profile image, and security settings through your secure Clerk account.
              </p>
              <Button
                type="button"
                onClick={() => openUserProfile()}
                className="mt-5 bg-[#078f8b] text-white hover:bg-[#067b78]"
              >
                Open account settings
              </Button>
            </section>
          </TabsContent>
        </Tabs>

        <section aria-labelledby="fitness-plans-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="fitness-plans-title" className="text-xl font-bold text-[#172536]">
                My Fitness Plans
              </h2>
            </div>
            {allPlans && allPlans.length > 0 && (
              <span className="text-sm text-slate-500">{allPlans.length} {allPlans.length === 1 ? "plan" : "plans"}</span>
            )}
          </div>

          {allPlans && allPlans.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.7fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Choose a fitness plan">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Your plans</h3>
                <div className="space-y-2">
                  {allPlans.map((plan) => {
                    const selected = (currentPlan?._id ?? activePlan?._id) === plan._id;
                    return (
                      <button
                        key={plan._id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedPlanId(plan._id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] ${
                          selected
                            ? "border-[#078f8b] bg-[#eaf6f4] text-[#087f7b]"
                            : "border-slate-200 text-slate-700 hover:border-[#a9d9d3] hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">{plan.name}</span>
                        {plan.isActive && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {currentPlan && (
                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="selected-plan-title">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f5f2] text-[#078f8b]">
                        <DumbbellIcon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected fitness plan</p>
                        <h3 id="selected-plan-title" className="mt-0.5 break-words text-lg font-bold text-[#172536]">{currentPlan.name}</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setArchiveError(null);
                        setPlanToArchive({ id: currentPlan._id, name: currentPlan.name });
                      }}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete Plan
                    </button>
                  </div>

                  <Tabs defaultValue="workout" className="w-full">
                    <TabsList aria-label="Plan details" className="grid h-auto w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
                      <TabsTrigger value="workout" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-sm`}>
                        <CalendarDays className="size-4" aria-hidden="true" /> Workout Plan
                      </TabsTrigger>
                      <TabsTrigger value="diet" className={`${profileTabTriggerClasses} min-h-10 rounded-lg text-sm`}>
                        <Apple className="size-4" aria-hidden="true" /> Diet Plan
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="workout" className="mt-4">
                      <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {currentPlan.workoutPlan.schedule.join(", ") || "No schedule listed"}
                        </p>
                      </div>
                      {currentPlan.workoutPlan.exercises.length ? (
                        <Accordion type="multiple" className="space-y-2">
                          {currentPlan.workoutPlan.exercises.map((exerciseDay, index) => (
                            <AccordionItem key={`${exerciseDay.day}-${index}`} value={`${exerciseDay.day}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 px-4">
                              <AccordionTrigger className="py-4 text-left text-sm font-semibold text-slate-800 hover:no-underline">
                                <span className="flex w-full items-center justify-between gap-3 pr-2">
                                  <span>{exerciseDay.day}</span>
                                  <span className="text-xs font-medium text-slate-500">{exerciseDay.routines.length} {exerciseDay.routines.length === 1 ? "exercise" : "exercises"}</span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="pb-4">
                                <div className="space-y-3">
                                  {exerciseDay.routines.map((routine, routineIndex) => (
                                    <div key={`${routine.name}-${routineIndex}`} className="rounded-lg bg-slate-50 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="font-semibold text-slate-800">{routine.name}</h4>
                                        <div className="flex gap-2 text-xs font-medium text-slate-600">
                                          {routine.sets != null && <span className="rounded-md bg-white px-2 py-1">{routine.sets} sets</span>}
                                          {routine.reps != null && <span className="rounded-md bg-white px-2 py-1">{routine.reps} reps</span>}
                                        </div>
                                      </div>
                                      {routine.description && <p className="mt-2 text-sm leading-6 text-slate-600">{routine.description}</p>}
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No workout schedule details are available for this plan.</p>
                      )}
                    </TabsContent>

                    <TabsContent value="diet" className="mt-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#eaf6f4] px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">Daily calorie target</span>
                        <span className="text-lg font-bold text-[#087f7b]">{currentPlan.dietPlan.dailyCalories} kcal</span>
                      </div>
                      {currentPlan.dietPlan.meals.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {currentPlan.dietPlan.meals.map((meal, index) => (
                            <div key={`${meal.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
                              <h4 className="font-semibold text-slate-800">{meal.name}</h4>
                              {meal.foods.length ? (
                                <ul className="mt-3 space-y-2">
                                  {meal.foods.map((food, foodIndex) => (
                                    <li key={`${food}-${foodIndex}`} className="flex items-start gap-2 text-sm text-slate-600">
                                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#078f8b]" aria-hidden="true" />
                                      {food}
                                    </li>
                                  ))}
                                </ul>
                              ) : <p className="mt-2 text-sm text-slate-500">No foods listed.</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No meal details are available for this plan.</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </section>
              )}
            </div>
          ) : (
            <NoFitnessPlan />
          )}

          <dialog
            ref={archiveDialogRef}
            aria-labelledby="archive-plan-title"
            aria-describedby="archive-plan-description"
            onCancel={(event) => {
              if (isArchivingPlan) {
                event.preventDefault();
                return;
              }
              setPlanToArchive(null);
              setArchiveError(null);
            }}
            className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-0 text-left text-[#172536] shadow-2xl backdrop:bg-slate-950/40"
          >
            <div className="p-5 sm:p-6">
              <h3 id="archive-plan-title" className="text-lg font-bold">Delete fitness plan?</h3>
              <p id="archive-plan-description" className="mt-2 text-sm leading-6 text-slate-600">
                {planToArchive
                  ? `“${planToArchive.name}” will be removed from your visible fitness plans. Its workout and activity records will remain saved.`
                  : "This plan will be removed from your visible fitness plans. Its workout and activity records will remain saved."}
              </p>
              {archiveError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{archiveError}</p>}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  autoFocus
                  disabled={isArchivingPlan}
                  onClick={() => {
                    setPlanToArchive(null);
                    setArchiveError(null);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isArchivingPlan || !planToArchive}
                  onClick={() => void confirmArchivePlan()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isArchivingPlan && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                  {isArchivingPlan ? "Archiving…" : "Delete Plan"}
                </button>
              </div>
            </div>
          </dialog>
        </section>
      </div>
    </ProfileShell>
  );
};

function ProfileShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mt-24 min-h-screen bg-[#f4f7f7] text-[#172536]">
      <DashboardSidebar />
      <div className="min-h-screen lg:ml-60">{children}</div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default ProfilePage;
