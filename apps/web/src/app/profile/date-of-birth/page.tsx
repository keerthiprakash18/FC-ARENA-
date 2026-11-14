"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import {
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
} from "@/components/fc/fc-ui";
import { DateOfBirthForm } from "@/components/profile/date-of-birth-form";
import { getCurrentUser, type CurrentUser } from "@/lib/auth-client";
import { useRecoverableLoad } from "@/lib/use-recoverable-load";
import { leagueInviteQuery } from "@/lib/league-invite";

export default function DateOfBirthPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [next, setNext] = useState("/dashboard");
  const initialLoad = useRecoverableLoad(async (signal) => {
    const current = await getCurrentUser({ signal });
    if (!signal.aborted) {
      const invite = leagueInviteQuery(window.location.search);
      if (invite) setNext(`/leagues${invite}`);
      setUser(current);
    }
  });
  if (initialLoad.error)
    return (
      <AppShell currentUser={user ?? undefined}>
        <FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} />
      </AppShell>
    );
  if (!user) return <FcLoadingScreen label="Loading your account..." />;
  return (
    <AppShell currentUser={user} playerName={user.player?.identity?.inGameName}>
      <div className="space-y-5">
        <FcPageHeader
          eyebrow="Your account"
          title="Your date of birth"
          subtitle={
            user.dateOfBirth
              ? "Review or update your private account details."
              : "Welcome back. Add your date of birth to complete your player profile."
          }
        />
        <DateOfBirthForm
          key={user.id}
          user={user}
          onSaved={(dateOfBirth) =>
            setUser((current) =>
              current ? { ...current, dateOfBirth } : current,
            )
          }
        />
        <div className="flex flex-wrap gap-5">
          <Link
            href={next}
            className="theme-text inline-flex min-h-11 items-center text-sm font-bold"
          >
            {next !== "/dashboard" ? "Continue to league invite" : user.dateOfBirth ? "Continue to home" : "I'll add it later"}
          </Link>
          <Link
            href="/settings"
            className="theme-muted inline-flex min-h-11 items-center text-sm"
          >
            Account settings
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
