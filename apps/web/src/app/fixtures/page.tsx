'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';
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
  fixtureCode: string;
  matchday: number | null;
  roundName: string;
  status: string;
  scheduledAt: string | null;
  home: Entry | null;
  away: Entry | null;
  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
}

interface FixtureItem extends Fixture {
  tournamentId: string;
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

export default function FixturesPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [fixtures, setFixtures] =
    useState<FixtureItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

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

        const fixtureGroups =
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

                  return result.data.fixtures.map(
                    (fixture) => ({
                      ...fixture,
                      tournamentId:
                        tournament.id,
                      tournamentName:
                        tournament.name,
                      leagueName:
                        tournament.leagueName,
                    }),
                  );
                } catch {
                  return [];
                }
              },
            ),
          );

        setFixtures(fixtureGroups.flat());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load fixtures.',
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  if (!user || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-bold text-slate-500">
        Loading fixtures...
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
            Match Schedule
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Fixtures
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Tournament fixtures across all your
            leagues.
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {fixtures.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 p-10 text-center">
            <p className="font-black text-slate-300">
              No fixtures generated yet.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Close tournament registration and
              generate fixtures from the tournament.
            </p>

            <Link
              href="/tournaments"
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Tournaments
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {fixtures.map((fixture) => {
              const href =
                fixture.match?.id
                  ? `/matches/${fixture.match.id}`
                  : `/tournaments/${fixture.tournamentId}`;

              return (
                <Link
                  key={fixture.id}
                  href={href}
                  scroll
                  className="block rounded-[22px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                        {fixture.tournamentName}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {fixture.leagueName} ·{' '}
                        {fixture.roundName}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">
                      {fixture.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <p className="text-right font-black">
                      {entryName(fixture.home)}
                    </p>

                    <span className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-400">
                      VS
                    </span>

                    <p className="font-black">
                      {entryName(fixture.away)}
                    </p>
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-600">
                    {fixture.scheduledAt
                      ? new Date(
                          fixture.scheduledAt,
                        ).toLocaleString()
                      : 'Schedule not assigned'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
