'use client';

import Link from 'next/link';
import { PremiumHero } from '@/components/fc/premium-ui';
import {
  useEffect,
  useMemo,
  useRef,
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
  FcErrorState,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { ApiError } from '@/lib/api';
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
  pairingMode: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  challengeExpiresAt: string | null;
  scheduledStartAt: string | null;
  deadlineAt: string | null;
  homeReadyAt: string | null;
  awayReadyAt: string | null;
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

interface LeagueRanking {
  position: number;
  league: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  played: number;
  wins: number;
  draws: number;
  losses: number;
  ratingPoints: number;
  winRate: number;
  battlePointDifference: number;
}

interface PlayerRanking {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
}

function dateLabel(
  value:
    string | null,
) {
  if (!value) {
    return 'Not set';
  }

  return new Date(
    value,
  ).toLocaleString();
}

function optionalIso(
  value:
    FormDataEntryValue | null,
) {
  const text =
    String(
      value ??
        '',
    ).trim();

  if (!text) {
    return undefined;
  }

  return new Date(
    text,
  ).toISOString();
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
    leagueRankings,
    setLeagueRankings,
  ] =
    useState<LeagueRanking[]>(
      [],
    );

  const [
    playerRankings,
    setPlayerRankings,
  ] =
    useState<PlayerRanking[]>(
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    attempt,
    setAttempt,
  ] =
    useState(0);

  const loadInFlight = useRef(false);

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
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setError('');
    const [
      current,
      leagueResponse,
      warResponse,
      rankingResponse,
    ] =
      await Promise.all([
        getCurrentUser(),
        authenticatedRequest<any>(
          '/leagues/my',
        ),
        authenticatedRequest<any>(
          '/league-wars',
        ),
        authenticatedRequest<any>(
          '/league-wars/rankings',
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
    setLeagueRankings(
      rankingResponse
        .data
        .leagueRankings ??
        [],
    );
    setPlayerRankings(
      rankingResponse
        .data
        .playerRankings ??
        [],
    );
    setLoading(false);
    loadInFlight.current = false;
  }

  useEffect(() => {
    void load().catch((err) => {
      loadInFlight.current = false;
      setLoading(false);
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load League Wars.');
      }
    });
  }, [
    router,
    attempt,
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
                pairingMode:
                  String(
                    form.get(
                      'pairingMode',
                    ) ??
                      'SLOT',
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
                challengeExpiryHours:
                  Number(
                    form.get(
                      'challengeExpiryHours',
                    ) ??
                      48,
                  ),
                scheduledStartAt:
                  optionalIso(
                    form.get(
                      'scheduledStartAt',
                    ),
                  ),
                deadlineAt:
                  optionalIso(
                    form.get(
                      'deadlineAt',
                    ),
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

  if (!user && loading) {
    return (
      <FcLoadingScreen label="Loading League Wars..." />
    );
  }

  if (!user) {
    return (
      <main className="fc-state-screen">
        <FcErrorState message={error || 'Unable to load League Wars.'} onRetry={() => setAttempt(value => value + 1)} />
      </main>
    );
  }

  return (
    <AppShell
      currentUser={user}
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="premium-page fc-league-war-page">
        <PremiumHero
          eyebrow="FC Arena · League against league"
          title="League War"
          description="Your badge. Your roster. Your rivalry. League battles decided by verified results and live War Points."
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
                className="theme-primary-button premium-button"
              >
                Create War
              </button>
            ) : null
          }
        >
          <div className="premium-hero-tags"><span>{wars.filter(war => war.status === 'LIVE').length} live rivalries</span><span>{wars.filter(war => war.status === 'COMPLETED').length} completed battles</span><span>Locked rosters · opponent-confirmed results</span></div>
        </PremiumHero>

        {error ? <FcErrorState message={error} onRetry={() => setAttempt(value => value + 1)} busy={loading} /> : null}

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

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Opponent admin must accept. Both sides must lock a full roster and mark Ready before Start War unlocks.
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
                War Name
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

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Pairing
                <select
                  name="pairingMode"
                  defaultValue="SLOT"
                  className="min-h-12 rounded-xl border border-white/10 bg-[#101923] px-4 outline-none"
                >
                  <option value="SLOT">
                    Auto Slot Pairing
                  </option>
                  <option value="MANUAL">
                    Manual Slot Order
                  </option>
                  <option value="RANDOM">
                    Random Draw
                  </option>
                </select>

                <span className="text-[11px] font-medium leading-5 text-slate-600">
                  Manual uses the roster order chosen by each admin. Random shuffles the opponent roster when the War starts.
                </span>
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

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Challenge Expiry
                <select
                  name="challengeExpiryHours"
                  defaultValue="48"
                  className="min-h-12 rounded-xl border border-white/10 bg-[#101923] px-4 outline-none"
                >
                  <option value="24">
                    24 Hours
                  </option>
                  <option value="48">
                    48 Hours
                  </option>
                  <option value="72">
                    72 Hours
                  </option>
                  <option value="168">
                    7 Days
                  </option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                Scheduled Start (optional)
                <input
                  name="scheduledStartAt"
                  type="datetime-local"
                  className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-300">
                War Deadline (optional)
                <input
                  name="deadlineAt"
                  type="datetime-local"
                  className="min-h-12 rounded-xl border border-white/10 bg-black/20 px-4 outline-none"
                />
              </label>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 lg:col-span-2">
                <p className="text-xs font-black text-slate-300">
                  Fair-play rules
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Result submitted → opponent confirmation → official War Points. Proof URL, dispute and walkover use the same confirmation flow. Winner: War Points → GD → Goals Scored → Wins → Draw.
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
                    : 'Send Challenge'}
                </button>
              </div>
            </form>
          </FcPanel>
        ) : null}

        <details className="premium-admin-controls premium-war-rankings"><summary>League rankings &amp; player form</summary>
        <section className="premium-spread mt-5">
          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                League Power
              </p>

              <h2 className="mt-1 text-xl font-black">
                League War Rankings
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                War Win = 3 ranking pts · Draw = 1 · Loss = 0
              </p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {leagueRankings
                .slice(
                  0,
                  10,
                )
                .map(
                  (
                    row,
                  ) => (
                    <div
                      key={
                        row.league
                          .id
                      }
                      className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-5 py-3"
                    >
                      <span className={
                        row.position <=
                        3
                          ? 'text-center text-sm font-black text-amber-300'
                          : 'text-center text-xs font-black text-slate-600'
                      }>
                        #{
                          row.position
                        }
                      </span>

                      <div className="flex min-w-0 items-center gap-3">
                        <FcCrest
                          name={
                            row.league
                              .name
                          }
                          imageUrl={
                            row.league
                              .logoUrl
                          }
                          size="sm"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {
                              row.league
                                .name
                            }
                          </p>

                          <p className="mt-0.5 text-[9px] text-slate-600">
                            {
                              row.wins
                            }W · {
                              row.draws
                            }D · {
                              row.losses
                            }L · {
                              row.winRate
                            }%
                          </p>
                        </div>
                      </div>

                      <span className="text-lg font-black text-rose-300">
                        {
                          row.ratingPoints
                        }
                      </span>
                    </div>
                  ),
                )}

              {leagueRankings.length ===
              0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Complete the first League War to start rankings.
                </p>
              ) : null}
            </div>
          </FcPanel>

          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Player Form
              </p>

              <h2 className="mt-1 text-xl font-black">
                War Player Leaders
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Wins → GD → Goals For → fewer losses
              </p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {playerRankings
                .slice(
                  0,
                  10,
                )
                .map(
                  (
                    row,
                  ) => (
                    <div
                      key={
                        row.userId
                      }
                      className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-5 py-3"
                    >
                      <span className={
                        row.position <=
                        3
                          ? 'text-center text-sm font-black text-emerald-300'
                          : 'text-center text-xs font-black text-slate-600'
                      }>
                        #{
                          row.position
                        }
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            row.inGameName ||
                            row.fullName
                          }
                        </p>

                        <p className="mt-0.5 text-[9px] text-slate-600">
                          {
                            row.wins
                          }W · GD {
                            row.goalDifference
                          } · {
                            row.winRate
                          }%
                        </p>
                      </div>

                      <span className="text-xs font-black text-slate-300">
                        {
                          row.goalsFor
                        } GF
                      </span>
                    </div>
                  ),
                )}

              {playerRankings.length ===
              0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Player leaders appear after confirmed War results.
                </p>
              ) : null}
            </div>
          </FcPanel>
        </section>
        </details>

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
                  aria-pressed={filter === value}
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
            <div className="premium-war-list mt-4 grid gap-4 xl:grid-cols-2">
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
                      <FcPanel className="premium-war-preview h-full overflow-hidden transition">
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
                                } · {
                                  war.pairingMode
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
                                    : [
                                          'REJECTED',
                                          'CANCELLED',
                                          'EXPIRED',
                                        ].includes(
                                          war.status,
                                        )
                                      ? 'slate'
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

                            <p className={
                              war.homeReadyAt
                                ? 'mt-1 text-[9px] font-black uppercase text-emerald-400'
                                : 'mt-1 text-[9px] font-black uppercase text-slate-600'
                            }>
                              {war.homeReadyAt
                                ? '✓ Ready'
                                : 'Not Ready'}
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
                              } confirmed
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

                            <p className={
                              war.awayReadyAt
                                ? 'mt-1 text-[9px] font-black uppercase text-emerald-400'
                                : 'mt-1 text-[9px] font-black uppercase text-slate-600'
                            }>
                              {war.awayReadyAt
                                ? '✓ Ready'
                                : 'Not Ready'}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-white/[0.07] px-5 py-3">
                          <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-600">
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

                          {war.status ===
                          'INVITED' ? (
                            <p className="mt-2 text-[9px] text-slate-700">
                              Challenge expires: {
                                dateLabel(
                                  war.challengeExpiresAt,
                                )
                              }
                            </p>
                          ) : null}
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
