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


interface GroupEntry {
  id: string;
  entryName: string | null;

  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}


interface TournamentGroup {
  id: string;
  name: string;
  position: number;
  entries: GroupEntry[];
}


function entryDisplayName(
  entry: GroupEntry,
) {
  if (entry.entryName) {
    return entry.entryName;
  }

  return (
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    'Tournament Entry'
  );
}


function compareRows(
  a: Standing,
  b: Standing,
) {
  if (b.points !== a.points) {
    return b.points - a.points;
  }

  if (
    b.goalDifference !==
    a.goalDifference
  ) {
    return (
      b.goalDifference -
      a.goalDifference
    );
  }

  if (
    b.goalsFor !==
    a.goalsFor
  ) {
    return (
      b.goalsFor -
      a.goalsFor
    );
  }

  return a.entryName.localeCompare(
    b.entryName,
  );
}


function StandingTable({
  title,
  entries,
  standings,
}: {
  title: string;
  entries: GroupEntry[];
  standings: Standing[];
}) {
  const lookup =
    new Map(
      standings.map(
        (standing) => [
          standing.registrationId,
          standing,
        ],
      ),
    );

  const rows =
    entries
      .map(
        (entry) => {
          const existing =
            lookup.get(
              entry.id,
            );

          if (existing) {
            return {
              ...existing,

              entryName:
                existing.entryName ||
                entryDisplayName(
                  entry,
                ),
            };
          }

          return {
            position: 0,
            registrationId:
              entry.id,

            entryName:
              entryDisplayName(
                entry,
              ),

            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,

            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,

            points: 0,
            form: '',
          };
        },
      )
      .sort(
        compareRows,
      )
      .map(
        (
          row,
          index,
        ) => ({
          ...row,
          position:
            index + 1,
        }),
      );

  return (
    <section className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1018]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Group Standings
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {title}
          </h2>
        </div>

        <span className="rounded-full bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300">
          {entries.length}{' '}
          Entries
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase text-slate-500">
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
                FORM
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(
              (row) => (
                <tr
                  key={
                    row.registrationId
                  }
                  className="border-b border-white/5 text-center last:border-0"
                >
                  <td className="p-4 text-left">
                    <span
                      className={`inline-grid h-8 w-8 place-items-center rounded-xl font-black ${
                        row.position <=
                        2
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-white/[0.03] text-slate-500'
                      }`}
                    >
                      {
                        row.position
                      }
                    </span>
                  </td>

                  <td className="p-4 text-left font-black">
                    {
                      row.entryName
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.played
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.wins
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.draws
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.losses
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.goalsFor
                    }
                  </td>

                  <td className="p-4">
                    {
                      row.goalsAgainst
                    }
                  </td>

                  <td className="p-4 font-bold">
                    {row.goalDifference >
                    0
                      ? '+'
                      : ''}

                    {
                      row.goalDifference
                    }
                  </td>

                  <td className="p-4 text-lg font-black text-sky-300">
                    {
                      row.points
                    }
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
  );
}


export default function StandingsPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    name,
    setName,
  ] =
    useState('');

  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>(
      [],
    );

  const [
    groups,
    setGroups,
  ] =
    useState<TournamentGroup[]>(
      [],
    );

  const [
    statistic,
    setStatistic,
  ] =
    useState<Statistic | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const [
          table,
          groupData,
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
                groups:
                  TournamentGroup[];
              };

              error: null;
            }>(
              `/tournaments/${params.tournamentId}/groups`,
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
          table.data
            .tournament
            .name,
        );

        setStandings(
          table.data
            .standings,
        );

        setGroups(
          groupData.data
            .groups,
        );

        setStatistic(
          stats.data
            .statistic,
        );
      } catch {
        router.replace(
          `/tournaments/${params.tournamentId}`,
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void load();
  }, [
    params.tournamentId,
    router,
  ]);


  if (
    !user ||
    loading
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Standings...
      </div>
    );
  }


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <Link
          href={`/tournaments/${params.tournamentId}`}
          scroll
          className="text-sm font-bold text-slate-500 hover:text-white"
        >
          ← Back to
          Tournament
        </Link>

        <section>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
            {name}
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            Standings
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Group tables update
            from confirmed match
            results.
          </p>
        </section>


        {statistic ? (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Matches
              </p>

              <p className="mt-2 text-3xl font-black">
                {
                  statistic.matches
                }
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
              <p className="text-xs text-slate-600">
                Wins
              </p>

              <p className="mt-2 text-3xl font-black">
                {
                  statistic.wins
                }
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

                {
                  statistic.goalDifference
                }
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
        ) : null}


        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups
              .sort(
                (
                  a,
                  b,
                ) =>
                  a.position -
                  b.position,
              )
              .map(
                (
                  group,
                ) => (
                  <StandingTable
                    key={
                      group.id
                    }
                    title={
                      group.name
                    }
                    entries={
                      group.entries
                    }
                    standings={
                      standings
                    }
                  />
                ),
              )}
          </div>
        ) : (
          <section className="rounded-[24px] border border-dashed border-white/10 p-10 text-center">
            <p className="font-black text-slate-300">
              Groups have not
              been configured.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Create tournament
              groups before using
              group standings.
            </p>

            <Link
              href={`/tournaments/${params.tournamentId}/groups`}
              scroll
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Groups
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}