'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useParams,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';

import {
  FcPanel,
  FcStatCard,
} from '@/components/fc/fc-ui';
import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface Ranking {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
  eligible: boolean;
  rating: number;
  ratingBreakdown:
    Record<string, number>;
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  cleanSheets?: number;
  tournamentsPlayed?: number;
  tournamentTitles?: number;
  longestWinStreak?: number;
  statistics?: Record<
    string,
    number | string | null
  >;
}

interface Season {
  id: string;
  name: string;
  minimumMatches: number;
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

const breakdownLabels:
  Record<string, string> = {
    matchPerformance:
      'Match Performance',
    attack: 'Attack',
    defence: 'Defence',
    goalDifference:
      'Goal Difference',
    bigMatches:
      'Big Matches',
    consistency:
      'Consistency',
  };

function stat(
  row: Ranking,
  key: string,
) {
  const direct =
    (
      row as unknown as
        Record<
          string,
          unknown
        >
    )[key];

  if (
    typeof direct ===
    'number'
  ) {
    return direct;
  }

  const stored =
    row.statistics?.[
      key
    ];

  return typeof stored ===
    'number'
    ? stored
    : 0;
}

export default function BallonPlayerPage() {
  const {
    seasonId,
    userId,
  } =
    useParams<{
      seasonId:
        string;
      userId:
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
    ranking,
    setRanking,
  ] =
    useState<Ranking | null>(
      null,
    );

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

    async function loadPlayer() {
      try {
        const response =
          await authenticatedRequest<any>(
            `/ballon/seasons/${seasonId}/players/${userId}`,
          );

        if (!active) {
          return;
        }

        setSeason(
          response
            .data
            .season,
        );

        setRanking(
          response
            .data
            .ranking,
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
            : 'Unable to load player Ballon profile.',
        );
      }
    }

    void loadPlayer();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void loadPlayer();
          }
        },
        10_000,
      );

    return () => {
      active =
        false;
      window.clearInterval(
        interval,
      );
    };
  }, [
    seasonId,
    userId,
  ]);

  if (
    !ranking
  ) {
    return (
      <SecondaryFeaturePage
        eyebrow="FC Arena Ballon"
        title="Player Rating"
        subtitle={
          error ||
          'Loading player performance...'
        }
      >
        <Link
          href={
            `/awards/ballon/${seasonId}`
          }
          className="text-sm font-black text-slate-500"
        >
          ← Rankings
        </Link>
      </SecondaryFeaturePage>
    );
  }

  const playerName =
    ranking.inGameName ||
    ranking.fullName;

  const breakdownMaximum:
    Record<string, number> = {
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

  return (
    <SecondaryFeaturePage
      eyebrow={
        season?.name ??
        'FC Arena Ballon'
      }
      title={
        playerName
      }
      subtitle={
        ranking.eligible
          ? `#${ranking.position} · FC Arena Ballon rating breakdown`
          : `Not Yet Eligible · Minimum ${season?.minimumMatches ?? '—'} matches`
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={
            `/awards/ballon/${seasonId}`
          }
          className="text-sm font-black text-slate-500 transition hover:text-amber-300"
        >
          ← Ballon Rankings
        </Link>

        <span className={
          season?.status ===
          'LIVE'
            ? 'rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300'
            : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400'
        }>
          {season?.status ===
          'LIVE'
            ? '● LIVE · refresh 10s'
            : season?.status ?? 'Loading'}
          {lastUpdated
            ? ` · ${lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </span>
      </div>

      <section className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-[#0B0F14] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-amber-300/50 bg-white/[0.05]">
            {ranking.profileImageUrl ? (
              <Image
                src={
                  ranking.profileImageUrl
                }
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="grid h-full place-items-center text-4xl">
                👑
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              FC Arena Ballon
            </p>

            <h2 className="mt-2 truncate text-3xl font-black sm:text-4xl">
              {
                playerName
              }
            </h2>

            <p className="mt-2 font-mono text-xs text-slate-500">
              {
                ranking.playerCode ||
                'FC Arena Player'
              }
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-5xl font-black text-amber-300">
              {
                ranking.rating
              }
            </p>

            <p className="mt-1 text-xs font-black uppercase tracking-widest text-slate-500">
              / 100 Rating
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FcStatCard
          label="Matches"
          value={
            stat(
              ranking,
              'matches',
            )
          }
        />

        <FcStatCard
          label="Wins"
          value={
            stat(
              ranking,
              'wins',
            )
          }
          tone="emerald"
        />

        <FcStatCard
          label="Goals"
          value={
            stat(
              ranking,
              'goalsFor',
            )
          }
          tone="amber"
        />

        <FcStatCard
          label="Clean Sheets"
          value={
            stat(
              ranking,
              'cleanSheets',
            )
          }
          tone="cyan"
        />

        <FcStatCard
          label="Goals Against"
          value={
            stat(
              ranking,
              'goalsAgainst',
            )
          }
          tone="slate"
        />

        <FcStatCard
          label="Goal Difference"
          value={
            stat(
              ranking,
              'goalDifference',
            )
          }
          tone="emerald"
        />

        <FcStatCard
          label="Titles"
          value={
            stat(
              ranking,
              'tournamentTitles',
            )
          }
          tone="amber"
        />

        <FcStatCard
          label="Longest Streak"
          value={
            stat(
              ranking,
              'longestWinStreak',
            )
          }
          tone="cyan"
        />
      </section>

      <details className="overflow-hidden rounded-[24px] border border-amber-400/15 bg-amber-400/[0.035]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Why this rating?
            </p>
            <h2 className="mt-1 text-base font-black">
              Scoring formula
            </h2>
          </div>
          <span className="text-sm font-black text-amber-300">
            / 100
          </span>
        </summary>

        <div className="grid gap-3 border-t border-white/[0.07] p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Match Performance', breakdownMaximum.matchPerformance, 'Points per match + win rate'],
            ['Attack', breakdownMaximum.attack, 'Goals per match + total goals'],
            ['Defence', breakdownMaximum.defence, 'Clean sheets + low goals conceded'],
            ['Goal Difference', breakdownMaximum.goalDifference, 'Positive GD per match'],
            ['Big Matches', breakdownMaximum.bigMatches, 'QF/SF/Final wins + placements'],
            ['Consistency', breakdownMaximum.consistency, 'Win streak + low-loss rate'],
          ].map((rule) => (
            <div
              key={String(rule[0])}
              className="rounded-xl border border-white/[0.07] bg-black/10 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black">
                  {rule[0]}
                </p>
                <span className="text-xs font-black text-amber-300">
                  {rule[1]}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {rule[2]}
              </p>
            </div>
          ))}
        </div>
      </details>

      <FcPanel className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Transparent Rating
          </p>

          <h2 className="mt-1 text-xl font-black">
            Rating Breakdown
          </h2>
        </div>

        <div className="space-y-5 p-5">
          {Object.entries(
            breakdownLabels,
          ).map(
            (
              [
                key,
                label,
              ],
            ) => {
              const value =
                Number(
                  ranking
                    .ratingBreakdown[
                    key
                  ] ??
                    0,
                );

              const maximum =
                breakdownMaximum[
                  key
                ] ??
                1;

              const width =
                Math.max(
                  0,
                  Math.min(
                    100,
                    (
                      value /
                      maximum
                    ) *
                      100,
                  ),
                );

              return (
                <div
                  key={
                    key
                  }
                >
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-bold text-slate-300">
                      {
                        label
                      }
                    </span>

                    <span className="font-black">
                      {
                        value.toFixed(
                          1,
                        )
                      }{' '}
                      /{' '}
                      {
                        maximum
                      }
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-amber-300"
                      style={{
                        width:
                          width +
                          '%',
                      }}
                    />
                  </div>
                </div>
              );
            },
          )}
        </div>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
