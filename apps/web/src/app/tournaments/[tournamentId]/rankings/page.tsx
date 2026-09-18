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

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface PlayerRanking {
  position: number;
  userId: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;

  matches: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  winRate: number;
  performancePoints: number;
  form: string;
}

interface TeamRanking {
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

interface RankingsResponse {
  tournament: {
    id: string;
    leagueId: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    status: string;
  };

  myPosition:
    number | null;

  categories: {
    bestPlayers:
      PlayerRanking[];

    mostWins:
      PlayerRanking[];

    highestWinRate:
      PlayerRanking[];

    bestGoalDifference:
      PlayerRanking[];

    topGoals: {
      available:
        boolean;

      reason:
        string | null;

      entries:
        PlayerRanking[];
    };

    topAssists: {
      available:
        boolean;

      reason:
        string;

      entries:
        PlayerRanking[];
    };

    bestTeams: {
      available:
        boolean;

      reason:
        string | null;

      entries:
        TeamRanking[];
    };
  };
}

type RankingTab =
  | 'BEST_PLAYERS'
  | 'MOST_WINS'
  | 'WIN_RATE'
  | 'GOALS'
  | 'GOAL_DIFFERENCE'
  | 'TEAMS';

function playerName(
  player: PlayerRanking,
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

export default function RankingsPage() {
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

  const [data, setData] =
    useState<RankingsResponse | null>(
      null,
    );

  const [tab, setTab] =
    useState<RankingTab>(
      'BEST_PLAYERS',
    );

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        const response =
          await authenticatedRequest<{
            success: true;

            data:
              RankingsResponse;

            error: null;
          }>(
            `/tournaments/${params.tournamentId}/rankings`,
          );

        setData(
          response.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load rankings.',
        );
      }
    }

    void load();
  }, [
    params.tournamentId,
  ]);

  if (
    !user ||
    !data
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        {error ||
          'Loading Rankings...'}
      </div>
    );
  }

  const categories =
    data.categories;

  let playerRows:
    PlayerRanking[] = [];

  if (
    tab === 'BEST_PLAYERS'
  ) {
    playerRows =
      categories.bestPlayers;
  }

  if (
    tab === 'MOST_WINS'
  ) {
    playerRows =
      categories.mostWins;
  }

  if (
    tab === 'WIN_RATE'
  ) {
    playerRows =
      categories.highestWinRate;
  }

  if (
    tab ===
    'GOAL_DIFFERENCE'
  ) {
    playerRows =
      categories.bestGoalDifference;
  }

  if (
    tab === 'GOALS'
  ) {
    playerRows =
      categories.topGoals.entries;
  }

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/tournaments/${params.tournamentId}`}
            className="text-sm font-bold text-slate-500 hover:text-white"
          >
            ← Tournament
          </Link>

          <Link
            href={`/tournaments/${params.tournamentId}/standings`}
            className="text-sm font-bold text-sky-400"
          >
            Standings
          </Link>
        </div>

        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-7 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            FC ARENA Rankings
          </p>

          <h1 className="mt-3 text-4xl font-black md:text-6xl">
            {data.tournament.name}
          </h1>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-300">
              {data.tournament.mode}
            </span>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-400">
              {data.tournament.format.replaceAll(
                '_',
                ' ',
              )}
            </span>
          </div>

          {data.myPosition ? (
            <div className="mt-8 inline-block rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                My Ranking
              </p>

              <p className="mt-2 text-4xl font-black text-sky-400">
                #{data.myPosition}
              </p>
            </div>
          ) : null}
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            [
              'BEST_PLAYERS',
              'Best Players',
            ],
            [
              'MOST_WINS',
              'Most Wins',
            ],
            [
              'WIN_RATE',
              'Win Rate',
            ],
            [
              'GOALS',
              'Top Goals',
            ],
            [
              'GOAL_DIFFERENCE',
              'Best GD',
            ],
            [
              'TEAMS',
              'Best Teams',
            ],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setTab(
                    value as
                      RankingTab,
                  )
                }
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black ${
                  tab === value
                    ? 'bg-sky-400 text-[#041019]'
                    : 'border border-white/10 text-slate-400'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {tab === 'GOALS' &&
        !categories.topGoals
          .available ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-300">
            {
              categories.topGoals
                .reason
            }
          </div>
        ) : null}

        {tab === 'TEAMS' &&
        !categories.bestTeams
          .available ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-300">
            {
              categories.bestTeams
                .reason
            }
          </div>
        ) : null}

        {tab !== 'TEAMS' &&
        !(
          tab === 'GOALS' &&
          !categories.topGoals
            .available
        ) ? (
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0a1018]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4 text-left">
                      Rank
                    </th>

                    <th className="p-4 text-left">
                      Player
                    </th>

                    <th className="p-4">
                      MP
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
                      GD
                    </th>

                    <th className="p-4">
                      Win %
                    </th>

                    <th className="p-4">
                      Form
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {playerRows.map(
                    (player) => (
                      <tr
                        key={
                          player.userId
                        }
                        className="border-b border-white/5 text-center"
                      >
                        <td className="p-4 text-left">
                          <span className={`font-black ${
                            player.position ===
                            1
                              ? 'text-amber-300'
                              : player.position ===
                                  2
                                ? 'text-slate-300'
                                : player.position ===
                                    3
                                  ? 'text-orange-300'
                                  : 'text-sky-400'
                          }`}>
                            #
                            {
                              player.position
                            }
                          </span>
                        </td>

                        <td className="p-4 text-left">
                          <p className="font-black">
                            {playerName(
                              player,
                            )}
                          </p>

                          <p className="mt-1 font-mono text-xs text-slate-600">
                            {player.playerCode ||
                              '—'}
                          </p>
                        </td>

                        <td className="p-4">
                          {
                            player.matches
                          }
                        </td>

                        <td className="p-4 font-bold">
                          {player.wins}
                        </td>

                        <td className="p-4">
                          {player.draws}
                        </td>

                        <td className="p-4">
                          {player.losses}
                        </td>

                        <td className="p-4">
                          {player.goalsFor}
                        </td>

                        <td className="p-4">
                          {player.goalDifference >
                          0
                            ? '+'
                            : ''}
                          {
                            player.goalDifference
                          }
                        </td>

                        <td className="p-4 font-black text-sky-400">
                          {
                            player.winRate
                          }
                          %
                        </td>

                        <td className="p-4 font-black tracking-widest">
                          {player.form ||
                            '—'}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {playerRows.length ===
            0 ? (
              <p className="p-10 text-center text-sm text-slate-600">
                Rankings will appear after confirmed results.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === 'TEAMS' &&
        categories.bestTeams
          .available ? (
          <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0a1018]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4 text-left">
                      Rank
                    </th>

                    <th className="p-4 text-left">
                      Team
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
                      GD
                    </th>

                    <th className="p-4">
                      PTS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {categories.bestTeams.entries.map(
                    (team) => (
                      <tr
                        key={
                          team.registrationId
                        }
                        className="border-b border-white/5 text-center"
                      >
                        <td className="p-4 text-left font-black text-sky-400">
                          #
                          {
                            team.position
                          }
                        </td>

                        <td className="p-4 text-left font-black">
                          {
                            team.entryName
                          }
                        </td>

                        <td className="p-4">
                          {team.played}
                        </td>

                        <td className="p-4">
                          {team.wins}
                        </td>

                        <td className="p-4">
                          {team.draws}
                        </td>

                        <td className="p-4">
                          {team.losses}
                        </td>

                        <td className="p-4">
                          {team.goalDifference >
                          0
                            ? '+'
                            : ''}
                          {
                            team.goalDifference
                          }
                        </td>

                        <td className="p-4 text-lg font-black">
                          {team.points}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Data Integrity
          </p>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            FC ARENA rankings use confirmed tournament statistics only. Assists are intentionally unavailable until verified Match Event data exists.
          </p>
        </section>
      </div>
    </AppShell>
  );
}