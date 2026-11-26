"use client";

import { useClerk } from "@clerk/nextjs";
import type { UserResource } from "@clerk/types";
import Image from "next/image";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

const ProfileHeader = ({ user }: { user: UserResource | null | undefined }) => {
  const { openUserProfile } = useClerk();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join("") || user.fullName?.[0] || "U";

  const cancelEdit = () => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setError(null);
    setIsEditing(false);
  };

  const beginEdit = () => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setError(null);
    setIsEditing(true);
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setIsEditing(false);
    } catch {
      setError("We couldn’t save your name. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-label="Profile summary"
      className="relative isolate overflow-hidden rounded-2xl border border-slate-200 bg-[#dcefeb] shadow-sm"
    >
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/dashboard-hero.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/95 via-white/85 to-white/30" aria-hidden="true" />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-[#e6f5f2] shadow-md sm:size-24">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={`${user.fullName || "User"} profile`}
              fill
              sizes="96px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-[#087f7b]">
              {initials.toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-0.5 right-0.5 size-4 rounded-full border-2 border-white bg-emerald-500" aria-label="Account active" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-bold tracking-tight text-[#172536] sm:text-3xl">
              {user.fullName || user.primaryEmailAddress?.emailAddress || "Your profile"}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/85 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Active account
            </span>
          </div>
          <p className="mt-1 break-all text-sm text-slate-600">
            {user.primaryEmailAddress?.emailAddress || "Email not provided"}
          </p>
          {isEditing && (
            <form onSubmit={saveName} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                First name
                <input
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#078f8b] focus:ring-2 focus:ring-[#078f8b]/20"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Last name
                <input
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#078f8b] focus:ring-2 focus:ring-[#078f8b]/20"
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#078f8b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#067b78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  <Check className="size-4" aria-hidden="true" />
                  {isSaving ? "Saving…" : "Save name"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </button>
              </div>
              {error && <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
              <p className="text-xs text-slate-500 sm:col-span-2">
                Email and profile photo can be changed in account settings.
              </p>
            </form>
          )}
        </div>

        {!isEditing && (
          <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={beginEdit}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/90 bg-white/90 px-4 text-sm font-semibold text-[#087f7b] shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => openUserProfile()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/90 bg-white/75 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078f8b] focus-visible:ring-offset-2"
            >
              Account settings
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileHeader;
