'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
  getCurrentUser,
} from '@/lib/auth-client';


interface Membership {
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';

  league: {
    id: string;
    name: string;
  };
}


interface RankingRow {
  position: number;
  userId: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;
  profileImageUrl: string | null;
  tournamentsPlayed: number;
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


interface LeaderboardData {
  league: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    region: string | null;
  };

  filter: {
    mode:
      | 'SOLO'
      | 'DUO'
      | 'TEAM'
      | null;
  };

  summary: {
    members: number;
    rankedPlayers: number;
    tournaments: number;
    verifiedMatches: number;
    lastUpdatedAt: string | null;
  };

  myPosition: number | null;
  rankings: RankingRow[];
}


function playerName(
  row: RankingRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}


function formTone(
  outcome: string,
) {
  if (
    outcome ===
    'W'
  ) {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  }

  if (
    outcome ===
    'D'
  ) {
    return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  }

  return 'border-red-400/20 bg-red-400/10 text-red-300';
}


export default function LeaderboardsPage() {
  const [
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    selectedLeague,
    setSelectedLeague,
  ] =
    useState('');

  const [
    mode,
    setMode,
  ] =
    useState('');

  const [
    data,
    setData,
  ] =
    useState<LeaderboardData | null>(
      null,
    );

  const [
    userId,
    setUserId,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagues,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              success: true;

              data: {
                leagues:
                  Membership[];
              };

              error: null;
            }>(
              '/leagues/my',
            ),
          ]);

        const list =
          leagues
            .data
            .leagues;

        const requestedLeague =
          new URLSearchParams(
            window.location
              .search,
          ).get(
            'league',
          );

        const initialLeague =
          (
            requestedLeague &&
            list.some(
              (
                membership,
              ) =>
                membership
                  .league
                  .id ===
                requestedLeague,
            )
          )
            ? requestedLeague
            : (
                list.find(
                  (
                    membership,
                  ) =>
                    membership
                      .membershipType ===
                    'PRIMARY',
                )
                  ?.league.id ??
                list[0]
                  ?.league.id ??
                ''
              );

        setUserId(
          current.id,
        );

        setMemberships(
          list,
        );

        setSelectedLeague(
          initialLeague,
        );

        if (
          !initialLeague
        ) {
          setLoading(
            false,
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Leaderboards.',
        );

        setLoading(
          false,
        );
      }
    })();
  }, []);


  useEffect(() => {
    if (
      !selectedLeague
    ) {
      return;
    }

    setLoading(
      true,
    );

    setData(
      null,
    );

    const suffix =
      mode
        ? '?mode=' +
          encodeURIComponent(
            mode,
          )
        : '';

    void authenticatedRequest<{
      success: true;
      data:
        LeaderboardData;
      error: null;
    }>(
      '/leagues/' +
        selectedLeague +
        '/rankings' +
        suffix,
    )
      .then(
        (
          response,
        ) => {
          setData(
            response.data,
          );

          setError(
            '',
          );
        },
      )
      .catch(
        (
          err,
        ) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Leaderboard.',
          );

          setData(
            null,
          );
        },
      )
      .finally(
        () =>
          setLoading(
            false,
          ),
      );
  }, [
    selectedLeague,
    mode,
  ]);


  const rankings =
    data
      ?.rankings ??
    [];

  const myPosition =
    data
      ?.myPosition ??
    rankings.find(
      (
        row,
      ) =>
        row.userId ===
        userId,
    )
      ?.position ??
    null;


  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="League Leaderboards"
      subtitle="League-wide player performance combined automatically from verified FC ARENA Tournament results."
      backHref={
        selectedLeague
          ? '/leagues/' +
            selectedLeague
          : '/more'
      }
      backLabel={
        selectedLeague
          ? 'League'
          : 'More'
      }
      action={
        myPosition ? (
          <FcStatusBadge
            label={
              'Your Rank #' +
              myPosition
            }
            tone="cyan"
          />
        ) : null
      }
    >
      {error ? (
        <FcErrorState
          message={
            error
          }
        />
      ) : null}


      {memberships.length ===
      0 &&
      !loading ? (
        <FcEmptyState
          title="Join a League first"
          description="A League Leaderboard becomes available after you join an FC ARENA League."
          actionLabel="Open Leagues"
          actionHref="/leagues"
        />
      ) : (
        <>
          <FcPanel className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-muted">
                  League
                </span>

                <select
                  value={
                    selectedLeague
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedLeague(
                      event.target
                        .value,
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 outline-none"
                >
                  {memberships.map(
                    (
                      membership,
                    ) => (
                      <option
                        key={
                          membership
                            .league.id
                        }
                        value={
                          membership
                            .league.id
                        }
                      >
                        {
                          membership
                            .league.name
                        }
                        {
                          membership
                            .membershipType ===
                          'PRIMARY'
                            ? ' · Primary'
                            : ''
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-muted">
                  Competition mode
                </span>

                <select
                  value={
                    mode
                  }
                  onChange={(
                    event,
                  ) =>
                    setMode(
                      event.target
                        .value,
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 outline-none"
                >
                  <option value="">
                    All Tournaments
                  </option>

                  <option value="SOLO">
                    Solo
                  </option>

                  <option value="DUO">
                    Duo
                  </option>

                  <option value="TEAM">
                    Team
                  </option>
                </select>
              </label>
            </div>

            <p className="theme-muted mt-4 text-xs leading-5">
              Performance Points use 3 points per win and 1 point per draw. Only verified results from non-cancelled Tournaments are counted.
            </p>
          </FcPanel>


          {loading ? (
            <FcPanel className="p-8 text-center">
              <p className="theme-secondary-text text-sm">
                Calculating League performance...
              </p>
            </FcPanel>
          ) : data ? (
            <>
              <FcPanel className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={
                        data.league
                          .name
                      }
                      imageUrl={
                        data.league
                          .logoUrl
                      }
                      size="lg"
                    />

                    <div>
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                        {
                          data.league
                            .code
                        }
                      </p>

                      <h2 className="theme-text mt-1 text-xl font-semibold">
                        {
                          data.league
                            .name
                        }
                      </h2>

                      <p className="theme-muted mt-1 text-xs">
                        {
                          data.league
                            .region ||
                          'FC ARENA League'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="theme-muted text-[10px] uppercase tracking-[0.14em]">
                      Last stats update
                    </p>

                    <p className="theme-secondary-text mt-1 text-xs">
                      {
                        data.summary
                          .lastUpdatedAt
                          ? new Date(
                              data.summary
                                .lastUpdatedAt,
                            ).toLocaleString()
                          : 'Waiting for verified results'
                      }
                    </p>
                  </div>
                </div>
              </FcPanel>


              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <FcStatCard
                  label="Ranked Players"
                  value={
                    data.summary
                      .rankedPlayers
                  }
                  detail={
                    `${data.summary.members} League members`
                  }
                />

                <FcStatCard
                  label="Tournaments"
                  value={
                    data.summary
                      .tournaments
                  }
                  detail={
                    mode
                      ? mode +
                        ' mode'
                      : 'All modes'
                  }
                  tone="amber"
                />

                <FcStatCard
                  label="Verified Matches"
                  value={
                    data.summary
                      .verifiedMatches
                  }
                  detail="Confirmed results only"
                  tone="emerald"
                />

                <FcStatCard
                  label="Your Rank"
                  value={
                    myPosition
                      ? '#' +
                        myPosition
                      : '—'
                  }
                  detail={
                    myPosition
                      ? 'League position'
                      : 'Play a verified match'
                  }
                  tone="slate"
                />
              </section>


              {rankings.length ===
              0 ? (
                <FcEmptyState
                  title="No ranking data yet"
                  description="Once a Tournament match result is verified, player performance will be added to this League Leaderboard automatically."
                />
              ) : (
                <>
                  <section className="grid gap-3 md:grid-cols-3">
                    {rankings
                      .slice(
                        0,
                        3,
                      )
                      .map(
                        (
                          row,
                        ) => (
                          <FcPanel
                            key={
                              row.userId
                            }
                            className={
                              'p-5 ' +
                              (
                                row.position ===
                                1
                                  ? 'theme-soft-accent'
                                  : ''
                              )
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <FcCrest
                                name={
                                  playerName(
                                    row,
                                  )
                                }
                                imageUrl={
                                  row.profileImageUrl
                                }
                              />

                              <span
                                className={
                                  'grid h-10 min-w-10 place-items-center rounded-xl border px-2 font-bold ' +
                                  (
                                    row.position ===
                                    1
                                      ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                                      : 'theme-tone-premium'
                                  )
                                }
                              >
                                #
                                {
                                  row.position
                                }
                              </span>
                            </div>

                            <h2 className="theme-text mt-4 truncate text-lg font-semibold">
                              {
                                playerName(
                                  row,
                                )
                              }
                            </h2>

                            <p className="theme-muted mt-1 text-xs">
                              {
                                row.playerCode ||
                                row.fullName
                              }
                            </p>

                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                              <div className="theme-soft-accent rounded-xl border p-2">
                                <p className="theme-muted text-[9px] uppercase">
                                  Pts
                                </p>

                                <p className="theme-text mt-1 font-bold">
                                  {
                                    row.performancePoints
                                  }
                                </p>
                              </div>

                              <div className="theme-soft-accent rounded-xl border p-2">
                                <p className="theme-muted text-[9px] uppercase">
                                  Wins
                                </p>

                                <p className="theme-text mt-1 font-bold">
                                  {
                                    row.wins
                                  }
                                </p>
                              </div>

                              <div className="theme-soft-accent rounded-xl border p-2">
                                <p className="theme-muted text-[9px] uppercase">
                                  Win %
                                </p>

                                <p className="theme-text mt-1 font-bold">
                                  {
                                    row.winRate
                                  }
                                  %
                                </p>
                              </div>
                            </div>
                          </FcPanel>
                        ),
                      )}
                  </section>


                  <div className="grid gap-3 md:hidden">
                    {rankings.map(
                      (
                        row,
                      ) => (
                        <FcPanel
                          key={
                            row.userId
                          }
                          className={
                            'p-4 ' +
                            (
                              row.userId ===
                              userId
                                ? 'theme-soft-accent'
                                : ''
                            )
                          }
                        >
                          <div className="flex items-center gap-3">
                            <span className="theme-tone-premium grid h-10 min-w-10 place-items-center rounded-xl border px-2 font-bold">
                              #
                              {
                                row.position
                              }
                            </span>

                            <FcCrest
                              name={
                                playerName(
                                  row,
                                )
                              }
                              imageUrl={
                                row.profileImageUrl
                              }
                              size="sm"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="theme-text truncate font-semibold">
                                {
                                  playerName(
                                    row,
                                  )
                                }
                              </p>

                              <p className="theme-muted mt-0.5 text-[10px]">
                                {
                                  row.tournamentsPlayed
                                }{' '}
                                tournaments ·{' '}
                                {
                                  row.matches
                                }{' '}
                                matches
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="theme-text-link font-bold">
                                {
                                  row.performancePoints
                                }{' '}
                                pts
                              </p>

                              <p className="theme-muted mt-0.5 text-[10px]">
                                {
                                  row.winRate
                                }
                                % win
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-6 gap-1 text-center">
                            {[
                              [
                                'W',
                                row.wins,
                              ],
                              [
                                'D',
                                row.draws,
                              ],
                              [
                                'L',
                                row.losses,
                              ],
                              [
                                'GF',
                                row.goalsFor,
                              ],
                              [
                                'GA',
                                row.goalsAgainst,
                              ],
                              [
                                'GD',
                                row.goalDifference >
                                0
                                  ? '+' +
                                    row.goalDifference
                                  : row.goalDifference,
                              ],
                            ].map(
                              (
                                [
                                  label,
                                  value,
                                ],
                              ) => (
                                <div
                                  key={
                                    label
                                  }
                                  className="theme-soft-accent rounded-lg border px-1 py-2"
                                >
                                  <p className="theme-muted text-[8px]">
                                    {
                                      label
                                    }
                                  </p>

                                  <p className="theme-text mt-1 text-xs font-bold">
                                    {
                                      value
                                    }
                                  </p>
                                </div>
                              ),
                            )}
                          </div>

                          {row.form ? (
                            <div className="mt-3 flex items-center gap-1.5">
                              <span className="theme-muted mr-1 text-[9px] uppercase tracking-[0.12em]">
                                Form
                              </span>

                              {row.form
                                .split(
                                  '',
                                )
                                .map(
                                  (
                                    outcome,
                                    index,
                                  ) => (
                                    <span
                                      key={
                                        outcome +
                                        index
                                      }
                                      className={
                                        'grid h-6 w-6 place-items-center rounded-md border text-[9px] font-bold ' +
                                        formTone(
                                          outcome,
                                        )
                                      }
                                    >
                                      {
                                        outcome
                                      }
                                    </span>
                                  ),
                                )}
                            </div>
                          ) : null}
                        </FcPanel>
                      ),
                    )}
                  </div>


                  <FcPanel className="hidden overflow-hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="theme-soft-accent text-left">
                          <tr className="theme-muted">
                            <th className="px-4 py-3">
                              Rank
                            </th>

                            <th className="px-4 py-3">
                              Player
                            </th>

                            <th className="px-3 py-3 text-center">
                              T
                            </th>

                            <th className="px-3 py-3 text-center">
                              MP
                            </th>

                            <th className="px-3 py-3 text-center">
                              W
                            </th>

                            <th className="px-3 py-3 text-center">
                              D
                            </th>

                            <th className="px-3 py-3 text-center">
                              L
                            </th>

                            <th className="px-3 py-3 text-center">
                              GF
                            </th>

                            <th className="px-3 py-3 text-center">
                              GA
                            </th>

                            <th className="px-3 py-3 text-center">
                              GD
                            </th>

                            <th className="px-3 py-3 text-center">
                              Win %
                            </th>

                            <th className="px-4 py-3 text-center">
                              Performance
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {rankings.map(
                            (
                              row,
                            ) => (
                              <tr
                                key={
                                  row.userId
                                }
                                className={
                                  'border-t theme-divider ' +
                                  (
                                    row.userId ===
                                    userId
                                      ? 'theme-soft-accent'
                                      : ''
                                  )
                                }
                              >
                                <td className="theme-text px-4 py-3 font-bold">
                                  #
                                  {
                                    row.position
                                  }
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <FcCrest
                                      name={
                                        playerName(
                                          row,
                                        )
                                      }
                                      imageUrl={
                                        row.profileImageUrl
                                      }
                                      size="sm"
                                    />

                                    <div className="min-w-0">
                                      <p className="theme-text truncate font-semibold">
                                        {
                                          playerName(
                                            row,
                                          )
                                        }
                                      </p>

                                      <p className="theme-muted mt-0.5 text-xs">
                                        {
                                          row.playerCode ||
                                          row.fullName
                                        }
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.tournamentsPlayed
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.matches
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.wins
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.draws
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.losses
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.goalsFor
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.goalsAgainst
                                  }
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {row.goalDifference >
                                  0
                                    ? '+' +
                                      row.goalDifference
                                    : row.goalDifference}
                                </td>

                                <td className="px-3 py-3 text-center">
                                  {
                                    row.winRate
                                  }
                                  %
                                </td>

                                <td className="theme-text-link px-4 py-3 text-center font-bold">
                                  {
                                    row.performancePoints
                                  }{' '}
                                  pts
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </FcPanel>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </SecondaryFeaturePage>
  );
}
