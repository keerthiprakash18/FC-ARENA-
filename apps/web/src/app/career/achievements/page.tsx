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
  BackHeader,
} from '@/components/app/back-header';
import {
  CareerNavigation,
} from '@/components/career/career-navigation';
import {
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

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
  };
}

interface SeasonalAward {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  seasonId: string;
}

interface CareerData {
  profile: {
    fullName: string;
    identity: {
      inGameName: string;
    } | null;
  };

  achievements:
    Achievement[];
}

interface AwardsOverview {
  trophyCabinet:
    Record<string, number>;
  mySeasonalAwards:
    SeasonalAward[];
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
    case 'GOLDEN_GLOVE':
      return '🧤';
    case 'BEST_PLAYER':
      return '⭐';
    case 'WINNING_STREAK':
      return '🔥';
    case 'FC_ARENA_BALLON':
      return '👑';
    case 'RISING_STAR':
      return '🚀';
    default:
      return '🎖';
  }
}

function publicName(
  type: string,
) {
  if (
    type ===
    'BEST_PLAYER'
  ) {
    return 'Player of the Tournament';
  }

  if (
    type ===
    'FC_ARENA_BALLON'
  ) {
    return 'FC Arena Ballon';
  }

  return type
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}

export default function CareerAchievementsPage() {
  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    career,
    setCareer,
  ] =
    useState<CareerData | null>(
      null,
    );

  const [
    awards,
    setAwards,
  ] =
    useState<AwardsOverview | null>(
      null,
    );

  useEffect(() => {
    void (async () => {
      const [
        current,
        response,
        awardsResponse,
      ] =
        await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{
            success: true;
            data: CareerData;
            error: null;
          }>(
            '/players/me/career',
          ),
          authenticatedRequest<{
            success: true;
            data: AwardsOverview;
            error: null;
          }>(
            '/awards/overview',
          ),
        ]);

      setUser(
        current,
      );

      setCareer(
        response.data,
      );

      setAwards(
        awardsResponse.data,
      );
    })();
  }, []);

  if (
    !user ||
    !career ||
    !awards
  ) {
    return (
      <FcLoadingScreen
        label="Loading Achievements..."
      />
    );
  }

  const playerName =
    career.profile.identity
      ?.inGameName ||
    career.profile.fullName;

  const cabinet = [
    [
      'FC_ARENA_BALLON',
      'FC Arena Ballon',
      '👑',
    ],
    [
      'TOURNAMENT_CHAMPION',
      'Championships',
      '🏆',
    ],
    [
      'GOLDEN_BOOT',
      'Golden Boot',
      '⚽',
    ],
    [
      'GOLDEN_GLOVE',
      'Golden Glove',
      '🧤',
    ],
    [
      'PLAYER_OF_TOURNAMENT',
      'Player of Tournament',
      '⭐',
    ],
    [
      'RISING_STAR',
      'Rising Star',
      '🚀',
    ],
    [
      'WINNING_STREAK',
      'Winning Streak',
      '🔥',
    ],
    [
      'TOURNAMENT_PARTICIPATION',
      'Participation',
      '🎖',
    ],
  ] as const;

  const noAwards =
    career.achievements
      .length ===
      0 &&
    awards.mySeasonalAwards
      .length ===
      0;

  return (
    <AppShell
      playerName={
        playerName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref="/career"
          backLabel="Career Stats"
          eyebrow="Player Career"
          title="Trophy Cabinet"
          subtitle="Tournament honours, FC Arena Ballon awards and verified milestones."
        />

        <CareerNavigation />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cabinet.map(
            (
              [
                type,
                label,
                icon,
              ],
            ) => (
              <FcPanel
                key={
                  type
                }
                className="p-4"
              >
                <p className="text-2xl">
                  {
                    icon
                  }
                </p>

                <p className="mt-3 text-sm font-black">
                  {
                    label
                  }
                </p>

                <p className="mt-2 text-2xl font-black text-amber-300">
                  {
                    awards
                      .trophyCabinet[
                      type
                    ] ??
                    0
                  }
                </p>
              </FcPanel>
            ),
          )}
        </section>

        {noAwards ? (
          <FcEmptyState
            title="No achievements yet"
            description="Tournament awards, Ballon honours and milestones will appear here after they are generated."
            actionLabel="Open Tournaments"
            actionHref="/tournaments"
          />
        ) : (
          <>
            {awards
              .mySeasonalAwards
              .length >
            0 ? (
              <section>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  Seasonal Honours
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {awards.mySeasonalAwards.map(
                    (
                      award,
                    ) => (
                      <Link
                        key={
                          award.id
                        }
                        href={
                          `/awards/ballon/${award.seasonId}`
                        }
                        className="group"
                      >
                        <FcPanel className="h-full border-amber-400/15 p-5 transition group-hover:border-amber-400/30">
                          <p className="text-3xl">
                            {achievementIcon(
                              award.type,
                            )}
                          </p>

                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                            {publicName(
                              award.type,
                            )}
                          </p>

                          <h2 className="mt-2 text-lg font-black">
                            {
                              award.title
                            }
                          </h2>

                          {award.description ? (
                            <p className="mt-3 text-sm leading-6 text-slate-500">
                              {
                                award.description
                              }
                            </p>
                          ) : null}

                          <p className="mt-4 text-xs text-slate-600">
                            {new Date(
                              award.awardedAt,
                            ).toLocaleDateString()}
                          </p>
                        </FcPanel>
                      </Link>
                    ),
                  )}
                </div>
              </section>
            ) : null}

            {career.achievements
              .length >
            0 ? (
              <section>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Tournament Honours
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {career.achievements.map(
                    (
                      achievement,
                    ) => (
                      <Link
                        key={
                          achievement.id
                        }
                        href={
                          `/tournaments/${achievement.tournament.id}/achievements`
                        }
                        className="group"
                      >
                        <FcPanel className="h-full border-amber-400/15 p-5 transition group-hover:border-amber-400/30">
                          <p className="text-3xl">
                            {achievementIcon(
                              achievement.type,
                            )}
                          </p>

                          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {publicName(
                              achievement.type,
                            )}
                          </p>

                          <h2 className="mt-2 text-lg font-black">
                            {
                              achievement.title
                            }
                          </h2>

                          <p className="mt-2 text-sm font-black text-sky-300">
                            {
                              achievement
                                .tournament
                                .name
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
                        </FcPanel>
                      </Link>
                    ),
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}

        <Link
          href="/awards"
          className="inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#151006]"
        >
          Open Hall of Honours →
        </Link>
      </div>
    </AppShell>
  );
}
