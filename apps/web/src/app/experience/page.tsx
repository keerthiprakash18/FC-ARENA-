"use client";
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
      <main className="community-page">
        <div className="community-heading">
          <div>
            <span className="community-eyebrow">PLAYER PROGRESS</span>
            <h1>Your game. Your journey.</h1>
            <p>
              Play verified matches, complete missions and build your player
              identity.
            </p>
          </div>
          <Link href="/profile" className="community-button">
            Profile settings
          </Link>
        </div>
        {error ? (
          <div className="community-error" role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
            <Link href="/login">Sign in</Link>
          </div>
        ) : user && career ? (
          <><DailyRewards userId={user.id} full /><PlayerJourney
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
      </main>
    </AppShell>
  );
}
