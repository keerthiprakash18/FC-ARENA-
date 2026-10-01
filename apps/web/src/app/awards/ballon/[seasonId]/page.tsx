'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcLoadingScreen, FcPanel, FcStatCard } from '@/components/fc/fc-ui';
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface Breakdown {
  matchPerformance: number;
  attack: number;
  defence: number;
  goalDifference: number;
  bigMatches: number;
  consistency: number;
  total: number;
}

interface PlayerRow {
  userId: string;
  displayName: string;
  fullName: string;
  playerCode: string | null;
  profileImageUrl: string | null;
  rank: number;
  movement: number;
  rating: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  goalDifference: number;
  winRate: number;
  goalsPerMatch: number;
  goalsAgainstPerMatch: number;
  cleanSheetRate: number;
  ratingBreakdown: Breakdown;
}

interface SeasonData {
  season: {
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    minMatches: number;
    rankingSize: number;
    status: string;
    league: {
      id: string;
      name: string;
    } | null;
    winnerRating: number | null;
  };
  rankings: PlayerRow[];
  myRank: PlayerRow | null;
  risingStarRankings: PlayerRow[];
}

function metricWidth(value: number, max: number) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export default function BallonSeasonPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [data, setData] = useState<SeasonData | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [currentUser, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<any>(
            '/ballon/seasons/' + seasonId + '/rankings',
          ),
        ]);

        setUser(currentUser);
        setData(response.data);

        const firstId =
          response.data.myRank?.userId ??
          response.data.rankings?.[0]?.userId ??
          '';

        setSelectedId(firstId);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load FC Arena Ballon rankings.',
        );
      }
    })();
  }, [seasonId]);

  const selected = useMemo(
    () =>
      data?.rankings.find(
        (player) => player.userId === selectedId,
      ) ??
      data?.rankings[0] ??
      null,
    [data, selectedId],
  );

  if (!user || !data) {
    return (
      <FcLoadingScreen
        label={error || 'Loading FC Arena Ballon...'}
      />
    );
  }

  const breakdown = selected?.ratingBreakdown;

  return (
    <AppShell
      playerName={user.player?.identity?.inGameName}
    >
      <div className="space-y-6">
        <BackHeader
          backHref="/awards"
          backLabel="Awards"
          eyebrow="FC Arena Ballon"
          title={data.season.name}
          subtitle={
            new Date(data.season.startAt).toLocaleDateString() +
            ' — ' +
            new Date(data.season.endAt).toLocaleDateString() +
            ' · Minimum ' +
            data.season.minMatches +
            ' verified matches'
          }
        />

        <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <FcPanel className="relative overflow-hidden p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(245,196,81,0.20),transparent_45%)]" />
            <div className="relative">
              <img
                src="/awards/fc-arena-ballon.svg"
                alt="FC Arena Ballon"
                className="mx-auto w-full max-w-[460px]"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <FcStatCard
                  label="Status"
                  value={data.season.status}
                  tone="amber"
                />

                <FcStatCard
                  label="Top Players"
                  value={data.rankings.length}
                  tone="cyan"
                />
              </div>

              {data.myRank ? (
                <div className="theme-elevated mt-4 rounded-2xl border p-4">
                  <p className="theme-muted text-[10px] font-black uppercase tracking-[0.16em]">
                    Your Position
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="theme-text text-2xl font-black">
                      #{data.myRank.rank}
                    </p>
                    <p className="text-2xl font-black text-amber-400">
                      {data.myRank.rating}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </FcPanel>

          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
                Live Rankings
              </p>
              <h2 className="theme-text mt-1 text-xl font-black">
                Top {data.season.rankingSize}
              </h2>
            </div>

            <div className="max-h-[560px] overflow-y-auto divide-y divide-white/[0.06]">
              {data.rankings.map((player) => (
                <button
                  type="button"
                  key={player.userId}
                  onClick={() => setSelectedId(player.userId)}
                  className={
                    'grid w-full grid-cols-[48px_1fr_auto_auto] items-center gap-3 p-4 text-left transition ' +
                    (selected?.userId === player.userId
                      ? 'bg-amber-400/[0.06]'
                      : 'hover:bg-white/[0.025]')
                  }
                >
                  <span className="theme-elevated grid h-9 w-9 place-items-center rounded-xl border text-xs font-black">
                    #{player.rank}
                  </span>

                  <div className="min-w-0">
                    <p className="theme-text truncate font-black">
                      {player.displayName}
                    </p>
                    <p className="theme-muted mt-0.5 text-xs">
                      {player.matches} M · {player.wins} W · {player.goalsFor} GF · {player.cleanSheets} CS
                    </p>
                  </div>

                  <span
                    className={
                      player.movement > 0
                        ? 'text-xs font-black text-emerald-400'
                        : player.movement < 0
                          ? 'text-xs font-black text-red-400'
                          : 'theme-muted text-xs font-black'
                    }
                  >
                    {player.movement > 0
                      ? '↑' + player.movement
                      : player.movement < 0
                        ? '↓' + Math.abs(player.movement)
                        : '—'}
                  </span>

                  <span className="min-w-[55px] text-right text-lg font-black text-amber-400">
                    {player.rating}
                  </span>
                </button>
              ))}
            </div>
          </FcPanel>
        </section>

        {selected && breakdown ? (
          <section className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <FcPanel className="p-6">
              <p className="theme-muted text-[10px] font-black uppercase tracking-[0.16em]">
                Player Detail
              </p>

              <div className="mt-4 flex items-center gap-4">
                <div className="theme-elevated grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border text-lg font-black">
                  {selected.profileImageUrl ? (
                    <img
                      src={selected.profileImageUrl}
                      alt={selected.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    selected.displayName.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div>
                  <h2 className="theme-text text-2xl font-black">
                    {selected.displayName}
                  </h2>
                  <p className="theme-muted mt-1 font-mono text-xs">
                    {selected.playerCode ?? 'FC ARENA Player'}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ['Matches', selected.matches],
                  ['Wins', selected.wins],
                  ['Goals', selected.goalsFor],
                  ['GA', selected.goalsAgainst],
                  ['Clean Sheets', selected.cleanSheets],
                  ['GD', selected.goalDifference > 0 ? '+' + selected.goalDifference : selected.goalDifference],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="theme-elevated rounded-xl border p-3"
                  >
                    <p className="theme-muted text-[10px] uppercase">
                      {label}
                    </p>
                    <p className="theme-text mt-1 font-black">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </FcPanel>

            <FcPanel className="p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="theme-muted text-[10px] font-black uppercase tracking-[0.16em]">
                    Rating Breakdown
                  </p>
                  <h2 className="theme-text mt-1 text-2xl font-black">
                    Ballon Rating
                  </h2>
                </div>

                <p className="text-4xl font-black text-amber-400">
                  {selected.rating}
                  <span className="theme-muted text-base"> / 100</span>
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ['Match Performance', breakdown.matchPerformance, 30],
                  ['Attack', breakdown.attack, 20],
                  ['Defence', breakdown.defence, 15],
                  ['Goal Difference', breakdown.goalDifference, 15],
                  ['Big Matches + Titles', breakdown.bigMatches, 15],
                  ['Consistency', breakdown.consistency, 5],
                ].map(([label, value, max]) => (
                  <div key={String(label)}>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="theme-secondary-text text-sm font-semibold">
                        {label}
                      </p>
                      <p className="theme-text text-sm font-black">
                        {value} / {max}
                      </p>
                    </div>

                    <div className="theme-elevated h-2 overflow-hidden rounded-full border">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width:
                            metricWidth(
                              Number(value),
                              Number(max),
                            ) + '%',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </FcPanel>
          </section>
        ) : null}

        {data.risingStarRankings.length > 0 ? (
          <FcPanel className="p-6">
            <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
              Rising Star
            </p>
            <h2 className="theme-text mt-1 text-xl font-black">
              Emerging Player Race
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.risingStarRankings.slice(0, 6).map((player) => (
                <div
                  key={player.userId}
                  className="theme-elevated rounded-2xl border p-4"
                >
                  <p className="theme-muted text-xs">
                    #{player.rank}
                  </p>
                  <p className="theme-text mt-1 font-black">
                    {player.displayName}
                  </p>
                  <p className="mt-2 text-xl font-black text-amber-400">
                    {player.rating}
                  </p>
                </div>
              ))}
            </div>
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
