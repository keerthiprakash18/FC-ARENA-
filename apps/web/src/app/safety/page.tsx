'use client';

import Link from 'next/link';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface SafetyUser {
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
}

interface BlockedUser
  extends SafetyUser {
  blockedAt: string;
}

interface SafetyReport {
  id: string;
  target: SafetyUser;
  reason: string;
  contentType: string;
  details: string | null;
  contentReference: string | null;
  status:
    | 'OPEN'
    | 'RESOLVED';
  createdAt: string;
  resolution: {
    note: string | null;
    resolvedAt: string;
  } | null;
}

const reasonOptions = [
  [
    'HARASSMENT_OR_BULLYING',
    'Harassment or bullying',
  ],
  [
    'HATE_OR_ABUSE',
    'Hate or abusive content',
  ],
  [
    'SEXUAL_CONTENT_OR_NUDITY',
    'Sexual content or nudity',
  ],
  [
    'GRAPHIC_VIOLENCE',
    'Graphic violence',
  ],
  [
    'SPAM_OR_SCAM',
    'Spam or scam',
  ],
  [
    'IMPERSONATION',
    'Impersonation',
  ],
  [
    'INAPPROPRIATE_PROFILE',
    'Inappropriate profile',
  ],
  [
    'OTHER',
    'Other',
  ],
] as const;

const contentTypeOptions = [
  [
    'USER_PROFILE',
    'Player profile / name',
  ],
  [
    'PROFILE_PHOTO',
    'Profile photo',
  ],
  [
    'LEAGUE',
    'League content',
  ],
  [
    'TOURNAMENT',
    'Tournament content',
  ],
  [
    'TEAM',
    'Team content',
  ],
  [
    'OTHER',
    'Other content',
  ],
] as const;

export default function SafetyPage() {
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
    blockedUsers,
    setBlockedUsers,
  ] =
    useState<BlockedUser[]>(
      [],
    );

  const [
    reports,
    setReports,
  ] =
    useState<SafetyReport[]>(
      [],
    );

  const [
    reportTarget,
    setReportTarget,
  ] =
    useState('');

  const [
    reportReason,
    setReportReason,
  ] =
    useState(
      'INAPPROPRIATE_PROFILE',
    );

  const [
    contentType,
    setContentType,
  ] =
    useState(
      'USER_PROFILE',
    );

  const [
    details,
    setDetails,
  ] =
    useState('');

  const [
    blockTarget,
    setBlockTarget,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  async function loadSafetyData() {
    const [
      blocksResponse,
      reportsResponse,
    ] =
      await Promise.all([
        authenticatedRequest<{
          success: true;
          data: {
            blockedUsers:
              BlockedUser[];
          };
          error: null;
        }>('/safety/blocks'),

        authenticatedRequest<{
          success: true;
          data: {
            reports:
              SafetyReport[];
          };
          error: null;
        }>(
          '/safety/reports/mine',
        ),
      ]);

    setBlockedUsers(
      blocksResponse
        .data
        .blockedUsers,
    );

    setReports(
      reportsResponse
        .data
        .reports,
    );
  }

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        await loadSafetyData();
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);

  async function submitReport(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message: string;
          };
          error: null;
        }>(
          '/safety/reports',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                targetInGameName:
                  reportTarget,

                reason:
                  reportReason,

                contentType,

                details:
                  details.trim() ||
                  undefined,
              }),
          },
        );

      setMessage(
        response.data
          .message,
      );

      setReportTarget(
        '',
      );

      setDetails(
        '',
      );

      await loadSafetyData();
    } catch (
      reportError
    ) {
      setError(
        reportError instanceof
          Error
          ? reportError.message
          : 'Unable to submit the report.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitBlock(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message: string;
          };
          error: null;
        }>(
          '/safety/blocks',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                targetInGameName:
                  blockTarget,
              }),
          },
        );

      setMessage(
        response.data
          .message,
      );

      setBlockTarget(
        '',
      );

      await loadSafetyData();
    } catch (
      blockError
    ) {
      setError(
        blockError instanceof
          Error
          ? blockError.message
          : 'Unable to block this player.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function unblock(
    targetUserId: string,
  ) {
    if (
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message: string;
          };
          error: null;
        }>(
          '/safety/blocks/' +
            targetUserId,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data
          .message,
      );

      await loadSafetyData();
    } catch (
      unblockError
    ) {
      setError(
        unblockError instanceof
          Error
          ? unblockError.message
          : 'Unable to unblock this player.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Safety Center..."
      />
    );
  }

  const playerName =
    user.player
      ?.identity
      ?.inGameName ||
    user.fullName;

  return (
    <AppShell
      playerName={
        playerName
      }
      playerRole={
        user.role ===
        'SUPER_ADMIN'
          ? 'Super Admin'
          : 'Player'
      }
    >
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="Community Safety"
          title="Safety & Reporting"
          subtitle="Report inappropriate player content, block players and review your safety actions."
          action={
            <FcStatusBadge
              label="Safety Controls"
              tone="emerald"
            />
          }
        />

        {message ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-700">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-600">
            {
              error
            }
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="Report"
              title="Report a player or content"
            />

            <p className="theme-secondary-text mt-3 text-sm leading-6">
              Use the player&apos;s exact In-Game Name. Reports are stored for FC ARENA moderation. Do not include passwords or OTP codes.
            </p>

            <form
              className="mt-5 space-y-4"
              onSubmit={
                submitReport
              }
            >
              <label className="block">
                <span className="theme-muted text-xs font-semibold">
                  Player In-Game Name
                </span>

                <input
                  required
                  maxLength={
                    80
                  }
                  value={
                    reportTarget
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setReportTarget(
                        event.target
                          .value,
                      )
                  }
                  placeholder="Example: PLAY_REVIEWER"
                  className="theme-input mt-2 min-h-11 w-full rounded-xl border px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="theme-muted text-xs font-semibold">
                  Reason
                </span>

                <select
                  value={
                    reportReason
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setReportReason(
                        event.target
                          .value,
                      )
                  }
                  className="theme-input mt-2 min-h-11 w-full rounded-xl border px-3 text-sm"
                >
                  {reasonOptions.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option[0]
                        }
                        value={
                          option[0]
                        }
                      >
                        {
                          option[1]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span className="theme-muted text-xs font-semibold">
                  Content type
                </span>

                <select
                  value={
                    contentType
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setContentType(
                        event.target
                          .value,
                      )
                  }
                  className="theme-input mt-2 min-h-11 w-full rounded-xl border px-3 text-sm"
                >
                  {contentTypeOptions.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option[0]
                        }
                        value={
                          option[0]
                        }
                      >
                        {
                          option[1]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block">
                <span className="theme-muted text-xs font-semibold">
                  Details
                </span>

                <textarea
                  minLength={
                    5
                  }
                  maxLength={
                    1000
                  }
                  value={
                    details
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setDetails(
                        event.target
                          .value,
                      )
                  }
                  placeholder="Explain what happened and where you saw the content."
                  rows={
                    5
                  }
                  className="theme-input mt-2 w-full rounded-xl border p-3 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={
                  busy
                }
                className="theme-primary-button min-h-11 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
              >
                {busy
                  ? 'Submitting...'
                  : 'Submit Report'}
              </button>
            </form>
          </FcPanel>

          <FcPanel className="p-5 sm:p-6">
            <FcSectionHeading
              eyebrow="Block"
              title="Block a player"
            />

            <p className="theme-secondary-text mt-3 text-sm leading-6">
              Blocking restricts new League-owner membership interactions between you and that player. Official fixtures, results and competition records are not deleted.
            </p>

            <form
              className="mt-5 space-y-4"
              onSubmit={
                submitBlock
              }
            >
              <label className="block">
                <span className="theme-muted text-xs font-semibold">
                  Player In-Game Name
                </span>

                <input
                  required
                  maxLength={
                    80
                  }
                  value={
                    blockTarget
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setBlockTarget(
                        event.target
                          .value,
                      )
                  }
                  placeholder="Player to block"
                  className="theme-input mt-2 min-h-11 w-full rounded-xl border px-3 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={
                  busy
                }
                className="theme-danger-button min-h-11 w-full rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
              >
                {busy
                  ? 'Updating...'
                  : 'Block Player'}
              </button>
            </form>

            <div className="mt-6 border-t border-black/10 pt-5">
              <h3 className="theme-text font-semibold">
                Blocked players
              </h3>

              {blockedUsers.length ===
              0 ? (
                <p className="theme-secondary-text mt-3 text-sm">
                  You have not blocked any players.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {blockedUsers.map(
                    (
                      blocked,
                    ) => (
                      <div
                        key={
                          blocked.userId
                        }
                        className="theme-action-row flex items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <p className="theme-text truncate text-sm font-semibold">
                            {blocked.inGameName ||
                              blocked.fullName}
                          </p>

                          <p className="theme-muted mt-1 font-mono text-[10px]">
                            {blocked.playerCode ||
                              'FC ARENA Player'}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void unblock(
                              blocked.userId,
                            )
                          }
                          className="theme-secondary-button min-h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          Unblock
                        </button>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </FcPanel>
        </section>

        <FcPanel className="p-5 sm:p-6">
          <FcSectionHeading
            eyebrow="History"
            title="My reports"
          />

          {reports.length ===
          0 ? (
            <p className="theme-secondary-text mt-4 text-sm">
              No safety reports submitted yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {reports.map(
                (
                  report,
                ) => (
                  <div
                    key={
                      report.id
                    }
                    className="theme-action-row rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="theme-text font-semibold">
                          {report.target
                            .inGameName ||
                            report.target
                              .fullName}
                        </p>

                        <p className="theme-muted mt-1 text-xs">
                          {report.contentType
                            .replaceAll(
                              '_',
                              ' ',
                            )}{' '}
                          ·{' '}
                          {report.reason
                            .replaceAll(
                              '_',
                              ' ',
                            )}
                        </p>
                      </div>

                      <FcStatusBadge
                        label={
                          report.status
                        }
                        tone={
                          report.status ===
                          'RESOLVED'
                            ? 'emerald'
                            : 'amber'
                        }
                      />
                    </div>

                    {report.details ? (
                      <p className="theme-secondary-text mt-3 text-sm leading-6">
                        {
                          report.details
                        }
                      </p>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )}
        </FcPanel>

        {user.role ===
        'SUPER_ADMIN' ? (
          <FcPanel className="p-5 sm:p-6">
            <p className="theme-text font-semibold">
              Super Admin moderation
            </p>

            <p className="theme-secondary-text mt-2 text-sm">
              Review and resolve community safety reports from the moderation queue.
            </p>

            <Link
              href="/admin/safety-reports"
              className="theme-primary-button mt-4 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Open Moderation Queue
            </Link>
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
