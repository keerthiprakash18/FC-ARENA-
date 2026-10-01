'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
} from 'react';

import {
  useParams,
} from 'next/navigation';

import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface PublicPlayerData {
  player: {
    userId: string;
    fullName: string;
    inGameName: string | null;
    playerCode: string;
    profileImageUrl: string | null;
    joinedAt: string;
    verified: boolean;
  };

  leagues: Array<{
    type: string;
    joinedAt: string;

    league: {
      id: string;
      name: string;
      logoUrl: string | null;
      region: string | null;
    };
  }>;

  lifetimeStatistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
    achievements: number;
    seasonalAwards: number;
  };

  achievements: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    awardedAt: string;

    tournament: {
      id: string;
      name: string;
      code: string;
      completedAt: string | null;

      league: {
        id: string;
        name: string;
      };
    };
  }>;

  seasonalAwards: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    awardedAt: string;

    season: {
      id: string;
      name: string;
      status: string;
      startAt: string;
      endAt: string;
    };
  }>;

  ballonHistory: Array<{
    rank: number;
    rating: number;
    createdAt: string;

    season: {
      id: string;
      name: string;
      status: string;
      startAt: string;
      endAt: string;
    };
  }>;
}

function nameFor(
  data:
    PublicPlayerData,
) {
  return (
    data.player
      .inGameName ||
    data.player
      .fullName
  );
}

export default function PublicPlayerPage() {
  const params =
    useParams<{
      userId: string;
    }>();

  const [
    data,
    setData,
  ] =
    useState<PublicPlayerData | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void authenticatedRequest<{
      success: true;
      data: PublicPlayerData;
      error: null;
    }>(
      `/discover/players/${params.userId}`,
    )
      .then(
        (
          response,
        ) =>
          setData(
            response.data,
          ),
      )
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load player.',
          ),
      );
  }, [
    params.userId,
  ]);

  return (
    <SecondaryFeaturePage
      eyebrow="Discover Player"
      title={
        data
          ? nameFor(
              data,
            )
          : 'Player Profile'
      }
      subtitle="Public FC Arena competition identity, verified statistics and honours."
      backHref="/discover"
      backLabel="Discover"
    >
      {!data &&
      !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading public player profile...
        </FcPanel>
      ) : null}

      {error ? (
        <FcEmptyState
          title="Player unavailable"
          description={
            error
          }
          actionLabel="Back to Discover"
          actionHref="/discover"
        />
      ) : null}

      {data ? (
        <>
          <FcPanel className="overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="theme-avatar grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border text-2xl font-black">
                {data.player
                  .profileImageUrl ? (
                  <img
                    src={
                      data.player
                        .profileImageUrl
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  nameFor(
                    data,
                  )
                    .slice(
                      0,
                      2,
                    )
                    .toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-black sm:text-3xl">
                    {
                      nameFor(
                        data,
                      )
                    }
                  </h1>

                  {data.player
                    .verified ? (
                    <FcStatusBadge
                      label="Verified"
                      tone="emerald"
                    />
                  ) : null}
                </div>

                <p className="mt-2 font-mono text-xs font-black text-sky-400">
                  {
                    data.player
                      .playerCode
                  }
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  FC Arena member since{' '}
                  {new Date(
                    data.player
                      .joinedAt,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          </FcPanel>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              [
                'Matches',
                data
                  .lifetimeStatistics
                  .matches,
              ],
              [
                'Wins',
                data
                  .lifetimeStatistics
                  .wins,
              ],
              [
                'Win Rate',
                `${data.lifetimeStatistics.winRate}%`,
              ],
              [
                'Goals',
                data
                  .lifetimeStatistics
                  .goalsFor,
              ],
              [
                'GD',
                data
                  .lifetimeStatistics
                  .goalDifference,
              ],
              [
                'Awards',
                data
                  .lifetimeStatistics
                  .achievements,
              ],
              [
                'Season Honours',
                data
                  .lifetimeStatistics
                  .seasonalAwards,
              ],
            ].map(
              (
                item,
              ) => (
                <FcPanel
                  key={
                    item[0]
                  }
                  className="p-4 text-center"
                >
                  <p className="text-xl font-black">
                    {
                      item[1]
                    }
                  </p>

                  <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                    {
                      item[0]
                    }
                  </p>
                </FcPanel>
              ),
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                League Identity
              </p>

              <h2 className="mt-1 text-xl font-black">
                Leagues
              </h2>

              <div className="mt-4 space-y-2">
                {data.leagues.map(
                  (
                    membership,
                  ) => (
                    <div
                      key={
                        membership
                          .league.id
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black">
                          {
                            membership
                              .league
                              .name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            membership
                              .league
                              .region ||
                            'FC Arena League'
                          }
                        </p>
                      </div>

                      <FcStatusBadge
                        label={
                          membership.type
                        }
                        tone={
                          membership.type ===
                          'PRIMARY'
                            ? 'cyan'
                            : 'slate'
                        }
                      />
                    </div>
                  ),
                )}

                {data.leagues
                  .length ===
                  0 ? (
                  <p className="text-sm text-slate-500">
                    No current League membership.
                  </p>
                ) : null}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Ballon History
              </p>

              <h2 className="mt-1 text-xl font-black">
                Seasonal Record
              </h2>

              <div className="mt-4 space-y-2">
                {data
                  .ballonHistory
                  .map(
                    (
                      row,
                    ) => (
                      <Link
                        key={
                          row
                            .season
                            .id
                        }
                        href={
                          `/awards/ballon/${row.season.id}`
                        }
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black">
                            {
                              row
                                .season
                                .name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Rating{' '}
                            {
                              row.rating
                            }
                          </p>
                        </div>

                        <span className="text-xl font-black text-amber-300">
                          #
                          {
                            row.rank
                          }
                        </span>
                      </Link>
                    ),
                  )}

                {data
                  .ballonHistory
                  .length ===
                  0 ? (
                  <p className="text-sm text-slate-500">
                    No locked Ballon ranking history yet.
                  </p>
                ) : null}
              </div>
            </FcPanel>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Trophy Cabinet
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Honours
                </h2>
              </div>

              <Link
                href="/awards/hall-of-fame"
                className="text-xs font-black text-amber-300"
              >
                Hall of Fame →
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {data
                .seasonalAwards
                .map(
                  (
                    award,
                  ) => (
                    <Link
                      key={
                        award.id
                      }
                      href={
                        `/awards/ballon/${award.season.id}`
                      }
                    >
                      <FcPanel className="h-full border-amber-400/15 p-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                          Seasonal Honour
                        </p>

                        <p className="mt-2 font-black">
                          {
                            award.title
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            award
                              .season
                              .name
                          }
                        </p>
                      </FcPanel>
                    </Link>
                  ),
                )}

              {data
                .achievements
                .map(
                  (
                    achievement,
                  ) => (
                    <FcPanel
                      key={
                        achievement.id
                      }
                      className="h-full p-4"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                        Tournament Honour
                      </p>

                      <p className="mt-2 font-black">
                        {
                          achievement.title
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          achievement
                            .tournament
                            .name
                        }{' '}
                        ·{' '}
                        {
                          achievement
                            .tournament
                            .league
                            .name
                        }
                      </p>
                    </FcPanel>
                  ),
                )}

              {data
                .seasonalAwards
                .length ===
                0 &&
              data
                .achievements
                .length ===
                0 ? (
                <FcPanel className="p-8 text-center text-sm text-slate-500 md:col-span-2">
                  No major honours recorded yet.
                </FcPanel>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </SecondaryFeaturePage>
  );
}
