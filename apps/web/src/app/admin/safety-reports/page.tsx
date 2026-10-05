'use client';
import { promptAction } from '@/components/fc/confirmation-provider';

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
  FcEmptyState,
  FcNotice,
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
    | 'RESOLVED'
    | 'DISMISSED';

  reportsAgainstTarget: number;

  createdAt: string;

  resolution: {
    decision:
      | 'RESOLVED'
      | 'DISMISSED';
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
  const [message, setMessage] = useState('');

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

  async function review(
    reportId:
      string,
    decision:
      | 'RESOLVED'
      | 'DISMISSED',
  ) {
    const note = await promptAction({
      title: decision === 'DISMISSED' ? 'Dismiss safety report?' : 'Resolve safety report?',
      description: decision === 'DISMISSED' ? 'Close this report as dismissed and record the review outcome.' : 'Mark this report as resolved and record the review outcome.',
      label: decision === 'DISMISSED' ? 'Dismissal note' : 'Resolution note',
      defaultValue: decision === 'DISMISSED' ? 'Reviewed and no moderation action is required.' : 'Reviewed by FC ARENA moderation.',
      confirmLabel: decision === 'DISMISSED' ? 'Dismiss report' : 'Resolve report', destructive: decision === 'DISMISSED',
    });

    if (
      note ===
      null
    ) {
      return;
    }

    setBusyId(
      reportId,
    );
    setMessage('');

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
              decision,
              note:
                note.trim() ||
                undefined,
            }),
        },
      );

      await loadReports();
      setMessage(decision === 'DISMISSED' ? 'Safety report dismissed.' : 'Safety report resolved.');
    } catch (
      reviewError
    ) {
      setError(
        reviewError instanceof
          Error
          ? reviewError.message
          : 'Unable to review this report.',
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

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>

        <FcPanel className="p-5 sm:p-6">
          {reports.length ===
          0 ? (
            <FcEmptyState title="No safety reports" description="Submitted safety reports will appear here for review." icon="shield" />
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
                            : report.status ===
                                'DISMISSED'
                              ? 'slate'
                              : 'red'
                        }
                      />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p className="theme-secondary-text">
                        <span className="theme-muted">
                          Reports against player:{' '}
                        </span>
                        {report.reportsAgainstTarget}
                      </p>
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
                        {report.resolution.decision ===
                        'DISMISSED'
                          ? 'Dismissed'
                          : 'Resolved'}
                        {report.resolution
                          .note
                          ? ': ' +
                            report.resolution
                              .note
                          : '.'}
                      </p>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            busyId ===
                            report.id
                          }
                          onClick={() =>
                            void review(
                              report.id,
                              'RESOLVED',
                            )
                          }
                          className="theme-primary-button min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                        >
                          {busyId ===
                          report.id
                            ? 'Saving...'
                            : 'Resolve'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            busyId ===
                            report.id
                          }
                          onClick={() =>
                            void review(
                              report.id,
                              'DISMISSED',
                            )
                          }
                          className="theme-secondary-button min-h-10 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
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
