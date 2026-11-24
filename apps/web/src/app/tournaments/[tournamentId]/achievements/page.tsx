'use client';

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by resource identifiers; loader callback identity must not retrigger network work. */

import Link from 'next/link';
import { AwardRaceBoard } from '@/components/fc/award-race-board';
import { PremiumHero } from '@/components/fc/premium-ui';
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
  FcNotice,
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

interface VerifiedScoreRow {
  id: string;
  name: string;
  position: number;
  matches: number;
  games?: number;
  goalsPerGame?: number;
  goalsAgainstPerGame?: number;
  goals: number;
  goalsPerMatch: number;
  cleanSheets: number;
  goalsAgainstPerMatch: number;
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
  verifiedScoreRaces?: {
    scope: 'PLAYER' | 'TEAM';
    goldenBoot: VerifiedScoreRow[];
    goldenGlove: VerifiedScoreRow[];
  };
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

function RaceList<Row extends RaceRow | VerifiedScoreRow>({
  title,
  icon,
  rows,
  metric,
}: {
  title: string;
  icon: string;
  rows: Row[];
  metric: (
    row: Row,
  ) => string;
}) {
  if (title.includes('Golden Boot') || title === 'Golden Glove' || title === 'Team Defensive Record') {
    return (
      <FcPanel className="overflow-hidden">
        <AwardRaceBoard kind={title.includes('Boot') ? 'boot' : 'glove'} title={title} entryLabel="entry"
          entries={rows.map((row: RaceRow | VerifiedScoreRow) => ({ ...row,
            id: 'id' in row ? row.id : row.userId,
            name: 'name' in row ? row.name : racePlayerName(row),
            detail: 'playerCode' in row ? row.playerCode ?? undefined : undefined,
          }))} />
      </FcPanel>
    );
  }
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
        <p className="mt-2 text-xs text-slate-400" role="status">
          All {rows.length} verified {rows.length === 1 ? 'entry' : 'entries'} ranked · Scroll to see the complete race
        </p>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {rows.map(
            (
              row,
            ) => (
              <div
                key={
                  'id' in row ? row.id : row.userId
                }
                className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[32px_minmax(0,1fr)_auto]"
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
                    {'name' in row ? row.name : racePlayerName(row)}
                  </p>

                  <p className="mt-1 truncate font-mono text-[9px] text-slate-600">
                    {
                      'playerCode' in row
                        ? row.playerCode || 'FC Arena Player'
                        : `${row.matches} ${row.matches === 1 ? 'match' : 'matches'}${row.games !== undefined ? ` · ${row.games} ${row.games === 1 ? 'game' : 'games'}` : ''}`
                    }
                  </p>
                </div>

                <p className="col-start-2 -mt-1 text-left text-xs font-black text-slate-300 sm:col-start-auto sm:mt-0 sm:max-w-36 sm:text-right">
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

    let refreshing = false;
    async function refresh() {
      if (document.visibilityState !== 'visible' || refreshing) return;
      refreshing = true;
      try {
        await load();
      } catch {
        // Keep the last successful standings and retry on the next refresh.
      } finally {
        refreshing = false;
      }
    }
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      active =
        false;
      window.clearInterval(
        interval,
      );
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [
    params.tournamentId,
  ]);

  async function completeTournament() {
    if (
      !(await confirmAction(
        { title: 'Complete tournament?', description: 'Complete this tournament and permanently generate its final verified achievements?', confirmLabel: 'Complete tournament' },
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

        <PremiumHero title={data.tournament.name} eyebrow="Tournament Honours">
          <div className="premium-hero-tags">
            <span>{data.tournament.mode}</span>
            <span>{data.tournament.status.replaceAll('_', ' ')}</span>
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
              className="theme-primary-button mt-5 min-h-11 border px-4 py-2 text-sm"
            >
              {
                busy
                  ? 'Generating...'
                  : 'Complete Tournament & Generate Awards'
              }
            </button>
          ) : null}
        </PremiumHero>

        <section aria-label="Awards guide and current status" className="theme-panel rounded-2xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">Your tournament awards</p>
              <h2 className="mt-1 text-xl font-black">
                {data.tournament.mode === 'DUO' ? 'DUO: Individual + Team Honours' : data.tournament.mode === 'TEAM' ? 'Team Honours' : 'SOLO: Player Honours'}
              </h2>
            </div>
            <span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs font-bold text-amber-200">
              {isCompleted ? 'OFFICIAL WINNERS PUBLISHED' : 'LIVE RACES · NOT FINAL'}
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 p-3">
              <h3 className="font-bold">Available now · Award Races</h3>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Verified goals and clean sheets show provisional leaders while matches are ongoing.
                DUO player results are only individual when individual game scores are verified.
              </p>
              {!isCompleted ? <a href="#live-award-races" className="mt-2 inline-block text-sm font-bold text-sky-300 underline underline-offset-4">See live races ↓</a> : null}
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <h3 className="font-bold">After the final · Official Awards</h3>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Champion, player honours and, for DUO/TEAM tournaments, separate official Team Golden Boot
                and Team Defensive Record are available after finalisation.
              </p>
              {isCompleted && (data.tournament.mode === 'DUO' || data.tournament.mode === 'TEAM') ? (
                <Link href={`/tournaments/${params.tournamentId}/summary#team-honours`}
                  className="mt-2 inline-block text-sm font-bold text-amber-300 underline underline-offset-4">
                  Open Official Team Trophy Archive →
                </Link>
              ) : (
                <span className="mt-2 block text-xs font-semibold text-amber-300">
                  {isCompleted ? 'See Final Honours below.' : 'Team trophy archive unlocks after completion.'}
                </span>
              )}
            </div>
          </div>
          {!isCompleted ? <p className="mt-3 text-xs text-slate-400">Official awards are locked until all required stage and playoff results are verified. Do not use provisional standings as trophy winners.</p> : null}
        </section>

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>

        {!isCompleted &&
        races?.available ? (
          <section id="live-award-races" className="scroll-mt-24">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Live Performance
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Award Races
            </h2>
             <p className="mt-2 text-xs text-slate-400">Provisional. Only confirmed results count; official honours are issued after tournament finalisation.</p>

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

        {!isCompleted && races?.verifiedScoreRaces ? (
          <section id={races.available ? undefined : 'live-award-races'} className="scroll-mt-24">
            <h2 className="text-2xl font-black">
              {races.verifiedScoreRaces.scope === 'TEAM' ? 'DUO / TEAM Award Races' : 'Verified DUO Player Award Races'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {races.verifiedScoreRaces.scope === 'TEAM'
                ? 'Provisional team records from confirmed aggregate scores. These are not individual player awards.'
                : 'Matches count the completed fixtures you played. Games, goals and rates use only your own confirmed Duo games. Official honours are awarded at tournament finalisation.'}
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <RaceList
                title={races.verifiedScoreRaces.scope === 'TEAM' ? 'Team Golden Boot' : 'Golden Boot'}
                icon="⚽"
                rows={races.verifiedScoreRaces.goldenBoot}
                metric={(row) => row.games !== undefined
                  ? `${row.goals} goals · ${row.goalsPerGame ?? row.goalsPerMatch}/game`
                  : `${row.goals} goals · ${row.goalsPerMatch}/M`}
              />
              <RaceList
                title={races.verifiedScoreRaces.scope === 'TEAM' ? 'Team Defensive Record' : 'Golden Glove'}
                icon="🧤"
                rows={races.verifiedScoreRaces.goldenGlove}
                metric={(row) => row.games !== undefined
                  ? `${row.cleanSheets} CS · ${row.goalsAgainstPerGame ?? row.goalsAgainstPerMatch} GA/game`
                  : `${row.cleanSheets} CS · ${row.goalsAgainstPerMatch} GA/M`}
              />
            </div>
          </section>
        ) : null}

        {!isCompleted &&
        races &&
        !races.available &&
        !races.verifiedScoreRaces ? (
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
