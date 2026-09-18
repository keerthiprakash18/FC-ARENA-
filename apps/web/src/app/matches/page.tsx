'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface MyLeague {
  league: {
    id: string;
    name: string;
  };
}

interface Tournament {
  id: string;
  name: string;
}

interface Entry {
  entryName: string | null;
  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}

interface Fixture {
  id: string;
  roundName: string;
  status: string;
  home: Entry | null;
  away: Entry | null;
  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
}

interface MatchItem extends Fixture {
  tournamentName: string;
  leagueName: string;
}

function entryName(entry: Entry | null) {
  if (!entry) return 'TBD';

  return (
    entry.entryName ||
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    'Entry'
  );
}

export default function MatchesPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [matches, setMatches] =
    useState<MatchItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function load() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser);

        const leagueResult =
          await authenticatedRequest<{
            data: {
              leagues: MyLeague[];
            };
          }>('/leagues/my');

        const tournamentGroups =
          await Promise.all(
            leagueResult.data.leagues.map(
              async (membership) => {
                const result =
                  await authenticatedRequest<{
                    data: {
                      tournaments: Tournament[];
                    };
                  }>(
                    `/leagues/${membership.league.id}/tournaments`,
                  );

                return result.data.tournaments.map(
                  (tournament) => ({
                    ...tournament,
                    leagueName:
                      membership.league.name,
                  }),
                );
              },
            ),
          );

        const tournaments =
          tournamentGroups.flat();

        const matchGroups =
          await Promise.all(
            tournaments.map(
              async (tournament) => {
                try {
                  const result =
                    await authenticatedRequest<{
                      data: {
                        fixtures: Fixture[];
                      };
                    }>(
                      `/tournaments/${tournament.id}/fixtures`,
                    );

                  return result.data.fixtures
                    .filter(
                      (fixture) =>
                        fixture.match !== null,
                    )
                    .map((fixture) => ({
                      ...fixture,
                      tournamentName:
                        tournament.name,
                      leagueName:
                        tournament.leagueName,
                    }));
                } catch {
                  return [];
                }
              },
            ),
          );

        setMatches(matchGroups.flat());
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (!user || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-bold text-slate-500">
        Loading matches...
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity?.inGameName
      }
    >
      <div className="space-y-7">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Competition
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Match Center
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Open matches, submit results and follow
            match status.
          </p>
        </section>

        {matches.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 p-10 text-center text-slate-500">
            No matches available yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {matches.map((fixture) => (
              <Link
                key={fixture.id}
                href={`/matches/${fixture.match!.id}`}
                scroll
                className="rounded-[24px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/30"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                  {fixture.tournamentName}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {fixture.leagueName} ·{' '}
                  {fixture.roundName}
                </p>

                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <p className="text-right font-black">
                    {entryName(fixture.home)}
                  </p>

                  <span className="text-xs font-black text-sky-400">
                    VS
                  </span>

                  <p className="font-black">
                    {entryName(fixture.away)}
                  </p>
                </div>

                <div className="mt-5 flex justify-between text-xs">
                  <span className="text-slate-600">
                    {fixture.match?.matchCode ||
                      'MATCH'}
                  </span>

                  <span className="font-black text-slate-400">
                    {fixture.match?.status.replaceAll(
                      '_',
                      ' ',
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
