'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  FcEmptyState,
  FcPanel,
  FcStatCard,
} from '@/components/fc/fc-ui';

import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest, getCurrentUser } from '@/lib/auth-client';

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  tournament: {
    id: string;
    name: string;
  };
}

interface BallonPlayer {
  id?: string;
  userId?: string;
  fullName?: string;
  displayName?: string;
  rating?: number;
  rank?: number;
  movement?: number;
  matches?: number;
  wins?: number;
  goalsFor?: number;
  cleanSheets?: number;
  player?: {
    profileImageUrl?: string | null;
    identity?: {
      inGameName?: string | null;
    } | null;
  } | null;
}

interface BallonSeason {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  minMatches: number;
  rankingSize: number;
  winnerRating?: number | null;
  winner?: BallonPlayer | null;
  risingStarWinner?: BallonPlayer | null;
  league?: {
    id: string;
    name: string;
  } | null;
}

interface CurrentBallonData {
  season: BallonSeason | null;
  rankings: BallonPlayer[];
  myRank: BallonPlayer | null;
  risingStarRankings?: BallonPlayer[];
}

function iconFor(type: string) {
  switch (type) {
    case 'TOURNAMENT_CHAMPION':
      return '🏆';
    case 'TOURNAMENT_RUNNER_UP':
      return '🥈';
    case 'GOLDEN_BOOT':
      return '⚽';
    case 'GOLDEN_GLOVE':
      return '🧤';
    case 'BEST_PLAYER':
      return '⭐';
    case 'WINNING_STREAK':
      return '🔥';
    default:
      return '🎖';
  }
}

function labelFor(type: string) {
  if (type === 'BEST_PLAYER') {
    return 'Player of the Tournament';
  }

  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function playerName(player: BallonPlayer | null | undefined) {
  return (
    player?.displayName ||
    player?.player?.identity?.inGameName ||
    player?.fullName ||
    '—'
  );
}

export default function AwardsPage() {
  const [awards, setAwards] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<CurrentBallonData>({
    season: null,
    rankings: [],
    myRank: null,
  });
  const [seasons, setSeasons] = useState<BallonSeason[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [user, achievements, currentSeason, seasonList] =
          await Promise.all([
            getCurrentUser(),
            authenticatedRequest<any>('/players/me/achievements'),
            authenticatedRequest<any>('/ballon/seasons/current'),
            authenticatedRequest<any>('/ballon/seasons'),
          ]);

        setUserId(user.id);
        setAwards(achievements.data.achievements ?? []);
        setCurrent(currentSeason.data);
        setSeasons(seasonList.data.seasons ?? []);
      } catch {
        setAwards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const value: Record<string, number> = {};

    for (const award of awards) {
      value[award.type] = (value[award.type] ?? 0) + 1;
    }

    return value;
  }, [awards]);

  const ballonWins = seasons.filter(
    (season) => season.winner?.id === userId,
  ).length;

  const risingStarWins = seasons.filter(
    (season) => season.risingStarWinner?.id === userId,
  ).length;

  const individualAwards =
    (counts.GOLDEN_BOOT ?? 0) +
    (counts.GOLDEN_GLOVE ?? 0) +
    (counts.BEST_PLAYER ?? 0) +
    ballonWins +
    risingStarWins;

  const archivedSeasons = seasons.filter((season) =>
    ['LOCKED', 'ARCHIVED'].includes(season.status),
  );

  return (
    <SecondaryFeaturePage
      eyebrow="Hall of Honours"
      title="FC Arena Awards"
      subtitle="Verified tournament honours and the live FC Arena Ballon seasonal ranking."
    >
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <FcPanel className="relative overflow-hidden p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(245,196,81,0.18),transparent_42%)]" />

          <div className="relative grid min-h-[330px] gap-6 p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="flex items-center justify-center">
              <img
                src="/awards/fc-arena-ballon.svg"
                alt="FC Arena Ballon"
                className="w-full max-w-[430px]"
              />
            </div>

            <div>
              <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.22em]">
                Seasonal Player Honour
              </p>

              <h2 className="theme-text mt-3 text-3xl font-black sm:text-4xl">
                {current.season?.name ?? 'FC Arena Ballon'}
              </h2>

              {current.season ? (
                <>
                  <p className="theme-secondary-text mt-3 text-sm leading-6">
                    {new Date(current.season.startAt).toLocaleDateString()}
                    {' — '}
                    {new Date(current.season.endAt).toLocaleDateString()}
                    {' · Minimum '}
                    {current.season.minMatches}
                    {' verified matches'}
                  </p>

                  {current.rankings[0] ? (
                    <div className="theme-elevated mt-6 rounded-2xl border p-4">
                      <p className="theme-muted text-[10px] font-black uppercase tracking-[0.16em]">
                        Current Leader
                      </p>

                      <div className="mt-2 flex items-end justify-between gap-4">
                        <div>
                          <p className="theme-text text-xl font-black">
                            {playerName(current.rankings[0])}
                          </p>

                          <p className="theme-secondary-text mt-1 text-xs">
                            {current.rankings[0].matches} matches ·{' '}
                            {current.rankings[0].wins} wins
                          </p>
                        </div>

                        <p className="text-3xl font-black text-amber-400">
                          {current.rankings[0].rating}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="theme-muted mt-6 text-sm">
                      Rankings appear once players meet the minimum-match requirement.
                    </p>
                  )}
                </>
              ) : (
                <p className="theme-secondary-text mt-4 max-w-xl text-sm leading-6">
                  No Ballon season is live right now. A League Admin or Super Admin can create the next 1, 2, 3-month or custom season.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {current.season ? (
                  <Link
                    href={'/awards/ballon/' + current.season.id}
                    className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-[#171005]"
                  >
                    View Full Ballon Ranking
                  </Link>
                ) : null}

                <Link
                  href="/admin/awards"
                  className="theme-action-row rounded-xl border px-4 py-3 text-sm font-black"
                >
                  Awards Management
                </Link>
              </div>
            </div>
          </div>
        </FcPanel>

        <div className="grid grid-cols-2 gap-3">
          <FcStatCard
            label="Total Honours"
            value={awards.length + ballonWins + risingStarWins}
            detail="Verified awards"
            tone="amber"
          />

          <FcStatCard
            label="Individual"
            value={individualAwards}
            detail="Performance awards"
            tone="cyan"
          />

          <FcStatCard
            label="Championships"
            value={counts.TOURNAMENT_CHAMPION ?? 0}
            detail="Tournament titles"
            tone="emerald"
          />

          <FcStatCard
            label="Ballon Wins"
            value={ballonWins}
            detail="Seasonal honours"
            tone="amber"
          />
        </div>
      </section>

      <section>
        <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
          Award Categories
        </p>

        <h2 className="theme-text mt-1 text-2xl font-black">
          Official FC Arena Honours
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            ['🟡', 'FC Arena Ballon', 'Seasonal overall player', ballonWins],
            ['⚽', 'Golden Boot', 'Top scorer', counts.GOLDEN_BOOT ?? 0],
            ['🧤', 'Golden Glove', 'Best defensive record', counts.GOLDEN_GLOVE ?? 0],
            ['⭐', 'Player of the Tournament', 'Best overall tournament player', counts.BEST_PLAYER ?? 0],
            ['🚀', 'Rising Star', 'Best eligible newcomer', risingStarWins],
            ['🏆', 'Champion', 'Tournament winner', counts.TOURNAMENT_CHAMPION ?? 0],
            ['🥈', 'Runner-Up', 'Second place', counts.TOURNAMENT_RUNNER_UP ?? 0],
            ['🔥', 'Winning Streak', '3+ consecutive wins', counts.WINNING_STREAK ?? 0],
            ['🎖', 'Participation', 'Tournament history badge', counts.TOURNAMENT_PARTICIPATION ?? 0],
          ].map(([icon, name, description, count]) => (
            <FcPanel key={String(name)} className="p-5">
              <div className="theme-tone-premium grid h-12 w-12 place-items-center rounded-xl border text-2xl">
                {icon}
              </div>

              <h3 className="theme-text mt-4 font-black">
                {name}
              </h3>

              <p className="theme-muted mt-1 text-xs leading-5">
                {description}
              </p>

              <p className="mt-4 text-sm font-black text-amber-400">
                × {count}
              </p>
            </FcPanel>
          ))}
        </div>
      </section>

      {current.season && current.rankings.length > 0 ? (
        <FcPanel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
            <div>
              <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
                Live Ballon Race
              </p>

              <h2 className="theme-text mt-1 text-xl font-black">
                Top Players
              </h2>
            </div>

            {current.myRank ? (
              <span className="theme-elevated rounded-full border px-3 py-1.5 text-xs font-black">
                My Rank #{current.myRank.rank}
              </span>
            ) : null}
          </div>

          <div className="divide-y divide-white/[0.06]">
            {current.rankings.slice(0, 10).map((player) => {
              const movement = player.movement ?? 0;

              return (
                <div
                  key={player.userId}
                  className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 p-4"
                >
                  <span className="theme-elevated grid h-9 w-9 place-items-center rounded-xl border text-xs font-black">
                    #{player.rank}
                  </span>

                  <div className="min-w-0">
                    <p className="theme-text truncate font-black">
                      {playerName(player)}
                    </p>

                    <p className="theme-muted mt-0.5 text-xs">
                      {player.matches} matches · {player.goalsFor} GF ·{' '}
                      {player.cleanSheets} CS
                    </p>
                  </div>

                  <span
                    className={
                      movement > 0
                        ? 'text-xs font-black text-emerald-400'
                        : movement < 0
                          ? 'text-xs font-black text-red-400'
                          : 'theme-muted text-xs font-black'
                    }
                  >
                    {movement > 0
                      ? '↑' + movement
                      : movement < 0
                        ? '↓' + Math.abs(movement)
                        : '—'}
                  </span>

                  <span className="min-w-[54px] text-right text-lg font-black text-amber-400">
                    {player.rating}
                  </span>
                </div>
              );
            })}
          </div>
        </FcPanel>
      ) : null}

      {archivedSeasons.length > 0 ? (
        <section>
          <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
            Ballon History
          </p>

          <h2 className="theme-text mt-1 text-2xl font-black">
            Previous Winners
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archivedSeasons.slice(0, 6).map((season) => (
              <FcPanel key={season.id} className="p-5">
                <div className="flex items-center gap-3">
                  <img
                    src="/awards/fc-arena-ballon-mark.svg"
                    alt=""
                    className="h-14 w-14 rounded-xl"
                  />

                  <div className="min-w-0">
                    <p className="theme-muted text-[10px] font-black uppercase tracking-[0.14em]">
                      {season.name}
                    </p>

                    <p className="theme-text mt-1 truncate text-lg font-black">
                      {playerName(season.winner)}
                    </p>

                    <p className="text-sm font-black text-amber-400">
                      {season.winnerRating ?? '—'} rating
                    </p>
                  </div>
                </div>
              </FcPanel>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
          Trophy Cabinet
        </p>

        <h2 className="theme-text mt-1 text-2xl font-black">
          Your Verified Honours
        </h2>

        {loading ? (
          <FcPanel className="mt-4 p-8 text-center">
            <p className="theme-secondary-text text-sm">
              Loading honours...
            </p>
          </FcPanel>
        ) : awards.length === 0 && ballonWins === 0 && risingStarWins === 0 ? (
          <div className="mt-4">
            <FcEmptyState
              title="No awards yet"
              description="Complete verified FC Arena competitions to build your trophy cabinet."
              actionLabel="Open Tournaments"
              actionHref="/tournaments"
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {awards.map((award) => (
              <Link
                key={award.id}
                href={'/tournaments/' + award.tournament.id + '/achievements'}
                className="group"
              >
                <FcPanel className="theme-action-row h-full p-5 transition group-hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="theme-tone-premium grid h-12 w-12 place-items-center rounded-xl border text-xl">
                      {iconFor(award.type)}
                    </span>

                    <span className="theme-muted text-xs">
                      {new Date(award.awardedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="theme-text-link mt-4 text-[10px] font-semibold uppercase tracking-[0.15em]">
                    {labelFor(award.type)}
                  </p>

                  <h3 className="theme-text mt-2 text-lg font-semibold">
                    {award.title}
                  </h3>

                  <p className="theme-secondary-text mt-1 text-sm font-medium">
                    {award.tournament.name}
                  </p>

                  {award.description ? (
                    <p className="theme-muted mt-3 text-sm leading-6">
                      {award.description}
                    </p>
                  ) : null}
                </FcPanel>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SecondaryFeaturePage>
  );
}
