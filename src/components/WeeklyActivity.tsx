"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type WeeklyActivityProps = {
  planId: Id<"plans"> | null;
};

export default function WeeklyActivity({ planId }: WeeklyActivityProps) {
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const checklist = useQuery(
    api.workoutActivity.getActivePlanChecklist,
    planId ? { planId } : "skip",
  );
  const setCompleted = useMutation(api.workoutActivity.setWorkoutCompleted);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const completedCount = checklist?.days.filter((day) => day.completed).length ?? 0;
  const totalCount = checklist?.days.length ?? 0;
  const completionPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const completedFormatter = useMemo(
    () =>
      timeZone
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone,
          })
        : null,
    [timeZone],
  );

  const updateDay = async (dayId: string, completed: boolean) => {
    if (!planId) return;
    setPendingDay(dayId);
    setError(null);
    try {
      await setCompleted({ planId, scheduledWorkoutId: dayId, completed });
    } catch {
      setError("Your workout update could not be saved. Please try again.");
    } finally {
      setPendingDay(null);
    }
  };

  return (
    <div className="space-y-4">
      {!planId ? (
        <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e4e1] bg-[#fbfdfc] px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e8f5f2] text-[#078f8b]">
            <Activity className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[#152131]">Your weekly activity starts with a plan</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-[#687381]">
            Create a fitness plan to see its scheduled workouts here.
          </p>
        </div>
      ) : checklist === undefined ? (
        <div className="flex min-h-[210px] items-center justify-center rounded-xl border border-[#e8eeec] bg-[#fbfdfc] px-6 text-sm text-[#687381]" role="status">
          Loading your scheduled workouts…
        </div>
      ) : totalCount === 0 ? (
        <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d7e4e1] bg-[#fbfdfc] px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#e8f5f2] text-[#078f8b]">
            <Activity className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[#152131]">No workouts are scheduled</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-[#687381]">
            This plan does not contain scheduled weekdays to track yet.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[#e8eeec] bg-[#fbfdfc] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#152131]">Weekly completion</p>
                <p className="mt-1 text-sm text-[#687381]">
                  {completedCount} of {totalCount} scheduled {totalCount === 1 ? "workout" : "workouts"} completed
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-[#087f7b]">{completionPercent}%</span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5eeeb]"
              role="progressbar"
              aria-label="Weekly workout completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercent}
            >
              <div
                className="h-full rounded-full bg-[#078f8b] transition-[width] duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <ul className="divide-y divide-[#edf0ef]" aria-label="Scheduled workouts Monday through Sunday">
            {checklist.days.map((day) => (
              <li key={day.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                <input
                  id={`weekly-workout-${day.id}`}
                  type="checkbox"
                  checked={day.completed}
                  disabled={pendingDay !== null}
                  onChange={(event) => void updateDay(day.id, event.target.checked)}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-[#078f8b] disabled:cursor-wait"
                  aria-label={`Mark ${day.day} workout ${day.completed ? "pending" : "completed"}`}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`weekly-workout-${day.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#243342]">
                    {day.day}
                  </label>
                  {day.routines.length > 0 ? (
                    <p className="mt-1 text-sm leading-5 text-[#687381]">{day.routines.join(" · ")}</p>
                  ) : (
                    <p className="mt-1 text-sm text-[#687381]">Workout details aren’t listed for this day.</p>
                  )}
                  {day.completed && day.completedAt && completedFormatter ? (
                    <p className="mt-1 text-xs text-[#7b8792]">
                      Completed {completedFormatter.format(day.completedAt)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {error ? <p className="text-sm font-medium text-red-700" role="alert">{error}</p> : null}
        </>
      )}
    </div>
  );
}
