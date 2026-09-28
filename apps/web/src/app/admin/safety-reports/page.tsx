'use client';

import {
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
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface AdminSafetyReport {
  id: string;

  reporter: {
    userId: string | null;
    fullName: string;
    inGameName: string | null;
    playerCode: string | null;
  };

  target: {
    userId: string;
    fullName: string;
    inGameName: string | null;
    playerCode: string | null;
  };

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

export default function AdminSafetyReportsPage() {
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
    reports,
    setReports,
  ] =
    useState<AdminSafetyReport[]>(
      [],
    );

  const [
    busyId,
    setBusyId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  async function loadReports() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          reports:
            AdminSafetyReport[];
        };

        error: null;
      }>(
        '/safety/admin/reports',
      );

    setReports(
      response.data
        .reports,
    );
  }

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        if (
          current.role !==
          'SUPER_ADMIN'
        ) {
          router.replace(
            '/more',
          );

          return;
        }

        setUser(
          current,
        );

        await loadReports();
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);

  async function resolve(
    reportId: string,
  ) {
    const note =
      window.prompt(
        'Resolution note (optional):',
        'Reviewed by FC ARENA moderation.',
      );

    if (
      note ===
      null
    ) {
      return;
    }

    setBusyId(
      reportId,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        '/safety/admin/reports/' +
          reportId +
          '/resolve',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              note:
                note.trim() ||
                undefined,
            }),
        },
      );

      await loadReports();
    } catch (
      resolveError
    ) {
      setError(
        resolveError instanceof
          Error
          ? resolveError.message
          : 'Unable to resolve this report.',
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }

  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Moderation Queue..."
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
      playerRole="Super Admin"
    >
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="Super Admin"
          title="Safety Moderation Queue"
          subtitle="Review user reports and record moderation outcomes."
        />

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-600">
            {
              error
            }
          </div>
        ) : null}

        <FcPanel className="p-5 sm:p-6">
          {reports.length ===
          0 ? (
            <p className="theme-secondary-text text-sm">
              No safety reports have been submitted.
            </p>
          ) : (
            <div className="space-y-4">
              {reports.map(
                (
                  report,
                ) => (
                  <div
                    key={
                      report.id
                    }
                    className="theme-action-row rounded-2xl border p-4"
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
                          Reported by{' '}
                          {report.reporter
                            .inGameName ||
                            report.reporter
                              .fullName}
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
                            : 'red'
                        }
                      />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="theme-secondary-text">
                        <span className="theme-muted">
                          Type:{' '}
                        </span>
                        {report.contentType
                          .replaceAll(
                            '_',
                            ' ',
                          )}
                      </p>

                      <p className="theme-secondary-text">
                        <span className="theme-muted">
                          Reason:{' '}
                        </span>
                        {report.reason
                          .replaceAll(
                            '_',
                            ' ',
                          )}
                      </p>
                    </div>

                    {report.details ? (
                      <p className="theme-secondary-text mt-3 whitespace-pre-wrap text-sm leading-6">
                        {
                          report.details
                        }
                      </p>
                    ) : null}

                    {report.resolution ? (
                      <p className="mt-3 text-sm text-emerald-700">
                        Resolved
                        {report.resolution
                          .note
                          ? ': ' +
                            report.resolution
                              .note
                          : '.'}
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          busyId ===
                          report.id
                        }
                        onClick={() =>
                          void resolve(
                            report.id,
                          )
                        }
                        className="theme-primary-button mt-4 min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                      >
                        {busyId ===
                        report.id
                          ? 'Saving...'
                          : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </FcPanel>
      </div>
    </AppShell>
  );
}
