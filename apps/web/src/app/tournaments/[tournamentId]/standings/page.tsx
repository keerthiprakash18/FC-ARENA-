'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
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

interface Standing {
  position: number;
  registrationId: string;
  entryName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

interface Statistic {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string;
}

export default function StandingsPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [name, setName] =
    useState('');

  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>([]);

  const [
    statistic,
    setStatistic,
  ] =
    useState<Statistic | null>(
      null,
    );

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        const [
          table,
          stats,
        ] =
          await Promise.all([
            authenticatedRequest<{
              success: true;

              data: {
                tournament: {
                  name: string;
                };

                standings:
                  Standing[];
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/standings`,
            ),

            authenticatedRequest<{
              success: true;

              data: {
                statistic:
                  Statistic | null;
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/my-statistics`,
            ),
          ]);

        setName(
          table.data.tournament.name,
        );

        setStandings(
          table.data.standings,
        );

        setStatistic(
          stats.data.statistic,
        );
      } catch {
        router.replace(
          '/dashboard',
        );
      }
    }

    void load();
  }, [
    params.tournamentId,
    router,
  ]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Standings...
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <Link
          href={`/tournaments/${params.tournamentId}`}
          className="text-sm font-bold text-slate-500 hover:text-white"
        >
          ← Back to Tournament
        </Link>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
            {name}
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Standings
          </h1>
        </div>

        {statistic ? (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Matches
              </p>

              <p className="mt-2 text-3xl font-black">
                {statistic.matches}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Wins
              </p>

              <p className="mt-2 text-3xl font-black">
                {statistic.wins}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Goal Difference
              </p>

              <p className="mt-2 text-3xl font-black">
                {statistic.goalDifference >
                0
                  ? '+'
                  : ''}
                {statistic.goalDifference}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Form
              </p>

              <p className="mt-2 text-xl font-black">
                {statistic.form ||
                  '—'}
              </p>
            </article>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
            Your statistics will appear after your first confirmed match result.
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0a1018]">
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4 text-left">
                    #
                  </th>

                  <th className="p-4 text-left">
                    Entry
                  </th>

                  <th className="p-4">
                    P
                  </th>

                  <th className="p-4">
                    W
                  </th>

                  <th className="p-4">
                    D
                  </th>

                  <th className="p-4">
                    L
                  </th>

                  <th className="p-4">
                    GF
                  </th>

                  <th className="p-4">
                    GA
                  </th>

                  <th className="p-4">
                    GD
                  </th>

                  <th className="p-4">
                    PTS
                  </th>

                  <th className="p-4">
                    Form
                  </th>
                </tr>
              </thead>

              <tbody>
                {standings.map(
                  (row) => (
                    <tr
                      key={
                        row.registrationId
                      }
                      className="border-b border-white/5 text-center"
                    >
                      <td className="p-4 text-left font-black text-sky-400">
                        {row.position}
                      </td>

                      <td className="p-4 text-left font-black">
                        {row.entryName}
                      </td>

                      <td className="p-4">
                        {row.played}
                      </td>

                      <td className="p-4">
                        {row.wins}
                      </td>

                      <td className="p-4">
                        {row.draws}
                      </td>

                      <td className="p-4">
                        {row.losses}
                      </td>

                      <td className="p-4">
                        {row.goalsFor}
                      </td>

                      <td className="p-4">
                        {row.goalsAgainst}
                      </td>

                      <td className="p-4">
                        {row.goalDifference >
                        0
                          ? '+'
                          : ''}
                        {row.goalDifference}
                      </td>

                      <td className="p-4 text-lg font-black">
                        {row.points}
                      </td>

                      <td className="p-4 font-black tracking-widest">
                        {row.form ||
                          '—'}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}