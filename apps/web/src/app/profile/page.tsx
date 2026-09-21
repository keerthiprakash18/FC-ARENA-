'use client';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface CareerData {
  profile: {
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

    primaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
      };
    } | null;

    secondaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
      };
    } | null;
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

  achievements: Array<{
    id: string;
    title: string;
    type: string;
    awardedAt: string;
  }>;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div className="border-b border-black/5 py-3 last:border-0">
      <p className="theme-muted text-[10px] font-semibold uppercase tracking-[0.15em]">
        {
          label
        }
      </p>

      <p className="theme-text mt-1 break-all text-sm font-medium">
        {
          value ||
          'Not provided'
        }
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const router =
    useRouter();

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

  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              '/players/me/career',
            ),
          ]);

        setUser(
          current,
        );

        setCareer(
          response.data,
        );
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);

  if (
    !user ||
    !career
  ) {
    return (
      <FcLoadingScreen
        label="Loading Player Profile..."
      />
    );
  }

  const identity =
    career.profile
      .identity;

  const playerName =
    identity?.inGameName ||
    career.profile
      .fullName;

  const stats =
    career.lifetimeStatistics;

  return (
    <AppShell
      playerName={
        playerName
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <FcPanel className="overflow-hidden">
          <div className="fc-profile-banner h-28 md:h-36" />

          <div className="px-5 pb-6 sm:px-7">
            <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <FcCrest
                  name={
                    playerName
                  }
                  imageUrl={
                    career.profile
                      .profileImageUrl
                  }
                  size="lg"
                />

                <div className="pb-1">
                  <p className="theme-text-link text-xs font-semibold uppercase tracking-[0.16em]">
                    FC ARENA Player
                  </p>

                  <h1 className="theme-text mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                    {
                      career.profile
                        .fullName
                    }
                  </h1>

                  <p className="theme-secondary-text mt-1 text-sm">
                    {
                      playerName
                    }
                    {career.profile
                      .playerCode
                      ? ' · ' +
                        career.profile
                          .playerCode
                      : ''}
                  </p>
                </div>
              </div>

              <FcStatusBadge
                label={
                  identity?.isVerified
                    ? 'Verified Player'
                    : 'Active Player'
                }
                tone={
                  identity?.isVerified
                    ? 'emerald'
                    : 'cyan'
                }
              />
            </div>
          </div>
        </FcPanel>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Matches"
            value={
              stats.matches
            }
            detail={
              stats.wins +
              ' wins · ' +
              stats.draws +
              ' draws'
            }
          />

          <FcStatCard
            label="Win Rate"
            value={
              stats.winRate +
              '%'
            }
            detail={
              stats.losses +
              ' losses'
            }
            tone="emerald"
          />

          <FcStatCard
            label="Goals"
            value={
              stats.goalsFor
            }
            detail={
              'GA ' +
              stats.goalsAgainst +
              ' · GD ' +
              (
                stats.goalDifference >
                0
                  ? '+'
                  : ''
              ) +
              stats.goalDifference
            }
            tone="amber"
          />

          <FcStatCard
            label="Achievements"
            value={
              stats.achievements
            }
            detail={
              stats.tournaments +
              ' tournaments'
            }
            tone="slate"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">
              Player Identity
            </h2>

            <div className="mt-3">
              <Detail
                label="FC ARENA ID"
                value={
                  career.profile
                    .playerCode
                }
              />

              <Detail
                label="In-Game Name"
                value={
                  identity?.inGameName
                }
              />

              <Detail
                label="Game UID"
                value={
                  identity?.gameUid
                }
              />

              <Detail
                label="Verification"
                value={
                  identity?.isVerified
                    ? 'Verified & locked'
                    : 'Not yet verified'
                }
              />
            </div>
          </FcPanel>

          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">
              Career Context
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href={
                  career.profile
                    .primaryLeague
                    ? '/leagues/' +
                      career.profile
                        .primaryLeague
                        .league.id
                    : '/leagues'
                }
                className="theme-action-row rounded-2xl border p-4"
              >
                <p className="theme-muted text-xs">
                  Primary League
                </p>

                <p className="theme-text mt-1 font-semibold">
                  {career.profile
                    .primaryLeague
                    ?.league.name ||
                    'Not joined'}
                </p>
              </Link>

              <Link
                href={
                  career.profile
                    .secondaryLeague
                    ? '/leagues/' +
                      career.profile
                        .secondaryLeague
                        .league.id
                    : '/leagues'
                }
                className="theme-action-row rounded-2xl border p-4"
              >
                <p className="theme-muted text-xs">
                  Secondary League
                </p>

                <p className="theme-text mt-1 font-semibold">
                  {career.profile
                    .secondaryLeague
                    ?.league.name ||
                    'Not joined'}
                </p>
              </Link>
            </div>

            <div className="mt-5">
              <p className="theme-muted text-xs font-medium">
                Recent Form
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {stats.form.length >
                0 ? (
                  stats.form.map(
                    (
                      result,
                      index,
                    ) => (
                      <span
                        key={
                          result +
                          index
                        }
                        className={
                          'grid h-9 w-9 place-items-center rounded-xl border text-sm font-bold ' +
                          (
                            result ===
                            'W'
                              ? 'theme-tone-success'
                              : result ===
                                  'D'
                                ? 'theme-tone-premium'
                                : 'theme-tone-danger'
                          )
                        }
                      >
                        {
                          result
                        }
                      </span>
                    ),
                  )
                ) : (
                  <span className="theme-secondary-text text-sm">
                    No completed matches yet.
                  </span>
                )}
              </div>
            </div>
          </FcPanel>
        </section>

        <FcPanel className="p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="theme-muted text-xs">
                Account
              </p>

              <h2 className="theme-text mt-1 text-lg font-semibold">
                Contact & membership
              </h2>
            </div>

            <Link
              href="/settings"
              className="theme-text-link text-sm font-semibold"
            >
              Settings →
            </Link>
          </div>

          <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
            <div>
              <Detail
                label="Full Name"
                value={
                  career.profile
                    .fullName
                }
              />

              <Detail
                label="Email"
                value={
                  career.profile
                    .email
                }
              />
            </div>

            <div>
              <Detail
                label="Phone"
                value={
                  career.profile
                    .phoneNumber
                }
              />

              <Detail
                label="Member Since"
                value={
                  new Date(
                    career.profile
                      .joinedAt,
                  ).toLocaleDateString()
                }
              />
            </div>
          </div>
        </FcPanel>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              'Career Stats',
              '/career',
            ],
            [
              'Match History',
              '/career/matches',
            ],
            [
              'Achievements',
              '/career/achievements',
            ],
            [
              'Leaderboards',
              '/leaderboards',
            ],
          ].map(
            (
              [
                title,
                href,
              ],
            ) => (
              <Link
                key={
                  href
                }
                href={
                  href
                }
                className="theme-action-row rounded-2xl border p-4"
              >
                <p className="theme-text font-semibold">
                  {
                    title
                  }
                </p>

                <p className="theme-muted mt-2 text-xs">
                  Open →
                </p>
              </Link>
            ),
          )}
        </section>
      </div>
    </AppShell>
  );
}
