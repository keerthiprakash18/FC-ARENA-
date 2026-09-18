'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
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
  groupName: string | null;
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

function StandingsTable({
  title,
  rows,
}: {
  title: string;
  rows: Standing[];
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0a1018]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
            Points Table
          </p>
          <h2 className="mt-1 text-xl font-black">
            {title}
          </h2>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-slate-400">
          {rows.length} entries
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
            <tr>
              <th className="p-4 text-left">#</th>
              <th className="p-4 text-left">Entry</th>
              <th className="p-4">P</th>
              <th className="p-4">W</th>
              <th className="p-4">D</th>
              <th className="p-4">L</th>
              <th className="p-4">GF</th>
              <th className="p-4">GA</th>
              <th className="p-4">GD</th>
              <th className="p-4">PTS</th>
              <th className="p-4">Form</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.registrationId}
                className="border-b border-white/5 text-center last:border-b-0"
              >
                <td className="p-4 text-left font-black text-sky-400">
                  {row.position}
                </td>

                <td className="p-4 text-left font-black">
                  {row.entryName}
                </td>

                <td className="p-4">{row.played}</td>
                <td className="p-4">{row.wins}</td>
                <td className="p-4">{row.draws}</td>
                <td className="p-4">{row.losses}</td>
                <td className="p-4">{row.goalsFor}</td>
                <td className="p-4">{row.goalsAgainst}</td>

                <td className="p-4">
                  {row.goalDifference > 0 ? '+' : ''}
                  {row.goalDifference}
                </td>

                <td className="p-4 text-lg font-black">
                  {row.points}
                </td>

                <td className="p-4 font-black tracking-widest">
                  {row.form || '—'}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="p-8 text-center text-slate-600"
                >
                  No approved entries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
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

  const tables =
    useMemo(() => {
      const grouped =
        new Map<
          string,
          Standing[]
        >();

      for (
        const row
        of standings
      ) {
        const key =
          row.groupName
            ? `Group ${row.groupName}`
            : 'League Table';

        const current =
          grouped.get(key) ??
          [];

        current.push(row);
        grouped.set(
          key,
          current,
        );
      }

      return [
        ...grouped.entries(),
      ];
    }, [standings]);

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

          <p className="mt-3 text-sm text-slate-500">
            Single-table tournaments use one points table. Group tournaments keep each group table completely separate.
          </p>
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
                {statistic.goalDifference > 0
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

        <div className="grid gap-5">
          {tables.length > 0 ? (
            tables.map(
              ([
                title,
                rows,
              ]) => (
                <StandingsTable
                  key={title}
                  title={title}
                  rows={rows}
                />
              ),
            )
          ) : (
            <StandingsTable
              title="League Table"
              rows={[]}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
