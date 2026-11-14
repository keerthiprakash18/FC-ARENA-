"use client";
import { FcPageHeader } from '@/components/fc/fc-ui';
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { PlayerJourney } from "@/components/experience/player-journey";
import { DailyRewards } from '@/components/experience/daily-rewards';
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";
import { errorMessage, type ApiData } from "@/lib/player-experience";
import { weeklyVerifiedProgress } from '@/lib/weekly-verified-progress.mjs';
interface Career {
  lifetimeStatistics: {
    matches: number;
    wins: number;
    goalsFor: number;
    winRate: number;
  };
  matchHistory: Array<{ id: string; confirmedAt: string; outcome: 'W' | 'D' | 'L' }>;
}
export default function ExperiencePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [career, setCareer] = useState<Career | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const [u, c] = await Promise.all([
        getCurrentUser(),
        authenticatedRequest<ApiData<Career>>("/players/me/career"),
      ]);
      setUser(u);
      setCareer(c.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const weekly = career ? weeklyVerifiedProgress(career.matchHistory ?? []) : null;
  useEffect(() => {
    // The calendar mounts after the account loads, so retry the header's anchor
    // after that render instead of leaving the player at the top of the page.
    if (user && career && window.location.hash === '#daily-check-in') {
      document.getElementById('daily-check-in')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [user, career]);
  return (
    <AppShell currentUser={user || undefined}>
      <div className="community-page">
        <FcPageHeader
          title="Player Journey"
          icon="activity"
          subtitle="Play verified matches, complete missions and build your player identity."
          action={<Link href="/profile" className="theme-secondary-button inline-flex min-h-11 items-center border px-4 text-sm">Profile settings</Link>}
        />
        {error ? (
          <div className="community-error" role="alert">
            {error}
            <button type="button" onClick={() => void load()}>Try again</button>
            <Link href="/login">Sign in</Link>
          </div>
        ) : user && career ? (
          <>
            {weekly ? (
              <section aria-labelledby="verified-goals-title" className="mt-5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="verified-goals-title" className="theme-text text-lg font-bold">This week&apos;s verified goals</h2>
                    <p className="theme-secondary-text mt-1 text-sm">
                      {new Date(weekly.start).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(weekly.end - 1).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}
                      {' · Monday to Sunday (IST)'}
                    </p>
                  </div>
                  <span className="theme-soft-accent rounded-full border px-3 py-1 text-xs font-semibold">{weekly.matches} verified matches · {weekly.wins} wins</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {weekly.goals.map((goal) => (
                    <div key={goal.id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="theme-text text-sm font-semibold">{goal.label}</h3>
                        <span className="theme-secondary-text whitespace-nowrap text-xs">{goal.value}/{goal.target}</span>
                      </div>
                      <progress aria-label={`${goal.label}: ${goal.value} of ${goal.target}`} value={goal.value} max={goal.target} className="mt-3 h-2 w-full accent-[var(--theme-primary)]" />
                      <p className="theme-secondary-text mt-1 text-xs">{goal.value === goal.target ? 'Completed' : 'Keep playing verified matches'}</p>
                    </div>
                  ))}
                </div>
                <p className="theme-secondary-text mt-3 text-xs leading-5">Activity progress only. These goals do not award Arena Coins or XP; only verified match history counts.</p>
              </section>
            ) : null}
            <DailyRewards userId={user.id} full /><PlayerJourney
            full
            player={{
              name: user.player?.identity?.inGameName || user.fullName,
              code: user.player?.playerCode || null,
              avatar: user.player?.profileImageUrl || null,
              verified: user.player?.identity?.isVerified || false,
              matches: career.lifetimeStatistics.matches,
              wins: career.lifetimeStatistics.wins,
              goals: career.lifetimeStatistics.goalsFor,
              winRate: career.lifetimeStatistics.winRate,
            }}
          /></>
        ) : (
          <p role="status">Loading your player journey…</p>
        )}
      </div>
    </AppShell>
  );
}
