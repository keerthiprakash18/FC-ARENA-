'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { CareerNavigation } from '@/components/career/career-navigation';
import {
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface TournamentHistory {
  tournament: {
    id: string;
    name: string;
    code: string;
    status: string;

    league: {
      id: string;
      name: string;
    };
  };

  registration: {
    id: string;
    entryName: string | null;
    status: string;
  };

  statistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    form: string;
  };
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  tournamentHistory:
    TournamentHistory[];
}

export default function CareerTournamentsPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [career, setCareer] =
    useState<CareerData | null>(null);

  useEffect(() => {
    void (async () => {
      const [current, response] =
        await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{
            success: true;
            data: CareerData;
            error: null;
          }>('/players/me/career'),
        ]);

      setUser(current);
      setCareer(response.data);
    })();
  }, []);

  if (!user || !career) {
    return (
      <FcLoadingScreen
        label="Loading Tournament History..."
      />
    );
  }

  const playerName =
    career.profile.identity
      ?.inGameName ||
    career.profile.fullName;

  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <BackHeader
          backHref="/career"
          backLabel="Career Stats"
          eyebrow="Player Career"
          title="Tournament History"
          subtitle="Your performance record separated by competition."
        />

        <CareerNavigation />

        {career.tournamentHistory.length === 0 ? (
          <FcEmptyState
            title="No Tournament history"
            description="Your approved Tournament entries will appear here."
            actionLabel="Open Tournaments"
            actionHref="/tournaments"
          />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {career.tournamentHistory.map(
              (entry) => (
                <FcPanel
                  key={entry.registration.id}
                  className="p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                        {entry.tournament.league.name}
                      </p>

                      <h2 className="mt-2 text-xl font-black">
                        {entry.tournament.name}
                      </h2>

                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        {entry.tournament.code}
                      </p>
                    </div>

                    <FcStatusBadge
                      label={entry.tournament.status}
                      tone={
                        entry.tournament.status === 'COMPLETED'
                          ? 'emerald'
                          : 'cyan'
                      }
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <FcStatCard
                      label="MP"
                      value={entry.statistics.matches}
                    />

                    <FcStatCard
                      label="W"
                      value={entry.statistics.wins}
                      tone="emerald"
                    />

                    <FcStatCard
                      label="D"
                      value={entry.statistics.draws}
                      tone="amber"
                    />

                    <FcStatCard
                      label="L"
                      value={entry.statistics.losses}
                      tone="red"
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    Goals {entry.statistics.goalsFor}
                    {' · '}
                    GD{' '}
                    {entry.statistics.goalDifference > 0
                      ? '+'
                      : ''}
                    {entry.statistics.goalDifference}
                    {' · '}
                    Form {entry.statistics.form || '—'}
                  </p>

                  <Link
                    href={`/tournaments/${entry.tournament.id}`}
                    className="mt-4 inline-flex text-sm font-black text-sky-300"
                  >
                    Open Tournament →
                  </Link>
                </FcPanel>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
