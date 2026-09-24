'use client';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useRef,
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
  authenticatedUpload,
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

  const imageInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    imageBusy,
    setImageBusy,
  ] =
    useState(false);

  const [
    imageProgress,
    setImageProgress,
  ] =
    useState(0);

  const [
    imageMessage,
    setImageMessage,
  ] =
    useState('');

  const [
    imageError,
    setImageError,
  ] =
    useState('');


  function applyProfileImage(
    profileImageUrl:
      string | null,
  ) {
    setCareer(
      (
        current,
      ) =>
        current
          ? {
              ...current,
              profile: {
                ...current.profile,
                profileImageUrl,
              },
            }
          : current,
    );

    setUser(
      (
        current,
      ) =>
        current
          ? {
              ...current,
              player:
                current.player
                  ? {
                      ...current.player,
                      profileImageUrl,
                    }
                  : current.player,
            }
          : current,
    );
  }


  async function uploadProfileImage(
    file: File,
  ) {
    setImageBusy(
      true,
    );

    setImageProgress(
      0,
    );

    setImageError(
      '',
    );

    setImageMessage(
      '',
    );

    const body =
      new FormData();

    body.append(
      'image',
      file,
    );

    try {
      const response =
        await authenticatedUpload<{
          success: true;
          data: {
            message: string;
            profileImageUrl:
              string;
          };
          error: null;
        }>(
          '/players/me/profile-image',
          body,
          (
            progress,
          ) =>
            setImageProgress(
              progress,
            ),
        );

      applyProfileImage(
        response.data
          .profileImageUrl,
      );

      setImageMessage(
        response.data.message,
      );

      setImageProgress(
        100,
      );
    } catch (
      err
    ) {
      setImageError(
        err instanceof Error
          ? err.message
          : 'Unable to upload profile photo.',
      );
    } finally {
      setImageBusy(
        false,
      );
    }
  }


  async function removeProfileImage() {
    if (
      imageBusy ||
      !career?.profile
        .profileImageUrl
    ) {
      return;
    }

    if (
      !window.confirm(
        'Remove your profile photo?',
      )
    ) {
      return;
    }

    setImageBusy(
      true,
    );

    setImageError(
      '',
    );

    setImageMessage(
      '',
    );

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message: string;
            profileImageUrl:
              null;
          };
          error: null;
        }>(
          '/players/me/profile-image',
          {
            method:
              'DELETE',
          },
        );

      applyProfileImage(
        null,
      );

      setImageMessage(
        response.data.message,
      );

      setImageProgress(
        0,
      );
    } catch (
      err
    ) {
      setImageError(
        err instanceof Error
          ? err.message
          : 'Unable to remove profile photo.',
      );
    } finally {
      setImageBusy(
        false,
      );
    }
  }


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
          <div className="fc-profile-banner h-20 sm:h-24" />

          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  <input
                    ref={
                      imageInputRef
                    }
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={
                      (
                        event,
                      ) => {
                        const file =
                          event.target
                            .files?.[0];

                        event.target.value =
                          '';

                        if (
                          file
                        ) {
                          void uploadProfileImage(
                            file,
                          );
                        }
                      }
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      imageBusy
                    }
                    onClick={() =>
                      imageInputRef
                        .current
                        ?.click()
                    }
                    className="group relative block h-24 w-24 overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03] shadow-sm disabled:opacity-60"
                    aria-label="Choose profile photo"
                  >
                    {career.profile
                      .profileImageUrl ? (
                      <img
                        src={
                          career.profile
                            .profileImageUrl
                        }
                        alt={
                          playerName +
                          ' profile'
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="theme-text grid h-full w-full place-items-center text-2xl font-bold">
                        {
                          playerName
                            .split(
                              /\s+/,
                            )
                            .map(
                              (
                                part,
                              ) =>
                                part[0],
                            )
                            .join('')
                            .slice(
                              0,
                              2,
                            )
                            .toUpperCase()
                        }
                      </span>
                    )}

                    <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1.5 text-center text-[10px] font-semibold text-white">
                      {imageBusy
                        ? imageProgress +
                          '%'
                        : 'Change photo'}
                    </span>
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="theme-text-link text-xs font-semibold uppercase tracking-[0.16em]">
                    FC ARENA Player
                  </p>

                  <h1 className="theme-text mt-1 break-words text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-3xl lg:text-4xl">
                    {
                      career.profile
                        .fullName
                    }
                  </h1>

                  <p className="theme-secondary-text mt-2 break-words text-sm">
                    In-Game Name:{' '}
                    <span className="theme-text font-semibold">
                      {
                        playerName
                      }
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {career.profile
                      .playerCode ? (
                      <span className="theme-soft-accent rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold">
                        {
                          career.profile
                            .playerCode
                        }
                      </span>
                    ) : null}

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

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        imageBusy
                      }
                      onClick={() =>
                        imageInputRef
                          .current
                          ?.click()
                      }
                      className="theme-secondary-button min-h-10 rounded-[10px] border px-3.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {
                        career.profile
                          .profileImageUrl
                          ? 'Change Photo'
                          : 'Upload Photo'
                      }
                    </button>

                    {career.profile
                      .profileImageUrl ? (
                      <button
                        type="button"
                        disabled={
                          imageBusy
                        }
                        onClick={() =>
                          void removeProfileImage()
                        }
                        className="theme-danger-button min-h-10 rounded-[10px] border px-3.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="shrink-0 lg:text-right">
                <p className="theme-muted text-xs">
                  Profile photo
                </p>

                <p className="theme-secondary-text mt-1 max-w-xs text-xs leading-5">
                  Choose a PNG, JPG or WEBP image from your device. It will be optimized automatically.
                </p>
              </div>
            </div>

            {imageMessage ? (
              <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3 text-sm text-emerald-700">
                {
                  imageMessage
                }
              </div>
            ) : null}

            {imageError ? (
              <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-600">
                {
                  imageError
                }
              </div>
            ) : null}
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
