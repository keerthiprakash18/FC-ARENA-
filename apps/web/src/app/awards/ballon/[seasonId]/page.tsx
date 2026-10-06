'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AwardEmblem, PremiumHero, PremiumPodium } from '@/components/fc/premium-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import {
  useParams,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FcPanel,
} from '@/components/fc/fc-ui';
import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  status: string;
  scoringConfig?: {
    matchPerformance?: number;
    attack?: number;
    defence?: number;
    goalDifference?: number;
    bigMatches?: number;
    consistency?: number;
  } | null;
}

interface RankingRow {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
  rating: number;
  eligible: boolean;
  previousPosition: number | null;
  rankChange: number | null;
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  cleanSheets?: number;
  statistics?: {
    matches?: number;
    wins?: number;
    draws?: number;
    losses?: number;
    goalsFor?: number;
    goalsAgainst?: number;
    goalDifference?: number;
    cleanSheets?: number;
  };
}

function metric(
  row: RankingRow,
  key:
    | 'matches'
    | 'wins'
    | 'draws'
    | 'losses'
    | 'goalsFor'
    | 'goalsAgainst'
    | 'goalDifference'
    | 'cleanSheets',
) {
  const direct =
    row[key];

  if (
    typeof direct ===
    'number'
  ) {
    return direct;
  }

  return (
    row.statistics?.[
      key
    ] ??
    0
  );
}

function nameFor(
  row: RankingRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}

function movement(
  row: RankingRow,
) {
  if (
    row.rankChange ===
      null ||
    row.rankChange ===
      0
  ) {
    return {
      text: '—',
      className:
        'text-slate-600',
    };
  }

  if (
    row.rankChange > 0
  ) {
    return {
      text:
        '▲ +' +
        row.rankChange,
      className:
        'text-emerald-400',
    };
  }

  return {
    text:
      '▼ ' +
      row.rankChange,
    className:
      'text-red-400',
  };
}

export default function BallonRankingsPage() {
  const {
    seasonId,
  } =
    useParams<{
      seasonId:
        string;
    }>();

  const [
    season,
    setSeason,
  ] =
    useState<Season | null>(
      null,
    );

  const [
    rows,
    setRows,
  ] =
    useState<RankingRow[]>(
      [],
    );

  const [
    limit,
    setLimit,
  ] =
    useState<
      10 | 20 | 50 | 'all'
    >('all');

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

  useEffect(() => {
    let active =
      true;

    async function loadRankings() {
      try {
        const response =
          await authenticatedRequest<any>(
            '/ballon/seasons/' +
              seasonId +
              '/rankings?limit=' +
              limit,
          );

        if (!active) {
          return;
        }

        setSeason(
          response
            .data
            .season,
        );

        setRows(
          response
            .data
            .rows ??
            [],
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
            : 'Unable to load Ballon rankings.',
        );
      }
    }

    void loadRankings();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void loadRankings();
          }
        },
        10_000,
      );

    const refreshOnFocus =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void loadRankings();
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
  }, [
    limit,
    seasonId,
  ]);

  const eligible =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.eligible,
        ),
      [
        rows,
      ],
    );

  const scoring = {
    matchPerformance:
      season?.scoringConfig
        ?.matchPerformance ??
      30,
    attack:
      season?.scoringConfig
        ?.attack ??
      20,
    defence:
      season?.scoringConfig
        ?.defence ??
      15,
    goalDifference:
      season?.scoringConfig
        ?.goalDifference ??
      15,
    bigMatches:
      season?.scoringConfig
        ?.bigMatches ??
      15,
    consistency:
      season?.scoringConfig
        ?.consistency ??
      5,
  };

  const live =
    season?.status ===
    'LIVE';

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena Ballon"
      title={
        season?.name ??
        'Season Rankings'
      }
      subtitle={
        season
          ? `${new Date(
              season.startAt,
            ).toLocaleDateString()} – ${new Date(
              season.endAt,
            ).toLocaleDateString()} · Minimum ${season.minimumMatches} matches · ${season.status}`
          : 'Loading seasonal ranking...'
      }
      header={<PremiumHero eyebrow="FC Arena · Ballon d’Or" title={season?.name ?? 'Season Rankings'} description={season ? `${new Date(season.startAt).toLocaleDateString()} – ${new Date(season.endAt).toLocaleDateString()} · Minimum ${season.minimumMatches} matches · ${season.status}` : 'Loading seasonal ranking...'} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/awards"
          className="text-sm font-black text-slate-500 transition hover:text-amber-300"
        >
          ← Hall of Honours
        </Link>

        <span className={
          live
            ? 'rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300'
            : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400'
        }>
          {live
            ? '● LIVE · refresh 10s'
            : season?.status ?? 'Loading'}
          {lastUpdated
            ? ` · ${lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </span>

        <div className="flex flex-wrap rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
          {(
            [
              'all',
              10,
              20,
              50,
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
                  setLimit(
                    value,
                  )
                }
                className={
                  limit ===
                  value
                    ? 'rounded-lg bg-amber-300 px-4 py-2 text-xs font-black text-[#151006]'
                    : 'rounded-lg px-4 py-2 text-xs font-black text-slate-500'
                }
              >
                {value ===
                'all'
                  ? 'ALL'
                  : `TOP ${value}`}
              </button>
            ),
          )}
        </div>
      </div>

      <PremiumPodium rows={rows} seasonId={seasonId} />

      <details className="premium-admin-controls overflow-hidden rounded-xl border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Transparent Scoring
            </p>
            <h2 className="mt-1 text-base font-black">
              How is the Ballon rating calculated?
            </h2>
          </div>
          <span className="text-sm font-black text-amber-300">
            100 pts
          </span>
        </summary>

        <div className="border-t border-white/[0.07] p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: 'Match Performance',
                value: scoring.matchPerformance,
                detail: '55% points per match (Win 3, Draw 1) + 45% win rate.',
              },
              {
                label: 'Attack',
                value: scoring.attack,
                detail: '70% goals per match + 30% total goals, normalized against the field.',
              },
              {
                label: 'Defence',
                value: scoring.defence,
                detail: '60% clean-sheet rate + 40% goals-conceded efficiency.',
              },
              {
                label: 'Goal Difference',
                value: scoring.goalDifference,
                detail: 'Positive goal difference per match, normalized against the best rate.',
              },
              {
                label: 'Big Matches',
                value: scoring.bigMatches,
                detail: 'QF win +0.5, SF +1, Final +2, Champion +3, Runner-up +1; capped by this weight.',
              },
              {
                label: 'Consistency',
                value: scoring.consistency,
                detail: '60% longest win streak (up to 5) + 40% low-loss rate.',
              },
            ].map((rule) => (
              <div
                key={rule.label}
                className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">
                    {rule.label}
                  </p>
                  <span className="text-sm font-black text-amber-300">
                    {rule.value}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {rule.detail}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Only canonical confirmed SOLO results inside this season&apos;s eligible scope and date window count. Players must complete at least <strong className="text-slate-300">{season?.minimumMatches ?? '—'} matches</strong> to become eligible. Eligible players rank first; ties are then resolved by rating, wins, goal difference and goals scored.
          </p>
        </div>
      </details>

      <section className="premium-ranking-ledger">
        <div className="grid gap-5 border-b border-white/[0.07] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
          <AwardEmblem />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Seasonal Player Honour
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Live Ballon Rankings
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Only canonical confirmed SOLO results inside the selected season scope are counted.
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-3xl font-black text-amber-300">
              {
                eligible.length
              }
            </p>

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Eligible shown
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {rows.map(
            (
              row,
            ) => {
              const change =
                movement(
                  row,
                );

              return (
                <Link
                  key={
                    row.userId
                  }
                  href={
                    `/awards/ballon/${seasonId}/players/${row.userId}`
                  }
                  className="grid grid-cols-[42px_1fr_auto] gap-3 p-4 transition hover:bg-white/[0.025] sm:grid-cols-[48px_1fr_70px_70px_70px_86px] sm:items-center sm:px-6"
                >
                  <span className={
                    row.position <=
                    3
                      ? 'text-center text-lg font-black text-amber-300'
                      : 'text-center text-sm font-black text-slate-500'
                  }>
                    #
                    {
                      row.position
                    }
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                      {row.profileImageUrl ? (
                        <Image
                          src={
                            row.profileImageUrl
                          }
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-sm">
                          <FcIcon name="profile" size={20} />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {nameFor(
                          row,
                        )}
                      </span>

                      <span className="mt-1 block truncate font-mono text-[9px] text-slate-600">
                        {
                          row.playerCode ||
                          'FC Arena Player'
                        }
                      </span>

                      {!row.eligible ? (
                        <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-amber-500">
                          Not Yet Eligible · {
                            metric(
                              row,
                              'matches',
                            )
                          }/{season?.minimumMatches ?? '—'}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="text-right">
                    <span className="block text-xl font-black text-amber-300">
                      {
                        row.rating
                      }
                    </span>

                    <span className={`text-[10px] font-bold ${change.className}`}>
                      {
                        change.text
                      }
                    </span>
                  </span>

                  <span className="hidden text-center text-xs font-bold text-slate-400 sm:block">
                    {
                      metric(
                        row,
                        'matches',
                      )
                    }{' '}
                    M
                  </span>

                  <span className="hidden text-center text-xs font-bold text-emerald-400 sm:block">
                    {
                      metric(
                        row,
                        'wins',
                      )
                    }{' '}
                    W
                  </span>

                  <span className="hidden text-center text-xs font-bold text-slate-300 sm:block">
                    {
                      metric(
                        row,
                        'goalsFor',
                      )
                    }{' '}
                    G
                  </span>
                </Link>
              );
            },
          )}

          {rows.length ===
          0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No eligible verified matches are available for this season yet.
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <FcPanel className="p-5 text-sm text-red-300">
          {
            error
          }
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
