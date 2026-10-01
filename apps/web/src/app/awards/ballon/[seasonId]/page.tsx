'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  risingStarPosition?: number;

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
    myRanking,
    setMyRanking,
  ] =
    useState<RankingRow | null>(
      null,
    );

  const [
    risingStarRows,
    setRisingStarRows,
  ] =
    useState<RankingRow[]>(
      [],
    );

  const [
    view,
    setView,
  ] =
    useState<
      'top' | 'mine'
    >('top');

  const [
    limit,
    setLimit,
  ] =
    useState<
      10 | 20 | 50
    >(20);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void Promise.all([
      authenticatedRequest<any>(
        '/ballon/seasons/' +
          seasonId +
          '/rankings?limit=' +
          limit,
      ),
      authenticatedRequest<any>(
        '/ballon/seasons/' +
          seasonId +
          '/rankings/me',
      ),
    ])
      .then(
        ([
          rankingResponse,
          myResponse,
        ]) => {
          setSeason(
            rankingResponse
              .data
              .season,
          );

          setRows(
            rankingResponse
              .data
              .rows ??
              [],
          );

          setRisingStarRows(
            rankingResponse
              .data
              .risingStarRows ??
              [],
          );

          setMyRanking(
            myResponse
              .data
              .ranking ??
              null,
          );
        },
      )
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Ballon rankings.',
          ),
      );
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

  const displayedRows =
    view ===
    'mine'
      ? myRanking
        ? [
            myRanking,
          ]
        : []
      : rows;

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
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/awards"
          className="text-sm font-black text-slate-500 transition hover:text-amber-300"
        >
          ← Hall of Honours
        </Link>

        <div className="flex flex-wrap rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
          {(
            [
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
                onClick={() => {
                  setView(
                    'top',
                  );
                  setLimit(
                    value,
                  );
                }}
                className={
                  view ===
                    'top' &&
                  limit ===
                    value
                    ? 'rounded-lg bg-amber-300 px-4 py-2 text-xs font-black text-[#151006]'
                    : 'rounded-lg px-4 py-2 text-xs font-black text-slate-500'
                }
              >
                TOP{' '}
                {
                  value
                }
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() =>
              setView(
                'mine',
              )
            }
            className={
              view ===
              'mine'
                ? 'rounded-lg bg-sky-300 px-4 py-2 text-xs font-black text-[#06111a]'
                : 'rounded-lg px-4 py-2 text-xs font-black text-slate-500'
            }
          >
            MY RANK
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[30px] border border-amber-400/20 bg-[#0B0F14]">
        <div className="grid gap-5 border-b border-white/[0.07] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
          <Image
            src="/awards/fc-arena-ballon-mark.svg"
            alt="FC Arena Ballon"
            width={84}
            height={84}
            className="h-16 w-16 sm:h-20 sm:w-20"
          />

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
          {displayedRows.map(
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
                          ⚽
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

          {displayedRows.length ===
          0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              {view ===
              'mine'
                ? 'You are not currently inside this season ranking.'
                : 'No eligible verified matches are available for this season yet.'}
            </div>
          ) : null}
        </div>
      </section>

      {season?.status ===
        'LIVE' &&
      risingStarRows.length >
        0 ? (
        <section>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              Newcomer Award
            </p>

            <h2 className="mt-1 text-2xl font-black">
              🚀 Rising Star Race
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Eligible newcomers from the 90-day entry window, using the same transparent Ballon performance rating.
            </p>
          </div>

          <FcPanel className="overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {risingStarRows.map(
                (
                  row,
                ) => (
                  <Link
                    key={
                      row.userId
                    }
                    href={
                      `/awards/ballon/${seasonId}/players/${row.userId}`
                    }
                    className="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-4 transition hover:bg-white/[0.025] sm:px-6"
                  >
                    <span className="text-center text-sm font-black text-sky-300">
                      #
                      {
                        row.risingStarPosition ??
                        row.position
                      }
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {nameFor(
                          row,
                        )}
                      </span>

                      <span className="mt-1 block text-[10px] text-slate-600">
                        Ballon #
                        {
                          row.position
                        }{' '}
                        ·{' '}
                        {
                          metric(
                            row,
                            'matches',
                          )
                        }{' '}
                        matches
                      </span>
                    </span>

                    <span className="text-lg font-black text-amber-300">
                      {
                        row.rating
                      }
                    </span>
                  </Link>
                ),
              )}
            </div>
          </FcPanel>
        </section>
      ) : null}

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
