'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FcEmptyState,
  FcPanel,
} from '@/components/fc/fc-ui';
import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface BallonSeason {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  status: string;
}

interface BallonRow {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
  rating: number;
  previousPosition: number | null;
  rankChange: number | null;
  eligible: boolean;
  matches?: number;
  wins?: number;
  goalsFor?: number;
  statistics?: {
    matches?: number;
    wins?: number;
    goalsFor?: number;
  };
}

interface TournamentAward {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  tournamentId: string;
}

interface SeasonalAward {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  seasonId: string;
}

interface RecentSeasonalAward
  extends SeasonalAward {
  player: {
    fullName: string;
    inGameName: string | null;
    playerCode: string | null;
    profileImageUrl: string | null;
  };
}

interface AwardTournament {
  id: string;
  name: string;
  code: string;
  status: string;
  league: {
    id: string;
    name: string;
  };
}

interface AwardsOverview {
  currentBallon: {
    season: BallonSeason;
    rankings: {
      locked: boolean;
      rows: BallonRow[];
    } | null;
  } | null;

  trophyCabinet:
    Record<string, number>;

  myTournamentAwards:
    TournamentAward[];

  mySeasonalAwards:
    SeasonalAward[];

  activeAwardTournaments:
    AwardTournament[];

  recentSeasonalWinners:
    RecentSeasonalAward[];
}

const awardCards = [
  {
    type: 'FC_ARENA_BALLON',
    icon: '👑',
    title: 'FC Arena Ballon',
    detail: 'Seasonal Player Honour',
  },
  {
    type: 'GOLDEN_BOOT',
    icon: '⚽',
    title: 'Golden Boot',
    detail: 'Top Scorer',
  },
  {
    type: 'GOLDEN_GLOVE',
    icon: '🧤',
    title: 'Golden Glove',
    detail: 'Best Defensive Record',
  },
  {
    type: 'PLAYER_OF_TOURNAMENT',
    icon: '⭐',
    title: 'Player of Tournament',
    detail: 'Best Overall Performance',
  },
  {
    type: 'RISING_STAR',
    icon: '🚀',
    title: 'Rising Star',
    detail: 'Best Eligible Newcomer',
  },
  {
    type: 'TOURNAMENT_CHAMPION',
    icon: '🏆',
    title: 'Champion',
    detail: 'Tournament Winner',
  },
  {
    type: 'TOURNAMENT_RUNNER_UP',
    icon: '🥈',
    title: 'Runner-Up',
    detail: 'Tournament Second Place',
  },
  {
    type: 'WINNING_STREAK',
    icon: '🔥',
    title: 'Winning Streak',
    detail: 'Verified Win Run',
  },
] as const;

function displayName(
  row: BallonRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}

function rankMovement(
  row: BallonRow,
) {
  if (
    row.rankChange ===
      null ||
    row.rankChange ===
      0
  ) {
    return '—';
  }

  return row.rankChange > 0
    ? `▲ +${row.rankChange}`
    : `▼ ${row.rankChange}`;
}

function seasonRange(
  season: BallonSeason,
) {
  const start =
    new Date(
      season.startAt,
    );

  const end =
    new Date(
      season.endAt,
    );

  return `${start.toLocaleDateString(
    undefined,
    {
      month: 'short',
      year: 'numeric',
    },
  )} – ${end.toLocaleDateString(
    undefined,
    {
      month: 'short',
      year: 'numeric',
    },
  )}`;
}

export default function AwardsPage() {
  const [
    data,
    setData,
  ] =
    useState<AwardsOverview | null>(
      null,
    );

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
    void authenticatedRequest<{
      success: true;
      data: AwardsOverview;
      error: null;
    }>('/awards/overview')
      .then(
        (
          response,
        ) => {
          setData(
            response.data,
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
              : 'Unable to load Awards.',
          );
        },
      )
      .finally(
        () =>
          setLoading(
            false,
          ),
      );
  }, []);

  const rankings =
    data?.currentBallon
      ?.rankings?.rows ??
    [];

  const leader =
    rankings.find(
      (row) =>
        row.eligible,
    ) ??
    rankings[0] ??
    null;

  const cabinetTotal =
    useMemo(
      () =>
        Object.values(
          data
            ?.trophyCabinet ??
            {},
        ).reduce(
          (
            total,
            count,
          ) =>
            total +
            count,
          0,
        ),
      [
        data,
      ],
    );

  return (
    <SecondaryFeaturePage
      eyebrow="Hall of Honours"
      title="Awards"
      subtitle="Verified tournament honours, live award races and the FC Arena Ballon seasonal ranking."
    >
      <section className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-[#0B0F14] p-5 sm:p-7 lg:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] lg:items-center">
          <div className="flex flex-col items-start">
            <Image
              src="/awards/fc-arena-ballon.svg"
              alt="FC Arena Ballon"
              width={168}
              height={168}
              priority
              className="h-28 w-28 rounded-[26px] sm:h-36 sm:w-36"
            />

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">
              Seasonal Player Honour
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              FC ARENA BALLON
            </h2>

            {data?.currentBallon ? (
              <>
                <p className="mt-3 text-sm font-semibold text-slate-400">
                  {
                    data.currentBallon
                      .season.name
                  }{' '}
                  ·{' '}
                  {seasonRange(
                    data.currentBallon
                      .season,
                  )}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200">
                    {
                      data.currentBallon
                        .season.status
                    }
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-slate-400">
                    Min.{' '}
                    {
                      data.currentBallon
                        .season
                        .minimumMatches
                    }{' '}
                    matches
                  </span>
                </div>

                <Link
                  href={
                    `/awards/ballon/${data.currentBallon.season.id}`
                  }
                  className="mt-7 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#151006] transition hover:bg-amber-200"
                >
                  View Ballon Rankings →
                </Link>
              </>
            ) : (
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                No Ballon season is live yet. Tournament awards continue to work normally until an administrator starts a season.
              </p>
            )}
          </div>

          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Current Leader
              </p>

              {leader ? (
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-amber-300/40 bg-white/[0.05]">
                    {leader.profileImageUrl ? (
                      <Image
                        src={
                          leader.profileImageUrl
                        }
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xl">
                        👑
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-black">
                      {displayName(
                        leader,
                      )}
                    </p>

                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      {
                        leader.playerCode ||
                        'FC Arena Player'
                      }
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-black text-amber-300">
                      {
                        leader.rating
                      }
                    </p>

                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      / 100
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Rankings will appear after eligible verified matches.
                </p>
              )}
            </div>

            <div className="divide-y divide-white/[0.06]">
              {rankings
                .slice(
                  0,
                  5,
                )
                .map(
                  (
                    row,
                  ) => (
                    <Link
                      key={
                        row.userId
                      }
                      href={
                        data
                          ?.currentBallon
                          ? `/awards/ballon/${data.currentBallon.season.id}/players/${row.userId}`
                          : '/awards'
                      }
                      className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-3 px-5 py-3 transition hover:bg-white/[0.025]"
                    >
                      <span className="text-center text-sm font-black text-amber-300">
                        #
                        {
                          row.position
                        }
                      </span>

                      <span className="truncate text-sm font-bold">
                        {displayName(
                          row,
                        )}
                      </span>

                      <span className="text-xs font-black text-slate-300">
                        {
                          row.rating
                        }
                      </span>

                      <span
                        className={
                          row.rankChange &&
                          row.rankChange >
                            0
                            ? 'text-xs font-bold text-emerald-400'
                            : row.rankChange &&
                                row.rankChange <
                                  0
                              ? 'text-xs font-bold text-red-400'
                              : 'text-xs font-bold text-slate-600'
                        }
                      >
                        {rankMovement(
                          row,
                        )}
                      </span>
                    </Link>
                  ),
                )}
            </div>
          </FcPanel>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              FC Arena
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Award Categories
            </h2>
          </div>

          <p className="text-xs font-semibold text-slate-500">
            {
              cabinetTotal
            }{' '}
            honours earned
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {awardCards.map(
            (
              award,
            ) => (
              <FcPanel
                key={
                  award.type
                }
                className="p-4 sm:p-5"
              >
                <span className="text-3xl">
                  {
                    award.icon
                  }
                </span>

                <h3 className="mt-4 text-sm font-black sm:text-base">
                  {
                    award.title
                  }
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {
                    award.detail
                  }
                </p>

                <p className="mt-4 text-2xl font-black text-amber-300">
                  {
                    data
                      ?.trophyCabinet[
                      award.type
                    ] ??
                    0
                  }
                </p>
              </FcPanel>
            ),
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FcPanel className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Live Award Races
          </p>

          <h2 className="mt-1 text-xl font-black">
            Active SOLO Tournaments
          </h2>

          <div className="mt-5 space-y-2">
            {data
              ?.activeAwardTournaments
              .map(
                (
                  tournament,
                ) => (
                  <Link
                    key={
                      tournament.id
                    }
                    href={
                      `/tournaments/${tournament.id}/achievements`
                    }
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-amber-400/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">
                        {
                          tournament.name
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {
                          tournament
                            .league.name
                        }{' '}
                        ·{' '}
                        {
                          tournament.status
                        }
                      </p>
                    </div>

                    <span className="text-lg">
                      ⚽
                    </span>
                  </Link>
                ),
              )}

            {data &&
            data
              .activeAwardTournaments
              .length ===
              0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                No active SOLO tournament award races are available in your leagues.
              </p>
            ) : null}
          </div>
        </FcPanel>

        <FcPanel className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Recent Winners
          </p>

          <h2 className="mt-1 text-xl font-black">
            Seasonal Honours
          </h2>

          <div className="mt-5 space-y-2">
            {data
              ?.recentSeasonalWinners
              .slice(
                0,
                6,
              )
              .map(
                (
                  award,
                ) => (
                  <div
                    key={
                      award.id
                    }
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                  >
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/[0.05]">
                      {award
                        .player
                        .profileImageUrl ? (
                        <Image
                          src={
                            award
                              .player
                              .profileImageUrl
                          }
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          {
                            award.type ===
                            'FC_ARENA_BALLON'
                              ? '👑'
                              : '🚀'
                          }
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        {award
                          .player
                          .inGameName ||
                          award
                            .player
                            .fullName}
                      </p>

                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {award.type.replaceAll(
                          '_',
                          ' ',
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )}

            {data &&
            data
              .recentSeasonalWinners
              .length ===
              0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-500">
                Seasonal winners will appear after a Ballon season is locked.
              </p>
            ) : null}
          </div>
        </FcPanel>
      </section>

      {!loading &&
      !data ? (
        <FcEmptyState
          title="Awards unavailable"
          description={
            error ||
            'Unable to load the FC Arena Hall of Honours.'
          }
          actionLabel="Back to Dashboard"
          actionHref="/dashboard"
        />
      ) : null}

      {loading ? (
        <FcPanel className="p-8 text-center">
          <p className="text-sm text-slate-500">
            Loading FC Arena honours...
          </p>
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
