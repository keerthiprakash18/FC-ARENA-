'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AwardEmblem, PremiumPitch, PremiumPodium } from '@/components/fc/premium-ui';
import { FcIcon } from '@/components/fc/fc-icons';
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

interface AdminLeague {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
  league: {
    id: string;
    name: string;
  };
}

interface AdminBallonSeason
  extends BallonSeason {
  eligibleLeagueIds:
    string[];
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
    icon: 'ballon',
    title: 'FC Arena Ballon',
    detail: 'Seasonal Player Honour',
    href: '/awards/ballon',
  },
  {
    type: 'GOLDEN_BOOT',
    icon: 'boot',
    title: 'Golden Boot',
    detail: 'Top Scorer',
    href: '/awards/golden-boot',
  },
  {
    type: 'GOLDEN_GLOVE',
    icon: 'glove',
    title: 'Golden Glove',
    detail: 'Best Defensive Record',
    href: '/awards/golden-glove',
  },
  {
    type: 'PLAYER_OF_TOURNAMENT',
    icon: 'playmaker',
    title: 'Player of Tournament',
    detail: 'Best Overall Performance',
    href: '/awards/player-of-tournament',
  },
  {
    type: 'RISING_STAR',
    icon: 'ranking',
    title: 'Rising Star',
    detail: 'Best Eligible Newcomer',
    href: '/awards/rising-star',
  },
  {
    type: 'TOURNAMENT_CHAMPION',
    icon: 'ballon',
    title: 'Champion',
    detail: 'Tournament Winner',
    href: '/awards/tournament-champion',
  },
  {
    type: 'TOURNAMENT_RUNNER_UP',
    icon: 'ballon',
    title: 'Runner-Up',
    detail: 'Tournament Second Place',
    href: '/awards/tournament-runner-up',
  },
  {
    type: 'WINNING_STREAK',
    icon: 'ranking',
    title: 'Winning Streak',
    detail: 'Verified Win Run',
    href: '/awards/winning-streak',
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

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null,
    );

  const [
    adminLeagues,
    setAdminLeagues,
  ] =
    useState<AdminLeague[]>(
      [],
    );

  const [
    adminSeasons,
    setAdminSeasons,
  ] =
    useState<AdminBallonSeason[]>(
      [],
    );

  const [
    quickLeagueId,
    setQuickLeagueId,
  ] =
    useState('');

  const [
    adminBusy,
    setAdminBusy,
  ] =
    useState(false);

  const [
    adminMessage,
    setAdminMessage,
  ] =
    useState('');

  const [
    adminError,
    setAdminError,
  ] =
    useState('');

  useEffect(() => {
    let active =
      true;

    async function loadOverview() {
      try {
        const response =
          await authenticatedRequest<{
            success: true;
            data: AwardsOverview;
            error: null;
          }>('/awards/overview');

        if (!active) {
          return;
        }

        setData(
          response.data,
        );
        setError('');
        setLastUpdated(
          new Date(),
        );
      } catch (
        err
      ) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Awards.',
        );
      } finally {
        if (active) {
          setLoading(
            false,
          );
        }
      }
    }

    void loadOverview();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void loadOverview();
          }
        },
        15_000,
      );

    const refreshOnFocus =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void loadOverview();
        }
      };

    document.addEventListener(
      'visibilitychange',
      refreshOnFocus,
    );

    return () => {
      active =
        false;
      window.clearInterval(
        interval,
      );
      document.removeEventListener(
        'visibilitychange',
        refreshOnFocus,
      );
    };
  }, []);

  useEffect(() => {
    let active =
      true;

    async function loadAdminControls() {
      try {
        const leagueResponse =
          await authenticatedRequest<any>(
            '/leagues/my',
          );

        if (!active) {
          return;
        }

        const leagues:
          AdminLeague[] =
          (
            leagueResponse
              .data
              .leagues ??
            []
          ).filter(
            (
              item:
                AdminLeague,
            ) =>
              Boolean(
                item.adminRole,
              ),
          );

        setAdminLeagues(
          leagues,
        );

        if (
          leagues.length ===
          0
        ) {
          setAdminSeasons(
            [],
          );
          return;
        }

        setQuickLeagueId(
          (
            current,
          ) =>
            current ||
            leagues[0]
              .league.id,
        );

        const seasonResponse =
          await authenticatedRequest<any>(
            '/admin/ballon/seasons',
          );

        if (!active) {
          return;
        }

        setAdminSeasons(
          seasonResponse
            .data
            .seasons ??
            [],
        );
      } catch {
        /*
         * Admin discovery is deliberately silent
         * for normal players. Server-side
         * authorization still protects all admin
         * mutations.
         */
      }
    }

    void loadAdminControls();

    return () => {
      active =
        false;
    };
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

  const selectedAdminLeague =
    adminLeagues.find(
      (
        item,
      ) =>
        item.league.id ===
        quickLeagueId,
    ) ??
    adminLeagues[0] ??
    null;

  const draftSeason =
    adminSeasons.find(
      (
        season,
      ) =>
        season.status ===
          'DRAFT' &&
        (
          !quickLeagueId ||
          season.eligibleLeagueIds
            ?.includes(
              quickLeagueId,
            )
        ),
    ) ??
    null;

  async function refreshAfterAdminAction() {
    const [
      overviewResponse,
      seasonResponse,
    ] =
      await Promise.all([
        authenticatedRequest<{
          success: true;
          data: AwardsOverview;
          error: null;
        }>(
          '/awards/overview',
        ),
        authenticatedRequest<any>(
          '/admin/ballon/seasons',
        ),
      ]);

    setData(
      overviewResponse.data,
    );
    setLastUpdated(
      new Date(),
    );
    setAdminSeasons(
      seasonResponse
        .data
        .seasons ??
        [],
    );
  }

  async function startDraftSeason(
    seasonId: string,
  ) {
    setAdminBusy(
      true,
    );
    setAdminMessage(
      '',
    );
    setAdminError(
      '',
    );

    try {
      await authenticatedRequest(
        `/admin/ballon/seasons/${seasonId}/start`,
        {
          method:
            'POST',
        },
      );

      setAdminMessage(
        'FC Arena Ballon season is now LIVE.',
      );

      await refreshAfterAdminAction();
    } catch (
      err
    ) {
      setAdminError(
        err instanceof Error
          ? err.message
          : 'Unable to start the Ballon season.',
      );
    } finally {
      setAdminBusy(
        false,
      );
    }
  }

  async function quickCreateAndStart() {
    if (
      !selectedAdminLeague
    ) {
      return;
    }

    setAdminBusy(
      true,
    );
    setAdminMessage(
      '',
    );
    setAdminError(
      '',
    );

    try {
      const start =
        new Date();

      start.setHours(
        0,
        0,
        0,
        0,
      );

      const end =
        new Date(
          start,
        );

      end.setMonth(
        end.getMonth() +
          3,
      );

      end.setDate(
        end.getDate() -
          1,
      );

      end.setHours(
        23,
        59,
        59,
        999,
      );

      const created =
        await authenticatedRequest<any>(
          '/admin/ballon/seasons',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                name:
                  `FC Arena Ballon · ${selectedAdminLeague.league.name}`,
                startAt:
                  start.toISOString(),
                endAt:
                  end.toISOString(),
                minimumMatches:
                  15,
                rankingLimit:
                  20,
                eligibleLeagueIds:
                  [
                    selectedAdminLeague
                      .league.id,
                  ],
                eligibleTournamentIds:
                  [],
              }),
          },
        );

      const seasonId =
        created.data
          .season.id;

      await authenticatedRequest(
        `/admin/ballon/seasons/${seasonId}/start`,
        {
          method:
            'POST',
        },
      );

      setAdminMessage(
        'FC Arena Ballon created and started. Live rankings are now active.',
      );

      await refreshAfterAdminAction();
    } catch (
      err
    ) {
      setAdminError(
        err instanceof Error
          ? err.message
          : 'Unable to create and start the Ballon season.',
      );
    } finally {
      setAdminBusy(
        false,
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Hall of Honours"
      title="Awards"
      subtitle="Verified tournament honours, live award races and the FC Arena Ballon seasonal ranking."
      backHref="/dashboard"
      backLabel="Home"
      action={
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
          ● Live · 15s
          {lastUpdated
            ? ` · ${lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </span>
      }
    >
      <section className="premium-hero premium-awards-hero">
        <PremiumPitch />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] lg:items-center">
          <div className="flex flex-col items-start">
            <AwardEmblem />

            <p className="premium-eyebrow mt-6">
              Seasonal Player Honour
            </p>

            <h2 className="premium-awards-title mt-2">
              Ballon d’Or
            </h2>

            {data?.currentBallon ? (
              <>
                <p className="premium-hero-description">
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

                  <span className="premium-hero-tag">
                    Min.{' '}
                    {
                      data.currentBallon
                        .season
                        .minimumMatches
                    }{' '}
                    matches
                  </span>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
                  <Link
                    href={
                      `/awards/ballon/${data.currentBallon.season.id}`
                    }
                    className="theme-primary-button premium-button"
                  >
                    View Ballon Rankings →
                  </Link>

                  <Link
                    href="/awards/ballon"
                    className="theme-secondary-button premium-button"
                  >
                    All Seasons
                  </Link>
                </div>
              </>
            ) : (
              <p className="premium-hero-description">
                No Ballon season is live yet. Tournament awards continue to work normally until an administrator starts a season.
              </p>
            )}
          </div>

          <FcPanel className="premium-awards-leader overflow-hidden">
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
                          <FcIcon name="award" size={28} />
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

      {data?.currentBallon ? <PremiumPodium rows={rankings} seasonId={data.currentBallon.season.id} /> : null}

      {adminLeagues.length >
      0 ? (
        <details className="premium-admin-controls"><summary>Administrator controls · {selectedAdminLeague?.adminRole}</summary>
        <FcPanel className="overflow-hidden border-amber-400/20">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                  Admin Only
                </span>

                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  {
                    selectedAdminLeague
                      ?.adminRole
                  }
                </span>
              </div>

              <h2 className="mt-3 text-xl font-black sm:text-2xl">
                Ballon Admin Controls
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {data
                  ?.currentBallon
                  ? 'A Ballon season is already active. Live rankings will update automatically from verified SOLO results.'
                  : draftSeason
                    ? `Draft ready: ${draftSeason.name}. Start it here without leaving Awards.`
                    : 'No live season yet. Quick Start creates a 3-month Ballon season for the selected League and immediately turns live rankings on.'}
              </p>

              {adminMessage ? (
                <p className="mt-3 text-sm font-bold text-emerald-400">
                  ✓ {
                    adminMessage
                  }
                </p>
              ) : null}

              {adminError ? (
                <p className="mt-3 text-sm font-bold text-red-400">
                  {
                    adminError
                  }
                </p>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
              {adminLeagues.length >
              1 &&
              !data
                ?.currentBallon ? (
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                    Ballon League
                  </span>

                  <select
                    value={
                      quickLeagueId
                    }
                    onChange={(
                      event,
                    ) => {
                      setQuickLeagueId(
                        event.target
                          .value,
                      );
                      setAdminMessage(
                        '',
                      );
                      setAdminError(
                        '',
                      );
                    }}
                    className="min-h-11 rounded-xl border border-white/10 bg-[#121821] px-4 text-sm font-black outline-none"
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
              ) : null}

              <div className="flex flex-wrap gap-2">
                {data
                  ?.currentBallon ? (
                  <Link
                    href="/admin/ballon"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-black text-[#04130d]"
                  >
                    ● Ballon is LIVE
                  </Link>
                ) : draftSeason ? (
                  <button
                    type="button"
                    disabled={
                      adminBusy
                    }
                    onClick={() =>
                      void startDraftSeason(
                        draftSeason.id,
                      )
                    }
                    className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-black text-[#151006] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adminBusy
                      ? 'Starting...'
                      : 'Start Ballon Season'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      adminBusy ||
                      !selectedAdminLeague
                    }
                    onClick={() =>
                      void quickCreateAndStart()
                    }
                    className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-black text-[#151006] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adminBusy
                      ? 'Starting...'
                      : 'Create & Start 3-Month Season'}
                  </button>
                )}

                <Link
                  href="/admin/ballon"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-5 text-sm font-black text-slate-300 transition hover:border-amber-400/25"
                >
                  Advanced Settings
                </Link>
              </div>

              {!data
                ?.currentBallon &&
              !draftSeason ? (
                <p className="text-[11px] leading-5 text-slate-600">
                  Quick Start: 3 months · minimum 15 matches · Top 20 overview · verified SOLO results only. You can customize everything first through Advanced Settings.
                </p>
              ) : null}
            </div>
          </div>
        </FcPanel>
        </details>
      ) : null}

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

        <div className="premium-award-lanes">
          {awardCards.map(
            (
              award,
            ) => (
              <Link
                key={
                  award.type
                }
                href={
                  award.href
                }
                className="premium-award-lane"
              >
                <AwardEmblem kind={award.icon} />
                <div><h3>{award.title}</h3><p>{award.detail}</p><span className="theme-muted text-xs">{data?.trophyCabinet[award.type] ?? 0} honours earned</span></div>
                <FcIcon name="chevronRight" size={18} />
              </Link>
            ),
          )}
          <Link href="/tournaments" className="premium-award-lane"><AwardEmblem kind="playmaker" /><div><h3>Playmaker</h3><p>Explore verified assist leaders in your tournament rankings.</p><span className="premium-quiet">Choose a tournament →</span></div></Link>
          <Link href="/leaderboards" className="premium-award-lane"><AwardEmblem kind="ranking" /><div><h3>Power Ranking</h3><p>League performance, points and player identity from verified matches.</p><span className="premium-quiet">Explore rankings →</span></div></Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/awards/hall-of-fame"
          className="group block"
        >
          <FcPanel className="h-full border-amber-400/20 p-5 transition group-hover:border-amber-300/40">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              FC Arena Legacy
            </p>

            <h2 className="mt-2 text-xl font-black">
              Hall of Fame
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ballon champions, season podiums, tournament winners and historic major honours.
            </p>

            <p className="mt-4 text-sm font-black text-amber-300">
              Explore history →
            </p>
          </FcPanel>
        </Link>

        <Link
          href="/discover"
          className="group block"
        >
          <FcPanel className="h-full border-sky-400/15 p-5 transition group-hover:border-sky-300/35">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Discover competitions
            </p>

            <h2 className="mt-2 text-xl font-black">
              ⌕ Search FC Arena
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Find players, Leagues, Tournaments and Ballon seasons across FC Arena.
            </p>

            <p className="mt-4 text-sm font-black text-sky-400">
              Open Discover →
            </p>
          </FcPanel>
        </Link>
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
                      <FcIcon name="football" size={20} />
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
