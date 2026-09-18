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
    code: string;
  };
}

interface Tournament {
  id: string;
  name: string;
  code: string;
  mode: string;
  format: string;
  status: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
}

interface TournamentItem extends Tournament {
  leagueId: string;
  leagueName: string;
}

export default function TournamentsPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(null);

  const [tournaments, setTournaments] =
    useState<TournamentItem[]>([]);

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

        const results =
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
                    leagueId:
                      membership.league.id,
                    leagueName:
                      membership.league.name,
                  }),
                );
              },
            ),
          );

        setTournaments(results.flat());
      } catch (err) {
        if (!user) {
          try {
            await getCurrentUser();
          } catch {
            router.replace('/login');
            return;
          }
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournaments.',
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
        Loading tournaments...
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
            Competition Center
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Tournaments
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Every tournament from your joined
            leagues is available here.
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {tournaments.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-white/10 p-10 text-center">
            <p className="font-black text-slate-300">
              No tournaments yet.
            </p>

            <Link
              href="/leagues"
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Leagues
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {tournaments.map(
              (tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  scroll
                  className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6 transition hover:border-sky-400/30 hover:bg-[#0c131d]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                        {tournament.leagueName}
                      </p>

                      <h2 className="mt-2 text-2xl font-black">
                        {tournament.name}
                      </h2>

                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {tournament.code}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">
                      {tournament.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] text-slate-600">
                        FORMAT
                      </p>

                      <p className="mt-1 text-xs font-black">
                        {tournament.format.replaceAll(
                          '_',
                          ' ',
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] text-slate-600">
                        TYPE
                      </p>

                      <p className="mt-1 text-xs font-black">
                        {tournament.mode}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] text-slate-600">
                        ENTRIES
                      </p>

                      <p className="mt-1 text-xs font-black">
                        {tournament.approvedEntries}/
                        {tournament.maxEntries}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm font-black text-sky-400">
                    Open Tournament →
                  </p>
                </Link>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
