'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
} from 'react';

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

interface Identity {
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string;
  profileImageUrl: string | null;
}

interface HallData {
  seasons: Array<{
    id: string;
    name: string;
    status: string;
    startAt: string;
    endAt: string;
    lockedAt: string | null;
    archivedAt: string | null;
    winner: Identity | null;
    risingStar: Identity | null;

    podium: Array<{
      rank: number;
      rating: number;
      player: Identity;
    }>;
  }>;

  legends: Array<{
    userId: string;
    player: Identity;
    ballonWins: number;
    ballonPodiums: number;
    risingStars: number;
    tournamentTitles: number;
    tournamentRunnerUps: number;
    goldenBoots: number;
    goldenGloves: number;
    playerOfTournament: number;
    winningStreakAwards: number;
    majorHonours: number;
  }>;

  champions: Array<{
    id: string;
    awardedAt: string;
    player: Identity;

    tournament: {
      id: string;
      name: string;
      code: string;

      league: {
        id: string;
        name: string;
      };
    };
  }>;

  totals: {
    seasons: number;
    recordedHonours: number;
    champions: number;
    legends: number;
  };

  scoringNote: string;
}

function nameFor(
  player:
    Identity,
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

export default function HallOfFamePage() {
  const [
    data,
    setData,
  ] =
    useState<HallData | null>(
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
      data: HallData;
      error: null;
    }>('/discover/hall-of-fame')
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
              : 'Unable to load Hall of Fame.',
          ),
      );
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena Legacy"
      title="Hall of Fame"
      subtitle="Official history of Ballon seasons, podiums, tournament champions and major FC Arena honours."
      backHref="/awards"
      backLabel="Awards"
      action={
        <Link
          href="/discover"
          className="theme-secondary-button inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-black"
        >
          Discover →
        </Link>
      }
    >
      {error ? (
        <FcEmptyState
          title="Hall of Fame unavailable"
          description={
            error
          }
        />
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [
                'Seasons',
                data.totals
                  .seasons,
              ],
              [
                'Recorded Honours',
                data.totals
                  .recordedHonours,
              ],
              [
                'Champion Records',
                data.totals
                  .champions,
              ],
              [
                'Honoured Players',
                data.totals
                  .legends,
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
                  <p className="text-2xl font-black text-amber-300">
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

          <FcPanel className="p-4 text-xs leading-5 text-slate-500">
            {
              data.scoringNote
            }
          </FcPanel>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Legacy Board
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Most Decorated Players
                </h2>
              </div>

              <span className="text-xs text-slate-600">
                Recorded honours only
              </span>
            </div>

            <FcPanel className="overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {data
                  .legends
                  .map(
                    (
                      legend,
                      index,
                    ) => (
                      <Link
                        key={
                          legend.userId
                        }
                        href={
                          `/discover/players/${legend.userId}`
                        }
                        className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-white/[0.025] sm:px-5"
                      >
                        <span className="text-center text-sm font-black text-amber-300">
                          #
                          {
                            index +
                            1
                          }
                        </span>

                        <div className="min-w-0">
                          <p className="truncate font-black">
                            {
                              nameFor(
                                legend.player,
                              )
                            }
                          </p>

                          <p className="mt-1 font-mono text-[10px] text-sky-400">
                            {
                              legend
                                .player
                                .playerCode
                            }
                          </p>
                        </div>

                        <div className="hidden items-center gap-4 text-center sm:flex">
                          <div>
                            <p className="font-black">
                              {
                                legend.ballonWins
                              }
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                              Ballon
                            </p>
                          </div>

                          <div>
                            <p className="font-black">
                              {
                                legend.tournamentTitles
                              }
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                              Titles
                            </p>
                          </div>

                          <div>
                            <p className="font-black">
                              {
                                legend.majorHonours
                              }
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                              Honours
                            </p>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}

                {data
                  .legends
                  .length ===
                  0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    Hall of Fame entries will appear after official honours are awarded.
                  </p>
                ) : null}
              </div>
            </FcPanel>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Season Archive
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Ballon Champions
                </h2>
              </div>

              <Link
                href="/awards/ballon"
                className="text-xs font-black text-amber-300"
              >
                All Seasons →
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {data.seasons.map(
                (
                  season,
                ) => (
                  <Link
                    key={
                      season.id
                    }
                    href={
                      `/awards/ballon/${season.id}`
                    }
                  >
                    <FcPanel className="h-full p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {
                              season.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(
                              season.startAt,
                            ).toLocaleDateString()}{' '}
                            →{' '}
                            {new Date(
                              season.endAt,
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <FcStatusBadge
                          label={
                            season.status
                          }
                          tone="emerald"
                        />
                      </div>

                      {season.winner ? (
                        <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-300/[0.04] p-4">
                          <p className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                            👑 Ballon Winner
                          </p>

                          <p className="mt-2 text-lg font-black">
                            {
                              nameFor(
                                season.winner,
                              )
                            }
                          </p>
                        </div>
                      ) : null}

                      {season.podium
                        .length >
                        0 ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {season.podium.map(
                            (
                              row,
                            ) => (
                              <div
                                key={
                                  row.rank
                                }
                                className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center"
                              >
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                                  #
                                  {
                                    row.rank
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs font-black">
                                  {
                                    nameFor(
                                      row.player,
                                    )
                                  }
                                </p>

                                <p className="mt-1 text-[10px] font-black text-amber-300">
                                  {
                                    row.rating
                                  }
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                    </FcPanel>
                  </Link>
                ),
              )}

              {data.seasons
                .length ===
                0 ? (
                <FcPanel className="p-8 text-center text-sm text-slate-500 lg:col-span-2">
                  No locked or archived Ballon season yet.
                </FcPanel>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-black">
              Tournament Champions
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              {data.champions
                .slice(
                  0,
                  12,
                )
                .map(
                  (
                    champion,
                  ) => (
                    <FcPanel
                      key={
                        champion.id
                      }
                      className="p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={
                            `/discover/players/${champion.player.userId}`
                          }
                          className="min-w-0"
                        >
                          <p className="truncate font-black">
                            🏆{' '}
                            {
                              nameFor(
                                champion.player,
                              )
                            }
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {
                              champion
                                .tournament
                                .name
                            }{' '}
                            ·{' '}
                            {
                              champion
                                .tournament
                                .league
                                .name
                            }
                          </p>
                        </Link>

                        <span className="text-xs text-slate-600">
                          {new Date(
                            champion.awardedAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </FcPanel>
                  ),
                )}
            </div>
          </section>
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading Hall of Fame...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
