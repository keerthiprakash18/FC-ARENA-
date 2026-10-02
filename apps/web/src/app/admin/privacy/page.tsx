'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AdminNavigation,
} from '@/components/admin/admin-navigation';

import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

type RequestStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'COMPLETED';

interface DeletionRequest {
  id: string;
  auditId: string;
  requestedAt: string;
  status: RequestStatus;
  statusUpdatedAt: string;

  request: {
    email: string | null;
    inGameName: string | null;
    details: string | null;
  };

  account: {
    id: string;
    fullName: string;
    email: string;
    status: string;
    playerCode: string | null;
    inGameName: string | null;
  } | null;
}

export default function AdminPrivacyPage() {
  const [
    requests,
    setRequests,
  ] =
    useState<DeletionRequest[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  async function load() {
    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            requests:
              DeletionRequest[];
          };
          error: null;
        }>(
          '/admin/ops/privacy/deletion-requests',
        );

      setRequests(
        response.data
          .requests,
      );

      setError(
        '',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load privacy requests.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts =
    useMemo(
      () => ({
        pending:
          requests.filter(
            (
              request,
            ) =>
              request.status ===
              'PENDING_VERIFICATION',
          ).length,

        verified:
          requests.filter(
            (
              request,
            ) =>
              request.status ===
              'VERIFIED',
          ).length,

        completed:
          requests.filter(
            (
              request,
            ) =>
              request.status ===
              'COMPLETED',
          ).length,
      }),
      [
        requests,
      ],
    );

  async function verify(
    request:
      DeletionRequest,
  ) {
    if (
      busy
    ) {
      return;
    }

    const note =
      window.prompt(
        'Verification note (optional). Only mark verified after confirming account ownership through the account email or another reliable method.',
        '',
      );

    if (
      note ===
      null
    ) {
      return;
    }

    setBusy(
      'verify-' +
        request.id,
    );
    setError(
      '',
    );
    setMessage(
      '',
    );

    try {
      await authenticatedRequest(
        `/admin/ops/privacy/deletion-requests/${request.id}/verify`,
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

      setMessage(
        'Account ownership marked as verified.',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify deletion request.',
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  async function complete(
    request:
      DeletionRequest,
  ) {
    if (
      busy
    ) {
      return;
    }

    const confirmation =
      window.prompt(
        'This permanently removes/anonymizes personal account data and signs the user out. Type DELETE to continue.',
        '',
      );

    if (
      confirmation !==
      'DELETE'
    ) {
      if (
        confirmation !==
        null
      ) {
        setError(
          'Deletion cancelled. Type DELETE exactly to confirm.',
        );
      }

      return;
    }

    setBusy(
      'complete-' +
        request.id,
    );
    setError(
      '',
    );
    setMessage(
      '',
    );

    try {
      await authenticatedRequest(
        `/admin/ops/privacy/deletion-requests/${request.id}/complete`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              confirm:
                'DELETE',
            }),
        },
      );

      setMessage(
        'Account deletion completed. Personal account data was deleted/anonymized and competition history retained in de-identified form.',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete account deletion.',
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="SUPER_ADMIN · PRIVACY"
      title="Account Deletion Requests"
      subtitle="Verify account ownership, then complete irreversible personal-data deletion/anonymization while preserving de-identified competition records."
      backHref="/more"
      backLabel="More"
    >
      <AdminNavigation />

      <section className="grid grid-cols-3 gap-3">
        {[
          [
            'Pending',
            counts.pending,
            'amber',
          ],
          [
            'Verified',
            counts.verified,
            'cyan',
          ],
          [
            'Completed',
            counts.completed,
            'emerald',
          ],
        ].map(
          (
            item,
          ) => (
            <FcPanel
              key={
                item[0]
              }
              className="p-4 text-center"
            >
              <p className="text-2xl font-black">
                {
                  item[1]
                }
              </p>

              <div className="mt-2">
                <FcStatusBadge
                  label={
                    String(
                      item[0],
                    )
                  }
                  tone={
                    item[2] as
                      | 'amber'
                      | 'cyan'
                      | 'emerald'
                  }
                />
              </div>
            </FcPanel>
          ),
        )}
      </section>

      <FcPanel className="border-amber-400/15 p-4 text-xs leading-5 text-slate-500">
        <strong className="text-amber-300">
          Privacy operation:
        </strong>{' '}
        Verify ownership before completion. Completion removes login/session/push data, email/phone, game UID, profile image and user-uploaded OCR evidence; it anonymizes the player identity and preserves only de-identified records needed for completed competitions.
      </FcPanel>

      {message ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
          {
            message
          }
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
          {
            error
          }
        </div>
      ) : null}

      {loading ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading deletion requests...
        </FcPanel>
      ) : requests.length ===
        0 ? (
        <FcEmptyState
          title="No account deletion requests"
          description="Public and in-app account deletion requests will appear here for ownership verification and completion."
        />
      ) : (
        <section className="space-y-3">
          {requests.map(
            (
              request,
            ) => (
              <FcPanel
                key={
                  request.id
                }
                className="p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">
                        {request.account
                          ?.inGameName ||
                          request.request
                            .inGameName ||
                          request.account
                            ?.fullName ||
                          'Deletion Request'}
                      </p>

                      <FcStatusBadge
                        label={
                          request.status
                        }
                        tone={
                          request.status ===
                          'COMPLETED'
                            ? 'emerald'
                            : request.status ===
                                'VERIFIED'
                              ? 'cyan'
                              : 'amber'
                        }
                      />
                    </div>

                    <p className="mt-2 break-all text-xs text-slate-500">
                      {request.account
                        ?.email ||
                        request.request
                          .email ||
                        'Personal contact details removed'}
                    </p>

                    {request.account
                      ?.playerCode ? (
                      <p className="mt-1 font-mono text-[10px] text-sky-400">
                        {
                          request.account
                            .playerCode
                        }
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-600">
                      Requested{' '}
                      {new Date(
                        request.requestedAt,
                      ).toLocaleString()}
                    </p>

                    {request.request
                      .details ? (
                      <p className="mt-3 max-w-2xl rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">
                        {
                          request.request
                            .details
                        }
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {request.status ===
                    'PENDING_VERIFICATION' ? (
                      <button
                        type="button"
                        disabled={
                          Boolean(
                            busy,
                          )
                        }
                        onClick={() =>
                          void verify(
                            request,
                          )
                        }
                        className="theme-secondary-button min-h-10 rounded-xl border px-4 text-xs font-black disabled:opacity-50"
                      >
                        {busy ===
                        'verify-' +
                          request.id
                          ? 'Verifying...'
                          : 'Mark Ownership Verified'}
                      </button>
                    ) : null}

                    {request.status ===
                    'VERIFIED' ? (
                      <button
                        type="button"
                        disabled={
                          Boolean(
                            busy,
                          )
                        }
                        onClick={() =>
                          void complete(
                            request,
                          )
                        }
                        className="min-h-10 rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 text-xs font-black text-red-300 disabled:opacity-50"
                      >
                        {busy ===
                        'complete-' +
                          request.id
                          ? 'Deleting...'
                          : 'Complete Deletion'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
