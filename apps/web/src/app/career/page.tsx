'use client';

import Link from 'next/link';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

type Tab =
  | 'OVERVIEW'
  | 'MATCHES'
  | 'TOURNAMENTS'
  | 'LEAGUES'
  | 'ACHIEVEMENTS';

interface CareerData {
  profile: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    joinedAt: string;
    playerCode: string | null;
    profileImageUrl: string | null;

    identity: {
      inGameName: string;
      gameUid: string | null;
      isVerified: boolean;
      verifiedAt: string | null;
    } | null;

    primaryLeague: LeagueHistory | null;
    secondaryLeague: LeagueHistory | null;
  };

  lifetimeStatistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
    form: string[];
    tournaments: number;
    achievements: number;
  };

  matchHistory: MatchHistory[];

  tournamentHistory:
    TournamentHistory[];

  leagueHistory:
    LeagueHistory[];

  achievements:
    Achievement[];
}

interface LeagueHistory {
  id: string;
  type: string;
  joinedAt: string;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    region: string | null;
  };
}

interface MatchHistory {
  id: string;
  matchCode: string | null;
  outcome:
    | 'W'
    | 'D'
    | 'L';

  tournament: {
    id: string;
    name: string;
    mode: string;
    league: {
      id: string;
      name: string;
    };
  };

  fixture: {
    roundName: string;
    matchday: number | null;
    scheduledAt: string | null;
    venue: string | null;
  };

  home: {
    name: string;
    score: number;
  };

  away: {
    name: string;
    score: number;
  };

  source: string;

  confirmedAt: string;
}

interface TournamentHistory {
  tournament: {
    id: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    status: string;
    startAt: string | null;
    completedAt: string | null;

    league: {
      id: string;
      name: string;
      code: string;
    };
  };

  registration: {
    id: string;
    entryName: string | null;
    status: string;
    joinedAt: string;
  };

  statistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    form: string;
  };
}

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;

  tournament: {
    id: string;
    name: string;
    code: string;
    mode: string;
    format: string;
    completedAt: string | null;
  };
}

function outcomeClass(
  outcome: string,
) {
  if (
    outcome === 'W'
  ) {
    return 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20';
  }

  if (
    outcome === 'D'
  ) {
    return 'bg-amber-400/10 text-amber-300 border-amber-400/20';
  }

  return 'bg-red-400/10 text-red-300 border-red-400/20';
}

function achievementIcon(
  type: string,
) {
  switch (type) {
    case 'TOURNAMENT_CHAMPION':
      return '🏆';

    case 'TOURNAMENT_RUNNER_UP':
      return '🥈';

    case 'GOLDEN_BOOT':
      return '⚽';

    case 'BEST_PLAYER':
      return '⭐';

    case 'WINNING_STREAK':
      return '🔥';

    default:
      return '🎖';
  }
}

export default function CareerPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [career, setCareer] =
    useState<CareerData | null>(
      null,
    );

  const [tab, setTab] =
    useState<Tab>(
      'OVERVIEW',
    );

  const [error, setError] =
    useState('');

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        const response =
          await authenticatedRequest<{
            success: true;
            data: CareerData;
            error: null;
          }>(
            '/players/me/career',
          );

        setCareer(
          response.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load player career.',
        );
      }
    })();
  }, []);

  if (
    !user ||
    !career
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        {error ||
          'Loading Player Career...'}
      </div>
    );
  }

  const stats =
    career.lifetimeStatistics;

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-sky-400/15 bg-[#081019] p-7 md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-sky-400/10" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[28px] border border-sky-400/20 bg-sky-400/5 text-4xl font-black text-sky-300">
                {career.profile.profileImageUrl ? (
                  <img
                    src={
                      career.profile.profileImageUrl
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  career.profile.identity
                    ?.inGameName
                    ?.slice(0, 1)
                    .toUpperCase() ||
                  career.profile.fullName
                    .slice(0, 1)
                    .toUpperCase()
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                  FC ARENA Player
                </p>

                <h1 className="mt-2 text-3xl font-black md:text-5xl">
                  {career.profile.identity
                    ?.inGameName ||
                    career.profile
                      .fullName}
                </h1>

                <p className="mt-2 font-mono text-sm text-slate-500">
                  {career.profile
                    .playerCode ||
                    'FC ARENA ID pending'}
                </p>

                {career.profile.identity
                  ?.isVerified ? (
                  <span className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs font-black text-emerald-300">
                    ✓ Identity Verified
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {career.profile
                .primaryLeague ? (
                <Link
                  href={`/leagues/${career.profile.primaryLeague.league.id}`}
                  className="rounded-2xl border border-sky-400/20 bg-sky-400/5 px-4 py-3"
                >
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    Primary League
                  </p>

                  <p className="mt-1 text-sm font-black text-sky-300">
                    {
                      career.profile
                        .primaryLeague
                        .league.name
                    }
                  </p>
                </Link>
              ) : null}

              {career.profile
                .secondaryLeague ? (
                <Link
                  href={`/leagues/${career.profile.secondaryLeague.league.id}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    Secondary League
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {
                      career.profile
                        .secondaryLeague
                        .league.name
                    }
                  </p>
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            [
              'Matches',
              stats.matches,
            ],
            [
              'Wins',
              stats.wins,
            ],
            [
              'Draws',
              stats.draws,
            ],
            [
              'Losses',
              stats.losses,
            ],
            [
              'Goals For',
              stats.goalsFor,
            ],
            [
              'Goal Diff',
              `${
                stats.goalDifference >
                0
                  ? '+'
                  : ''
              }${stats.goalDifference}`,
            ],
            [
              'Win Rate',
              `${stats.winRate}%`,
            ],
            [
              'Trophies',
              stats.achievements,
            ],
          ].map(
            ([label, value]) => (
              <article
                key={String(
                  label,
                )}
                className="rounded-2xl border border-white/10 bg-[#0a1018] p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                  {label}
                </p>

                <p className="mt-2 text-2xl font-black">
                  {value}
                </p>
              </article>
            ),
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Recent Form
          </p>

          <div className="mt-4 flex gap-2">
            {stats.form.length >
            0 ? (
              stats.form.map(
                (
                  result,
                  index,
                ) => (
                  <span
                    key={`${result}-${index}`}
                    className={`grid h-10 w-10 place-items-center rounded-xl border font-black ${outcomeClass(
                      result,
                    )}`}
                  >
                    {result}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-slate-600">
                No completed matches yet.
              </span>
            )}
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            [
              'OVERVIEW',
              'Overview',
            ],
            [
              'MATCHES',
              'Match History',
            ],
            [
              'TOURNAMENTS',
              'Tournaments',
            ],
            [
              'LEAGUES',
              'Leagues',
            ],
            [
              'ACHIEVEMENTS',
              'Achievements',
            ],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setTab(
                    value as Tab,
                  )
                }
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black ${
                  tab === value
                    ? 'bg-sky-400 text-[#041019]'
                    : 'border border-white/10 text-slate-400'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {tab ===
        'OVERVIEW' ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Identity
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs text-slate-600">
                    Full Name
                  </p>

                  <p className="mt-1 font-black">
                    {
                      career.profile
                        .fullName
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    In-Game Name
                  </p>

                  <p className="mt-1 font-black">
                    {career.profile
                      .identity
                      ?.inGameName ||
                      '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    Game UID
                  </p>

                  <p className="mt-1 font-mono text-sm">
                    {career.profile
                      .identity
                      ?.gameUid ||
                      '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    FC ARENA ID
                  </p>

                  <p className="mt-1 font-mono font-black text-sky-400">
                    {career.profile
                      .playerCode ||
                      '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Career Summary
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Tournaments
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      stats.tournaments
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Awards
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      stats.achievements
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Goals Against
                  </p>

                  <p className="mt-2 text-2xl font-black">
                    {
                      stats.goalsAgainst
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Win Rate
                  </p>

                  <p className="mt-2 text-2xl font-black text-sky-400">
                    {
                      stats.winRate
                    }
                    %
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab ===
        'MATCHES' ? (
          <section className="space-y-3">
            {career.matchHistory.map(
              (match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="block rounded-[22px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/20"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-xl border font-black ${outcomeClass(
                            match.outcome,
                          )}`}
                        >
                          {
                            match.outcome
                          }
                        </span>

                        <div>
                          <p className="font-black">
                            {
                              match.tournament
                                .name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            {
                              match.fixture
                                .roundName
                            }
                            {' • '}
                            {
                              match.tournament
                                .league
                                .name
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-xl font-black">
                        {
                          match.home
                            .name
                        }{' '}
                        <span className="text-sky-400">
                          {
                            match.home
                              .score
                          }
                          -
                          {
                            match.away
                              .score
                          }
                        </span>{' '}
                        {
                          match.away
                            .name
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(
                          match.confirmedAt,
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ),
            )}

            {career.matchHistory
              .length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0a1018] p-10 text-center text-slate-500">
                No verified Match History yet.
              </div>
            ) : null}
          </section>
        ) : null}

        {tab ===
        'TOURNAMENTS' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {career.tournamentHistory.map(
              (entry) => (
                <Link
                  key={
                    entry.registration
                      .id
                  }
                  href={`/tournaments/${entry.tournament.id}`}
                  className="rounded-[22px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/20"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-black">
                        {
                          entry.tournament
                            .name
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {
                          entry.tournament
                            .league.name
                        }
                      </p>
                    </div>

                    <span className="h-fit rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400">
                      {
                        entry.tournament
                          .status
                      }
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                    {[
                      [
                        'MP',
                        entry.statistics
                          .matches,
                      ],
                      [
                        'W',
                        entry.statistics
                          .wins,
                      ],
                      [
                        'D',
                        entry.statistics
                          .draws,
                      ],
                      [
                        'L',
                        entry.statistics
                          .losses,
                      ],
                    ].map(
                      ([
                        label,
                        value,
                      ]) => (
                        <div
                          key={String(
                            label,
                          )}
                          className="rounded-xl bg-white/[0.03] p-3"
                        >
                          <p className="text-[10px] text-slate-600">
                            {label}
                          </p>

                          <p className="mt-1 font-black">
                            {value}
                          </p>
                        </div>
                      ),
                    )}
                  </div>

                  <p className="mt-4 text-xs font-black tracking-widest text-slate-500">
                    FORM:{' '}
                    {entry.statistics
                      .form ||
                      '—'}
                  </p>
                </Link>
              ),
            )}

            {career.tournamentHistory
              .length === 0 ? (
              <p className="text-slate-500">
                No Tournament History.
              </p>
            ) : null}
          </section>
        ) : null}

        {tab ===
        'LEAGUES' ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {career.leagueHistory.map(
              (membership) => (
                <Link
                  key={
                    membership.id
                  }
                  href={`/leagues/${membership.league.id}`}
                  className="rounded-[22px] border border-white/10 bg-[#0a1018] p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xl font-black">
                        {
                          membership
                            .league.name
                        }
                      </p>

                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {
                          membership
                            .league.code
                        }
                      </p>
                    </div>

                    <span className="rounded-full border border-sky-400/20 bg-sky-400/5 px-3 py-1 text-xs font-black text-sky-300">
                      {
                        membership.type
                      }
                    </span>
                  </div>

                  <p className="mt-5 text-xs text-slate-500">
                    Joined{' '}
                    {new Date(
                      membership.joinedAt,
                    ).toLocaleDateString()}
                  </p>
                </Link>
              ),
            )}
          </section>
        ) : null}

        {tab ===
        'ACHIEVEMENTS' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {career.achievements.map(
              (achievement) => (
                <Link
                  key={
                    achievement.id
                  }
                  href={`/tournaments/${achievement.tournament.id}/achievements`}
                  className="rounded-[22px] border border-amber-400/15 bg-[#0a1018] p-6"
                >
                  <p className="text-4xl">
                    {achievementIcon(
                      achievement.type,
                    )}
                  </p>

                  <h2 className="mt-4 text-lg font-black">
                    {
                      achievement.title
                    }
                  </h2>

                  <p className="mt-2 text-sm font-bold text-sky-400">
                    {
                      achievement
                        .tournament.name
                    }
                  </p>

                  {achievement.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {
                        achievement.description
                      }
                    </p>
                  ) : null}

                  <p className="mt-4 text-xs text-slate-600">
                    {new Date(
                      achievement.awardedAt,
                    ).toLocaleDateString()}
                  </p>
                </Link>
              ),
            )}

            {career.achievements
              .length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0a1018] p-10 text-center text-slate-500">
                No achievements yet.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}