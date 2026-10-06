'use client';

import Link from 'next/link';
import { AwardEmblem, PremiumHero } from '@/components/fc/premium-ui';
import { ShareCard } from '@/components/fc/share-card';
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

interface PublicFairPlay {
  score: number;
  status: string;
  activePenaltyEvents: number;
  commendations: number;
  lastUpdatedAt: string | null;
  detailVisibility: string;
}

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

  const [
    fairPlay,
    setFairPlay,
  ] =
    useState<PublicFairPlay | null>(
      null,
    );

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

  useEffect(() => {
    void authenticatedRequest<{
      success: true;

      data: {
        fairPlay:
          PublicFairPlay;
      };

      error: null;
    }>(
      `/fair-play/players/${params.userId}`,
    )
      .then(
        (
          response,
        ) =>
          setFairPlay(
            response.data
              .fairPlay,
          ),
      )
      .catch(
        () =>
          setFairPlay(
            null,
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
      className="premium-player-page"
      header={data ? <PremiumHero eyebrow="FC Arena · Player identity" title={nameFor(data)} crest={nameFor(data)} imageUrl={data.player.profileImageUrl} description="Verified competition statistics and a career built on the pitch." action={<ShareCard label="Share player card" filename="fc-arena-player" title={nameFor(data)} lines={[data.player.playerCode, `${data.lifetimeStatistics.matches} matches · ${data.lifetimeStatistics.wins} wins`, `${data.lifetimeStatistics.goalsFor} goals · ${data.lifetimeStatistics.winRate}% win rate`]} />}>
        <div className="premium-hero-tags"><span>{data.player.playerCode}</span><span>Member since {new Date(data.player.joinedAt).toLocaleDateString()}</span>{data.player.verified ? <FcStatusBadge label="Verified" tone="emerald" /> : null}</div>
        {fairPlay ? <div className="premium-player-fair-play"><strong>{fairPlay.score}</strong><div><p>Fair Play · {fairPlay.status.replaceAll('_', ' ')}</p><small>Summary only · event details private</small></div></div> : null}
      </PremiumHero> : undefined}
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
          <section className="premium-metrics premium-player-metrics" aria-label="Player career summary">
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

          <section className="premium-spread">
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

            <div className="premium-player-honours">
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
                      <FcPanel className="premium-honour-row h-full border-amber-400/15 p-4">
                        <AwardEmblem kind={award.type === 'GOLDEN_BOOT' ? 'boot' : award.type === 'GOLDEN_GLOVE' ? 'glove' : 'ballon'} />
                        <div>
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
                        </div>
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
                      className="premium-honour-row h-full p-4"
                    >
                      <AwardEmblem kind={achievement.type === 'GOLDEN_BOOT' ? 'boot' : achievement.type === 'GOLDEN_GLOVE' ? 'glove' : 'ballon'} />
                      <div>
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
                      </div>
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
