'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';
import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface MyLeague {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
  league: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
  };
}

interface WarListItem {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  legType: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
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
  winnerLeague: {
    id: string;
    name: string;
  } | null;
  roster: {
    home: number;
    away: number;
  };
  summary: {
    completedMatches: number;
    totalMatches: number;
    remainingMatches: number;
    home: {
      points: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    };
    away: {
      points: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    };
    leaderLeagueId: string | null;
  };
}

export default function LeagueWarPage() {
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
    leagues,
    setLeagues,
  ] =
    useState<MyLeague[]>(
      [],
    );

  const [
    wars,
    setWars,
  ] =
    useState<WarListItem[]>(
      [],
    );

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState<
      'ALL' |
      'LIVE' |
      'PENDING' |
      'COMPLETED'
    >('ALL');

  async function load() {
    const [
      current,
      leagueResponse,
      warResponse,
    ] =
      await Promise.all([
        getCurrentUser(),
        authenticatedRequest<any>(
          '/leagues/my',
        ),
        authenticatedRequest<any>(
          '/league-wars',
        ),
      ]);

    setUser(
      current,
    );
    setLeagues(
      leagueResponse
        .data
        .leagues ??
        [],
    );
    setWars(
      warResponse
        .data
        .wars ??
        [],
    );
  }

  useEffect(() => {
    void load().catch(
      () =>
        router.replace(
          '/login',
        ),
    );
  }, [
    router,
  ]);

  const adminLeagues =
    leagues.filter(
      (
        item,
      ) =>
        Boolean(
          item.adminRole,
        ),
    );

  const visibleWars =
    useMemo(
      () =>
        wars.filter(
          (
            war,
          ) => {
            if (
              filter ===
              'ALL'
            ) {
              return true;
            }

            if (
              filter ===
              'LIVE'
            ) {
              return war.status ===
                'LIVE';
            }

            if (
              filter ===
              'COMPLETED'
            ) {
              return war.status ===
                'COMPLETED';
            }

            return [
              'INVITED',
              'ACCEPTED',
            ].includes(
              war.status,
            );
          },
        ),
      [
        filter,
        wars,
      ],
    );

  async function createWar(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    setBusy(
      true,
    );
    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          '/league-wars',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                homeLeagueId:
                  String(
                    form.get(
                      'homeLeagueId',
                    ) ??
                      '',
                  ),
                opponentLeagueCode:
                  String(
                    form.get(
                      'opponentLeagueCode',
                    ) ??
                      '',
                  )
                    .trim()
                    .toUpperCase(),
                name:
                  String(
                    form.get(
                      'name',
                    ) ??
                      '',
                  )
                    .trim() ||
                  undefined,
                playerCount:
                  Number(
                    form.get(
                      'playerCount',
                    ) ??
                      5,
                  ),
                legType:
                  String(
                    form.get(
                      'legType',
                    ) ??
                      'SINGLE_LEG',
                  ),
                winPoints:
                  Number(
                    form.get(
                      'winPoints',
                    ) ??
                      3,
                  ),
                drawPoints:
                  Number(
                    form.get(
                      'drawPoints',
                    ) ??
                      1,
                  ),
                lossPoints:
                  Number(
                    form.get(
                      'lossPoints',
                    ) ??
                      0,
                  ),
              }),
          },
        );

      router.push(
        `/league-war/${response.data.war.id}`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create League War.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (!user) {
    return (
      <FcLoadingScreen label="Loading League Wars..." />
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
        <FcPageHeader
          title="League War"
          subtitle="League vs League battles with locked rosters, live War Points and clear winner rules."
          action={
            adminLeagues.length >
            0 ? (
              <button
                type="button"
                onClick={() =>
                  setShowCreate(
                    (
                      value,
                    ) =>
                      !value,
                  )
                }
                className="min-h-11 rounded-xl bg-rose-400 px-5 text-sm font-black text-[#18070b]"
              >
                ⚔ Create War
              </button>
            ) : null
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
            {
              error
            }
          </div>
        ) : null}

        {showCreate &&
        adminLeagues.length >
          0 ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                  New Challenge
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Create League War
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Enter the opponent League Code. Their owner/admin must accept before rosters can be locked.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(
                    false,
                  )
                }
                className="text-xl text-slate-500"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                createWar
              }
              className="mt-6 grid gap-4 lg:grid-cols-2"
            >
              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Your League
                <select
                  name="homeLeagueId"
                  required
                  className="min-h-12 rounded-xl border border-white/10 bg-[#101923] px-4 outline-none"
                >
                  {adminLeagues.map(
                    (
                      item,
                    ) => (
                      <option
                        key={
                          item
                            .league.id
                        }
                        value={
                          item
                            .league.id
                        }
                      >
                        {
                          item
                            .league
                            .name
                        } · {
                          item.adminRole
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Opponent League Code
                <input
                  name="opponentLeagueCode"
                  required
                  maxLength={20}
                  placeholder="e.g. KVN-1234"
                  className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 font-mono uppercase outline-none focus:border-rose-400/40"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                War Name (optional)
                <input
                  name="name"
                  placeholder="Friday Night League War"
                  className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:border-rose-400/40"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Players per League
                <input
                  name="playerCount"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={5}
                  required
                  className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Match Format
                <select
                  name="legType"
                  defaultValue="SINGLE_LEG"
                  className="min-h-12 rounded-xl border border-white/10 bg-[#101923] px-4 outline-none"
                >
                  <option value="SINGLE_LEG">
                    One Leg
                  </option>
                  <option value="HOME_AWAY">
                    Home & Away
                  </option>
                </select>
              </label>

              <div>
                <p className="text-sm font-bold text-slate-300">
                  War Points
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ['winPoints', 'Win', 3],
                    ['drawPoints', 'Draw', 1],
                    ['lossPoints', 'Loss', 0],
                  ].map(
                    (
                      [
                        field,
                        label,
                        value,
                      ],
                    ) => (
                      <label
                        key={
                          String(
                            field,
                          )
                        }
                        className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-slate-600"
                      >
                        {
                          label
                        }
                        <input
                          name={
                            String(
                              field,
                            )
                          }
                          type="number"
                          min={-10}
                          max={20}
                          defaultValue={
                            Number(
                              value,
                            )
                          }
                          className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-200 outline-none"
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 lg:col-span-2">
                <p className="text-xs font-black text-slate-300">
                  Winner Rule
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  War Points → Goal Difference → Goals Scored → Wins → Draw. Rules are fixed once the War is created.
                </p>
              </div>

              <div className="flex justify-end gap-2 lg:col-span-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(
                      false,
                    )
                  }
                  className="min-h-11 rounded-xl border border-white/10 px-5 text-sm font-black text-slate-400"
                >
                  Cancel
                </button>

                <button
                  disabled={
                    busy
                  }
                  className="min-h-11 rounded-xl bg-rose-400 px-6 text-sm font-black text-[#18070b] disabled:opacity-40"
                >
                  {busy
                    ? 'Creating...'
                    : 'Send Challenge ⚔'}
                </button>
              </div>
            </form>
          </FcPanel>
        ) : null}

        <FcPanel className="p-2">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                'ALL',
                'LIVE',
                'PENDING',
                'COMPLETED',
              ] as const
            ).map(
              (
                value,
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      value,
                    )
                  }
                  className={
                    filter ===
                    value
                      ? 'rounded-xl bg-rose-400 px-2 py-3 text-[10px] font-black text-[#18070b] sm:text-xs'
                      : 'rounded-xl border border-white/[0.06] px-2 py-3 text-[10px] font-black text-slate-500 sm:text-xs'
                  }
                >
                  {
                    value
                  }
                </button>
              ),
            )}
          </div>
        </FcPanel>

        <section>
          <FcSectionHeading
            eyebrow="Battles"
            title="League Wars"
            action={
              <span className="text-xs font-black text-slate-600">
                {
                  visibleWars.length
                } wars
              </span>
            }
          />

          {visibleWars.length ===
          0 ? (
            <div className="mt-4">
              <FcEmptyState
                title="No League Wars here yet"
                description={
                  adminLeagues.length >
                  0
                    ? 'Create a challenge using the opponent League Code.'
                    : 'Your League owner/admin can create a League War challenge.'
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {visibleWars.map(
                (
                  war,
                ) => {
                  const leader =
                    war.summary
                      .leaderLeagueId;

                  return (
                    <Link
                      key={
                        war.id
                      }
                      href={
                        `/league-war/${war.id}`
                      }
                      className="group"
                    >
                      <FcPanel className="h-full overflow-hidden transition group-hover:border-rose-400/25">
                        <div className="border-b border-white/[0.07] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-black">
                                {
                                  war.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {
                                  war.playerCount
                                }v{
                                  war.playerCount
                                } · {
                                  war.legType ===
                                  'HOME_AWAY'
                                    ? 'Home & Away'
                                    : 'One Leg'
                                }
                              </p>
                            </div>

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
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5">
                          <div className="min-w-0 text-center">
                            <div className="mx-auto flex justify-center">
                              <FcCrest
                                name={
                                  war
                                    .homeLeague
                                    .name
                                }
                                imageUrl={
                                  war
                                    .homeLeague
                                    .logoUrl
                                }
                                size="lg"
                              />
                            </div>

                            <p className="mt-3 truncate text-sm font-black">
                              {
                                war
                                  .homeLeague
                                  .name
                              }
                            </p>

                            <p className={
                              leader ===
                              war.homeLeague
                                .id
                                ? 'mt-2 text-3xl font-black text-rose-300'
                                : 'mt-2 text-3xl font-black text-slate-200'
                            }>
                              {
                                war
                                  .summary
                                  .home
                                  .points
                              }
                            </p>
                          </div>

                          <div className="text-center">
                            <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black text-slate-500">
                              WAR PTS
                            </span>

                            <p className="mt-3 text-[10px] font-bold text-slate-600">
                              {
                                war
                                  .summary
                                  .completedMatches
                              }/{
                                war
                                  .summary
                                  .totalMatches
                              } matches
                            </p>
                          </div>

                          <div className="min-w-0 text-center">
                            <div className="mx-auto flex justify-center">
                              <FcCrest
                                name={
                                  war
                                    .awayLeague
                                    .name
                                }
                                imageUrl={
                                  war
                                    .awayLeague
                                    .logoUrl
                                }
                                size="lg"
                              />
                            </div>

                            <p className="mt-3 truncate text-sm font-black">
                              {
                                war
                                  .awayLeague
                                  .name
                              }
                            </p>

                            <p className={
                              leader ===
                              war.awayLeague
                                .id
                                ? 'mt-2 text-3xl font-black text-rose-300'
                                : 'mt-2 text-3xl font-black text-slate-200'
                            }>
                              {
                                war
                                  .summary
                                  .away
                                  .points
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3 text-[10px] font-bold text-slate-600">
                          <span>
                            Roster {
                              war.roster
                                .home
                            }/{
                              war.playerCount
                            } · {
                              war.roster
                                .away
                            }/{
                              war.playerCount
                            }
                          </span>

                          <span className="text-rose-300">
                            Open War →
                          </span>
                        </div>
                      </FcPanel>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
