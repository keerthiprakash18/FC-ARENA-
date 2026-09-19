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
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface MatchHistory {
  id: string;
  matchCode: string | null;
  outcome: 'W' | 'D' | 'L';
  confirmedAt: string;

  tournament: {
    id: string;
    name: string;
    league: {
      id: string;
      name: string;
    };
  };

  fixture: {
    roundName: string;
    matchday: number | null;
  };

  home: {
    name: string;
    score: number;
  };

  away: {
    name: string;
    score: number;
  };
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  matchHistory: MatchHistory[];
}

export default function CareerMatchesPage() {
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
        label="Loading Match History..."
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
          title="Match History"
          subtitle="Verified match-by-match results only."
        />

        <CareerNavigation />

        {career.matchHistory.length === 0 ? (
          <FcEmptyState
            title="No verified matches yet"
            description="Completed and verified Match results will appear here."
            actionLabel="Open Match Center"
            actionHref="/matches"
          />
        ) : (
          <section className="grid gap-3">
            {career.matchHistory.map(
              (match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="group"
                >
                  <FcPanel className="p-5 transition group-hover:border-sky-400/25">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <FcStatusBadge
                          label={match.outcome}
                          tone={
                            match.outcome === 'W'
                              ? 'emerald'
                              : match.outcome === 'D'
                                ? 'amber'
                                : 'red'
                          }
                        />

                        <div>
                          <p className="font-black">
                            {match.tournament.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            {match.fixture.roundName}
                            {' · '}
                            {match.tournament.league.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-lg font-black">
                          {match.home.name}{' '}
                          <span className="text-sky-300">
                            {match.home.score}
                            -
                            {match.away.score}
                          </span>{' '}
                          {match.away.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {new Date(
                            match.confirmedAt,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </FcPanel>
                </Link>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
