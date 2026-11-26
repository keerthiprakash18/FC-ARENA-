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
            <nav className="flex flex-wrap gap-2" aria-label="Player journey sections">
              <a href="#daily-check-in" className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold">Daily check-in</a>
              <a href="#player-progress" className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold">Missions &amp; progress</a>
            </nav>
            <DailyRewards userId={user.id} full />
            <div id="player-progress" className="scroll-mt-24">
            <PlayerJourney
            full
            weeklyHistory={career.matchHistory ?? []}
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
          />
            </div>
          </>
        ) : (
          <p role="status">Loading your player journey…</p>
        )}
      </div>
    </AppShell>
  );
}
