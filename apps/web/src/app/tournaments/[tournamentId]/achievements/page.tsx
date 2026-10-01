'use client';

import Link from 'next/link';
import {
  useParams,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';
import {
  confirmAction,
} from '@/components/fc/confirmation-provider';
import {
  FcPanel,
} from '@/components/fc/fc-ui';
import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  awardedAt: string;

  user: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;
      identity: {
        inGameName: string;
      } | null;
    } | null;
  };
}

interface AchievementData {
  tournament: {
    id: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    status: string;
    completedAt: string | null;
  };

  isLeagueAdmin: boolean;
  achievements: Achievement[];
}

interface RaceRow {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsPerMatch: number;
  cleanSheets: number;
  cleanSheetRate: number;
  goalsAgainstPerMatch: number;
  rating: number | null;
  ratingBreakdown:
    Record<string, number> | null;
}

interface AwardRaceData {
  tournament: {
    id: string;
    name: string;
    status: string;
    mode: string;
  };

  available: boolean;
  reason: string | null;
  goldenBoot: RaceRow[];
  goldenGlove: RaceRow[];
  playerOfTournament:
    RaceRow[];
}

function playerName(
  achievement: Achievement,
) {
  return (
    achievement.user.player
      ?.identity
      ?.inGameName ||
    achievement.user.fullName
  );
}

function racePlayerName(
  row: RaceRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}

function iconFor(
  type: string,
) {
  switch (type) {
    case 'TOURNAMENT_CHAMPION':
      return '🏆';
    case 'TOURNAMENT_RUNNER_UP':
      return '🥈';
    case 'GOLDEN_BOOT':
      return '⚽';
    case 'GOLDEN_GLOVE':
      return '🧤';
    case 'BEST_PLAYER':
      return '⭐';
    case 'WINNING_STREAK':
      return '🔥';
    default:
      return '🎖';
  }
}

function publicAwardName(
  type: string,
) {
  if (
    type ===
    'BEST_PLAYER'
  ) {
    return 'Player of the Tournament';
  }

  return type
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}

function RaceList({
  title,
  icon,
  rows,
  metric,
}: {
  title: string;
  icon: string;
  rows: RaceRow[];
  metric: (
    row: RaceRow,
  ) => string;
}) {
  return (
    <FcPanel className="overflow-hidden">
      <div className="border-b border-white/[0.07] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
          Live Race
        </p>

        <h2 className="mt-1 flex items-center gap-2 text-lg font-black">
          <span>
            {icon}
          </span>
          {title}
        </h2>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {rows
          .slice(
            0,
            5,
          )
          .map(
            (
              row,
            ) => (
              <div
                key={
                  row.userId
                }
                className="grid grid-cols-[32px_1fr_auto] items-center gap-3 p-4"
              >
                <span className={
                  row.position <=
                  3
                    ? 'text-center text-sm font-black text-amber-300'
                    : 'text-center text-xs font-black text-slate-600'
                }>
                  #
                  {
                    row.position
                  }
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">
                    {racePlayerName(
                      row,
                    )}
                  </p>

                  <p className="mt-1 truncate font-mono text-[9px] text-slate-600">
                    {
                      row.playerCode ||
                      'FC Arena Player'
                    }
                  </p>
                </div>

                <p className="text-right text-xs font-black text-slate-300">
                  {metric(
                    row,
                  )}
                </p>
              </div>
            ),
          )}

        {rows.length ===
        0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Verified results will populate this race.
          </div>
        ) : null}
      </div>
    </FcPanel>
  );
}

export default function AchievementsPage() {
  const params =
    useParams<{
      tournamentId:
        string;
    }>();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    data,
    setData,
  ] =
    useState<AchievementData | null>(
      null,
    );

  const [
    races,
    setRaces,
  ] =
    useState<AwardRaceData | null>(
      null,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  async function load() {
    const [
      achievementsResponse,
      racesResponse,
    ] =
      await Promise.all([
        authenticatedRequest<{
          success: true;
          data: AchievementData;
          error: null;
        }>(
          `/tournaments/${params.tournamentId}/achievements`,
        ),

        authenticatedRequest<{
          success: true;
          data: AwardRaceData;
          error: null;
        }>(
          `/tournaments/${params.tournamentId}/award-races`,
        ),
      ]);

    setData(
      achievementsResponse.data,
    );

    setRaces(
      racesResponse.data,
    );
  }

  useEffect(() => {
    let active =
      true;

    async function initialLoad() {
      try {
        const current =
          await getCurrentUser();

        if (!active) {
          return;
        }

        setUser(
          current,
        );

        await load();
      } catch (
        err
      ) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournament awards.',
        );
      }
    }

    void initialLoad();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void load().catch(
              () =>
                undefined,
            );
          }
        },
        15_000,
      );

    return () => {
      active =
        false;
      window.clearInterval(
        interval,
      );
    };
  }, [
    params.tournamentId,
  ]);

  async function completeTournament() {
    if (
      !(await confirmAction(
        'Complete this Tournament? Final verified achievements will be generated permanently.',
      ))
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${params.tournamentId}/complete`,
        {
          method:
            'POST',
        },
      );

      await load();

      setMessage(
        'Tournament completed and final awards generated.',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete Tournament.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    !user ||
    !data
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        {
          error ||
          'Loading Awards...'
        }
      </div>
    );
  }

  const headlineAwards =
    data.achievements.filter(
      (
        achievement,
      ) =>
        achievement.type !==
        'TOURNAMENT_PARTICIPATION',
    );

  const participation =
    data.achievements.filter(
      (
        achievement,
      ) =>
        achievement.type ===
        'TOURNAMENT_PARTICIPATION',
    );

  const isCompleted =
    data.tournament.status ===
    'COMPLETED';

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={
              `/tournaments/${params.tournamentId}`
            }
            className="text-sm font-black text-slate-500 transition hover:text-white"
          >
            ← Tournament
          </Link>

          <Link
            href="/awards"
            className="text-sm font-black text-amber-300"
          >
            Hall of Honours →
          </Link>
        </div>

        <TournamentNavigation
          tournamentId={
            params.tournamentId
          }
        />

        <section className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-[#0a1018] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />

          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Tournament Honours
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-5xl">
              {
                data.tournament
                  .name
              }
            </h1>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-black text-sky-300">
                {
                  data.tournament
                    .mode
                }
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-400">
                {
                  data.tournament
                    .status
                }
              </span>
            </div>

            {data.isLeagueAdmin &&
            !isCompleted &&
            data.tournament
              .status !==
              'CANCELLED' ? (
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void completeTournament()
                }
                className="mt-7 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#151006] disabled:opacity-50"
              >
                {
                  busy
                    ? 'Generating...'
                    : 'Complete Tournament & Generate Awards'
                }
              </button>
            ) : null}
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm font-semibold text-emerald-300">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
            {
              error
            }
          </div>
        ) : null}

        {!isCompleted &&
        races?.available ? (
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Live Performance
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Award Races
            </h2>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <RaceList
                title="Golden Boot"
                icon="⚽"
                rows={
                  races.goldenBoot
                }
                metric={
                  (
                    row,
                  ) =>
                    `${row.goals} goals · ${row.goalsPerMatch}/M`
                }
              />

              <RaceList
                title="Golden Glove"
                icon="🧤"
                rows={
                  races.goldenGlove
                }
                metric={
                  (
                    row,
                  ) =>
                    `${row.cleanSheets} CS · ${row.goalsAgainstPerMatch} GA/M`
                }
              />

              <RaceList
                title="Player of Tournament"
                icon="⭐"
                rows={
                  races.playerOfTournament
                }
                metric={
                  (
                    row,
                  ) =>
                    `${row.rating ?? 0}/100`
                }
              />
            </div>
          </section>
        ) : null}

        {!isCompleted &&
        races &&
        !races.available ? (
          <FcPanel className="p-5">
            <p className="text-sm leading-6 text-slate-500">
              {
                races.reason
              }
            </p>
          </FcPanel>
        ) : null}

        {isCompleted ? (
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Official Awards
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Final Honours
            </h2>

            {headlineAwards.length >
            0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {headlineAwards.map(
                  (
                    achievement,
                  ) => (
                    <FcPanel
                      key={
                        achievement.id
                      }
                      className="relative overflow-hidden p-6"
                    >
                      <div className="absolute -right-4 -top-5 text-7xl opacity-[0.05]">
                        {iconFor(
                          achievement.type,
                        )}
                      </div>

                      <p className="text-4xl">
                        {iconFor(
                          achievement.type,
                        )}
                      </p>

                      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                        {publicAwardName(
                          achievement.type,
                        )}
                      </p>

                      <h3 className="mt-2 text-xl font-black">
                        {playerName(
                          achievement,
                        )}
                      </h3>

                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        {
                          achievement.user
                            .player
                            ?.playerCode ||
                          'FC Arena Player'
                        }
                      </p>

                      {achievement.description ? (
                        <p className="mt-4 text-sm leading-6 text-slate-500">
                          {
                            achievement.description
                          }
                        </p>
                      ) : null}
                    </FcPanel>
                  ),
                )}
              </div>
            ) : (
              <FcPanel className="mt-4 p-8 text-center text-sm text-slate-500">
                No final awards were generated.
              </FcPanel>
            )}
          </section>
        ) : (
          <FcPanel className="p-6 text-center">
            <p className="text-4xl">
              🏆
            </p>

            <h2 className="mt-3 text-xl font-black">
              Tournament Still Active
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Final achievements are locked only after tournament matches are complete and verified.
            </p>
          </FcPanel>
        )}

        {participation.length >
        0 ? (
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Participants
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {participation.map(
                (
                  achievement,
                ) => (
                  <FcPanel
                    key={
                      achievement.id
                    }
                    className="p-4"
                  >
                    <p className="text-sm font-black">
                      🎖{' '}
                      {playerName(
                        achievement,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Tournament Participation
                    </p>
                  </FcPanel>
                ),
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
