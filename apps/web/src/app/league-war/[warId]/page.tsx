'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';
import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface Player {
  id: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
}

interface RosterSlot {
  id: string;
  slot: number;
  leagueId: string;
  user: Player;
}

interface WarMatch {
  id: string;
  sequence: number;
  leg: number;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  completedAt: string | null;
  homePlayer: Player;
  awayPlayer: Player;
}

interface SideScore {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface WarDetail {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  legType: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  winnerLeagueId: string | null;
  homeLeague: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  awayLeague: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  permissions: {
    canManageHome: boolean;
    canManageAway: boolean;
    canAccept: boolean;
    canStart: boolean;
    canUpdateResults: boolean;
    canComplete: boolean;
  };
  roster: {
    home: RosterSlot[];
    away: RosterSlot[];
  };
  candidates: {
    home: Player[];
    away: Player[];
  };
  matches: WarMatch[];
  summary: {
    completedMatches: number;
    totalMatches: number;
    remainingMatches: number;
    home: SideScore;
    away: SideScore;
    leaderLeagueId: string | null;
    tieBreakOrder: string[];
  };
}

function displayName(
  player: Player,
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

export default function LeagueWarDetailPage() {
  const {
    warId,
  } =
    useParams<{
      warId: string;
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
    war,
    setWar,
  ] =
    useState<WarDetail | null>(
      null,
    );

  const [
    homeSelection,
    setHomeSelection,
  ] =
    useState<string[]>(
      [],
    );

  const [
    awaySelection,
    setAwaySelection,
  ] =
    useState<string[]>(
      [],
    );

  const [
    scores,
    setScores,
  ] =
    useState<
      Record<
        string,
        {
          home: string;
          away: string;
        }
      >
    >({});

  const [
    busy,
    setBusy,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null,
    );

  async function load() {
    const response =
      await authenticatedRequest<any>(
        `/league-wars/${warId}`,
      );

    const next:
      WarDetail =
      response.data.war;

    setWar(next);

    if (
      next.status !==
      'LIVE'
    ) {
      setHomeSelection(
        next.roster.home.map(
          (
            row,
          ) =>
            row.user.id,
        ),
      );

      setAwaySelection(
        next.roster.away.map(
          (
            row,
          ) =>
            row.user.id,
        ),
      );
    }

    setScores(
      Object.fromEntries(
        next.matches.map(
          (
            match,
          ) => [
            match.id,
            {
              home:
                match.homeScore ===
                null
                  ? ''
                  : String(
                      match.homeScore,
                    ),
              away:
                match.awayScore ===
                null
                  ? ''
                  : String(
                      match.awayScore,
                    ),
            },
          ],
        ),
      ),
    );

    setLastUpdated(
      new Date(),
    );
  }

  useEffect(() => {
    void getCurrentUser()
      .then(
        (
          current,
        ) => {
          setUser(
            current,
          );
          return load();
        },
      )
      .catch(
        () =>
          router.replace(
            '/login',
          ),
      );
  }, [
    router,
    warId,
  ]);

  useEffect(() => {
    if (
      war?.status !==
      'LIVE'
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
              'visible' &&
            !busy
          ) {
            void load().catch(
              () =>
                undefined,
            );
          }
        },
        10_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [
    war?.status,
    busy,
    warId,
  ]);

  const allMatchesComplete =
    useMemo(
      () =>
        Boolean(
          war &&
          war.matches.length >
            0 &&
          war.matches.every(
            (
              match,
            ) =>
              match.status ===
              'COMPLETED',
          ),
        ),
      [
        war,
      ],
    );

  async function action(
    key: string,
    path: string,
    options:
      RequestInit = {
        method:
          'POST',
      },
  ) {
    setBusy(
      key,
    );
    setError(
      '',
    );

    try {
      await authenticatedRequest(
        path,
        options,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'League War action failed.',
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  function togglePlayer(
    side:
      'home' |
      'away',
    userId: string,
  ) {
    if (!war) {
      return;
    }

    const current =
      side ===
      'home'
        ? homeSelection
        : awaySelection;

    const setter =
      side ===
      'home'
        ? setHomeSelection
        : setAwaySelection;

    if (
      current.includes(
        userId,
      )
    ) {
      setter(
        current.filter(
          (
            id,
          ) =>
            id !==
            userId,
        ),
      );
      return;
    }

    if (
      current.length >=
      war.playerCount
    ) {
      return;
    }

    setter([
      ...current,
      userId,
    ]);
  }

  async function saveRoster(
    side:
      'home' |
      'away',
  ) {
    if (!war) {
      return;
    }

    await action(
      `roster-${side}`,
      `/league-wars/${war.id}/roster`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            leagueId:
              side ===
              'home'
                ? war.homeLeague.id
                : war.awayLeague.id,
            userIds:
              side ===
              'home'
                ? homeSelection
                : awaySelection,
          }),
      },
    );
  }

  async function saveResult(
    match:
      WarMatch,
  ) {
    if (!war) {
      return;
    }

    const row =
      scores[
        match.id
      ];

    const home =
      Number(
        row?.home,
      );
    const away =
      Number(
        row?.away,
      );

    if (
      row?.home ===
        '' ||
      row?.away ===
        '' ||
      !Number.isInteger(
        home,
      ) ||
      !Number.isInteger(
        away,
      ) ||
      home <
        0 ||
      away <
        0
    ) {
      setError(
        'Enter valid non-negative scores.',
      );
      return;
    }

    await action(
      `match-${match.id}`,
      `/league-wars/${war.id}/matches/${match.id}/result`,
      {
        method:
          'PATCH',
        body:
          JSON.stringify({
            homeScore:
              home,
            awayScore:
              away,
          }),
      },
    );
  }

  if (
    !user ||
    !war
  ) {
    return (
      <FcLoadingScreen label="Loading League War..." />
    );
  }

  const leader =
    war.summary
      .leaderLeagueId;

  const winner =
    war.winnerLeagueId;

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
            href="/league-war"
            className="text-sm font-black text-slate-500 transition hover:text-rose-300"
          >
            ← League Wars
          </Link>

          <div className="flex items-center gap-2">
            <FcStatusBadge
              label={
                war.status
              }
              tone={
                war.status ===
                'LIVE'
                  ? 'red'
                  : war.status ===
                      'COMPLETED'
                    ? 'emerald'
                    : 'amber'
              }
            />

            {war.status ===
            'LIVE' ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                ● Live · 10s
                {lastUpdated
                  ? ` · ${lastUpdated.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
            {
              error
            }
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] border border-rose-400/20 bg-[#0B0F14] p-5 sm:p-7">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400/10 blur-3xl" />

          <div className="relative text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-300">
              ⚔ FC Arena League War
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-4xl">
              {
                war.name
              }
            </h1>

            <p className="mt-2 text-xs text-slate-500">
              {
                war.playerCount
              }v{
                war.playerCount
              } · {
                war.legType ===
                'HOME_AWAY'
                  ? 'Home & Away'
                  : 'One Leg'
              } · W{
                war.winPoints
              } / D{
                war.drawPoints
              } / L{
                war.lossPoints
              }
            </p>
          </div>

          <div className="relative mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="min-w-0 text-center">
              <div className="mx-auto flex justify-center">
                <FcCrest
                  name={
                    war.homeLeague
                      .name
                  }
                  imageUrl={
                    war.homeLeague
                      .logoUrl
                  }
                  size="lg"
                />
              </div>

              <p className="mt-3 truncate text-sm font-black sm:text-lg">
                {
                  war.homeLeague
                    .name
                }
              </p>

              <p className={
                leader ===
                  war.homeLeague
                    .id ||
                winner ===
                  war.homeLeague
                    .id
                  ? 'mt-3 text-5xl font-black text-rose-300'
                  : 'mt-3 text-5xl font-black text-white'
              }>
                {
                  war.summary
                    .home.points
                }
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                War Points
              </p>
            </div>

            <div className="text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/[0.07] text-xl">
                ⚔
              </span>

              <p className="mt-3 text-xs font-black text-slate-400">
                {
                  war.summary
                    .completedMatches
                } / {
                  war.summary
                    .totalMatches
                }
              </p>

              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                played
              </p>
            </div>

            <div className="min-w-0 text-center">
              <div className="mx-auto flex justify-center">
                <FcCrest
                  name={
                    war.awayLeague
                      .name
                  }
                  imageUrl={
                    war.awayLeague
                      .logoUrl
                  }
                  size="lg"
                />
              </div>

              <p className="mt-3 truncate text-sm font-black sm:text-lg">
                {
                  war.awayLeague
                    .name
                }
              </p>

              <p className={
                leader ===
                  war.awayLeague
                    .id ||
                winner ===
                  war.awayLeague
                    .id
                  ? 'mt-3 text-5xl font-black text-rose-300'
                  : 'mt-3 text-5xl font-black text-white'
              }>
                {
                  war.summary
                    .away.points
                }
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                War Points
              </p>
            </div>
          </div>

          {war.status ===
          'COMPLETED' ? (
            <div className="relative mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                Final Result
              </p>

              <p className="mt-2 text-lg font-black">
                {winner
                  ? `${
                      winner ===
                      war.homeLeague
                        .id
                        ? war.homeLeague
                            .name
                        : war.awayLeague
                            .name
                    } wins the League War 🏆`
                  : 'League War ends in a draw 🤝'}
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <FcStatCard
            label="Home Wins"
            value={
              war.summary
                .home.wins
            }
            tone="cyan"
          />

          <FcStatCard
            label="Away Wins"
            value={
              war.summary
                .away.wins
            }
            tone="amber"
          />

          <FcStatCard
            label="Draws"
            value={
              war.summary
                .home.draws
            }
          />

          <FcStatCard
            label="Home GD"
            value={
              war.summary
                .home
                .goalDifference
            }
            tone="emerald"
          />

          <FcStatCard
            label="Away GD"
            value={
              war.summary
                .away
                .goalDifference
            }
            tone="emerald"
          />

          <FcStatCard
            label="Remaining"
            value={
              war.summary
                .remainingMatches
            }
          />
        </section>

        {war.permissions
          .canAccept ? (
          <FcPanel className="border-amber-400/20 p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Challenge Received
            </p>

            <h2 className="mt-1 text-xl font-black">
              Accept League War?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Accepting locks the rules and opens roster selection for both League admins.
            </p>

            <button
              type="button"
              disabled={
                Boolean(
                  busy,
                )
              }
              onClick={() =>
                void action(
                  'accept',
                  `/league-wars/${war.id}/accept`,
                )
              }
              className="mt-5 min-h-11 rounded-xl bg-amber-300 px-6 text-sm font-black text-[#151006] disabled:opacity-40"
            >
              {busy ===
              'accept'
                ? 'Accepting...'
                : 'Accept Challenge ⚔'}
            </button>
          </FcPanel>
        ) : null}

        {war.status ===
          'INVITED' &&
        !war.permissions
          .canAccept ? (
          <FcPanel className="p-5">
            <p className="text-sm font-black text-amber-300">
              Waiting for {
                war.awayLeague
                  .name
              } admin to accept.
            </p>
          </FcPanel>
        ) : null}

        {war.status ===
        'ACCEPTED' ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {[
              {
                side:
                  'home' as const,
                league:
                  war.homeLeague,
                canManage:
                  war.permissions
                    .canManageHome,
                candidates:
                  war.candidates
                    .home,
                selection:
                  homeSelection,
                roster:
                  war.roster
                    .home,
              },
              {
                side:
                  'away' as const,
                league:
                  war.awayLeague,
                canManage:
                  war.permissions
                    .canManageAway,
                candidates:
                  war.candidates
                    .away,
                selection:
                  awaySelection,
                roster:
                  war.roster
                    .away,
              },
            ].map(
              (
                side,
              ) => (
                <FcPanel
                  key={
                    side.side
                  }
                  className="overflow-hidden"
                >
                  <div className="border-b border-white/[0.07] p-5">
                    <div className="flex items-center gap-3">
                      <FcCrest
                        name={
                          side.league
                            .name
                        }
                        imageUrl={
                          side.league
                            .logoUrl
                        }
                      />

                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black">
                          {
                            side.league
                              .name
                          }
                        </h2>

                        <p className="text-xs text-slate-500">
                          Roster {
                            side.roster
                              .length
                          }/{
                            war.playerCount
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {side.canManage ? (
                    <div className="p-5">
                      <p className="text-xs leading-5 text-slate-500">
                        Select players in pairing order. Slot 1 faces opponent Slot 1, Slot 2 faces Slot 2, and so on.
                      </p>

                      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {side.candidates.map(
                          (
                            player,
                          ) => {
                            const selected =
                              side.selection.includes(
                                player.id,
                              );

                            const slot =
                              side.selection.indexOf(
                                player.id,
                              ) +
                              1;

                            return (
                              <button
                                key={
                                  player.id
                                }
                                type="button"
                                onClick={() =>
                                  togglePlayer(
                                    side.side,
                                    player.id,
                                  )
                                }
                                className={
                                  selected
                                    ? 'flex w-full items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-400/[0.08] p-3 text-left'
                                    : 'flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left'
                                }
                              >
                                <span className={
                                  selected
                                    ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-400 text-xs font-black text-[#18070b]'
                                    : 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-black text-slate-600'
                                }>
                                  {selected
                                    ? slot
                                    : '+'}
                                </span>

                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black">
                                    {displayName(
                                      player,
                                    )}
                                  </span>

                                  <span className="mt-0.5 block font-mono text-[9px] text-slate-600">
                                    {
                                      player.playerCode ||
                                      'FC Arena Player'
                                    }
                                  </span>
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          Boolean(
                            busy,
                          )
                        }
                        onClick={() =>
                          void saveRoster(
                            side.side,
                          )
                        }
                        className="mt-4 min-h-11 w-full rounded-xl bg-rose-400 px-5 text-sm font-black text-[#18070b] disabled:opacity-40"
                      >
                        {busy ===
                        `roster-${side.side}`
                          ? 'Saving...'
                          : `Save Roster (${side.selection.length}/${war.playerCount})`}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {side.roster.map(
                        (
                          row,
                        ) => (
                          <div
                            key={
                              row.id
                            }
                            className="flex items-center gap-3 px-5 py-3"
                          >
                            <span className="w-8 text-center text-xs font-black text-rose-300">
                              #{
                                row.slot
                              }
                            </span>

                            <p className="truncate text-sm font-black">
                              {displayName(
                                row.user,
                              )}
                            </p>
                          </div>
                        ),
                      )}

                      {side.roster
                        .length ===
                      0 ? (
                        <p className="p-5 text-sm text-slate-500">
                          Waiting for opponent roster.
                        </p>
                      ) : null}
                    </div>
                  )}
                </FcPanel>
              ),
            )}

            {war.permissions
              .canStart ? (
              <FcPanel className="p-5 xl:col-span-2">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
                      Ready Check
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Start League War
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Both rosters need exactly {
                        war.playerCount
                      } players. Pairings are created by roster slot order.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busy,
                      ) ||
                      war.roster
                        .home
                        .length !==
                        war.playerCount ||
                      war.roster
                        .away
                        .length !==
                        war.playerCount
                    }
                    onClick={() =>
                      void action(
                        'start',
                        `/league-wars/${war.id}/start`,
                      )
                    }
                    className="min-h-12 rounded-xl bg-rose-400 px-7 text-sm font-black text-[#18070b] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busy ===
                    'start'
                      ? 'Starting...'
                      : 'Start War ⚔'}
                  </button>
                </div>
              </FcPanel>
            ) : null}
          </section>
        ) : null}

        {[
          'LIVE',
          'COMPLETED',
        ].includes(
          war.status,
        ) ? (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                  Battles
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Match Pairings
                </h2>
              </div>

              <p className="text-xs font-semibold text-slate-500">
                Results instantly update War Points
              </p>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {war.matches.map(
                (
                  match,
                ) => {
                  const row =
                    scores[
                      match.id
                    ] ?? {
                      home: '',
                      away: '',
                    };

                  return (
                    <FcPanel
                      key={
                        match.id
                      }
                      className="p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                          Match {
                            match.sequence
                          } · Leg {
                            match.leg
                          }
                        </p>

                        <FcStatusBadge
                          label={
                            match.status
                          }
                          tone={
                            match.status ===
                            'COMPLETED'
                              ? 'emerald'
                              : 'slate'
                          }
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 text-right">
                          <p className="truncate text-sm font-black">
                            {displayName(
                              match.homePlayer,
                            )}
                          </p>

                          <p className="mt-1 truncate text-[9px] text-slate-600">
                            {
                              war.homeLeague
                                .name
                            }
                          </p>
                        </div>

                        {war.permissions
                          .canUpdateResults ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={
                                row.home
                              }
                              onChange={(
                                event,
                              ) =>
                                setScores(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [match.id]: {
                                      ...row,
                                      home:
                                        event
                                          .target
                                          .value,
                                    },
                                  }),
                                )
                              }
                              className="h-11 w-14 rounded-lg border border-white/10 bg-black/20 text-center text-lg font-black outline-none focus:border-rose-400/40"
                            />

                            <span className="text-xs font-black text-slate-600">
                              –
                            </span>

                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={
                                row.away
                              }
                              onChange={(
                                event,
                              ) =>
                                setScores(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [match.id]: {
                                      ...row,
                                      away:
                                        event
                                          .target
                                          .value,
                                    },
                                  }),
                                )
                              }
                              className="h-11 w-14 rounded-lg border border-white/10 bg-black/20 text-center text-lg font-black outline-none focus:border-rose-400/40"
                            />
                          </div>
                        ) : (
                          <span className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-xl font-black">
                            {
                              match.homeScore ??
                              '—'
                            } – {
                              match.awayScore ??
                              '—'
                            }
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {displayName(
                              match.awayPlayer,
                            )}
                          </p>

                          <p className="mt-1 truncate text-[9px] text-slate-600">
                            {
                              war.awayLeague
                                .name
                            }
                          </p>
                        </div>
                      </div>

                      {war.permissions
                        .canUpdateResults ? (
                        <button
                          type="button"
                          disabled={
                            Boolean(
                              busy,
                            )
                          }
                          onClick={() =>
                            void saveResult(
                              match,
                            )
                          }
                          className="mt-4 min-h-10 w-full rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-4 text-xs font-black text-rose-300 disabled:opacity-40"
                        >
                          {busy ===
                          `match-${match.id}`
                            ? 'Saving...'
                            : match.status ===
                                'COMPLETED'
                              ? 'Update Result'
                              : 'Save Result'}
                        </button>
                      ) : null}
                    </FcPanel>
                  );
                },
              )}
            </div>

            {war.status ===
              'LIVE' &&
            war.permissions
              .canComplete ? (
              <FcPanel className="mt-4 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                      Final Whistle
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Complete League War
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Winner: War Points → GD → Goals Scored → Wins. Exact tie stays a draw.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !allMatchesComplete ||
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void action(
                        'complete',
                        `/league-wars/${war.id}/complete`,
                      )
                    }
                    className="min-h-12 rounded-xl bg-amber-300 px-7 text-sm font-black text-[#151006] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busy ===
                    'complete'
                      ? 'Completing...'
                      : 'Complete & Lock Winner 🏆'}
                  </button>
                </div>
              </FcPanel>
            ) : null}
          </section>
        ) : null}

        <details className="rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <summary className="cursor-pointer px-5 py-4 text-sm font-black">
            How League War scoring works
          </summary>

          <div className="border-t border-white/[0.07] p-5 text-sm leading-6 text-slate-500">
            <p>
              Win = <strong className="text-slate-200">{war.winPoints}</strong> · Draw = <strong className="text-slate-200">{war.drawPoints}</strong> · Loss = <strong className="text-slate-200">{war.lossPoints}</strong>.
            </p>

            <p className="mt-2">
              Winner order: <strong className="text-slate-200">War Points → Goal Difference → Goals Scored → Wins</strong>. If everything is still equal, the War is recorded as a draw.
            </p>

            <p className="mt-2">
              In Home & Away mode every roster pairing plays twice. Admin-entered results update both League scores immediately.
            </p>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
