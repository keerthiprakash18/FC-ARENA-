'use client';
import { AdminFilterBar } from '@/components/admin/admin-filter-bar';

import {
  useEffect,
  useState,
} from 'react';

import {
  AdminNavigation,
} from '@/components/admin/admin-navigation';

import {
  FcEmptyState,
  FcErrorState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface Dispute {
  id: string;
  matchId: string;
  reason: string;
  evidenceUrl: string | null;
  status: string;
  resolutionNote: string | null;
  raisedByName: string;
  raisedByInGameName: string | null;
  resolvedByName: string | null;
  tournamentName: string;
  tournamentCode: string;
  leagueName: string;
  roundName: string;
  fixtureCode: string;
  createdAt: string;
  resolvedAt: string | null;
}

export default function AdminDisputesPage() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [
    disputes,
    setDisputes,
  ] =
    useState<Dispute[]>(
      [],
    );

  const [
    notes,
    setNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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

  async function load() {
    try {
      const response =
        await authenticatedRequest<any>(
          '/admin/disputes',
        );

      setDisputes(
        response.data
          .disputes,
      );

      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load disputes.',
      );

    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function closeDispute(
    disputeId: string,
    status:
      | 'RESOLVED'
      | 'REJECTED',
  ) {
    const note =
      notes[disputeId]
        ?.trim();

    if (
      !note ||
      note.length < 3
    ) {
      setFieldErrors(current => ({ ...current, [disputeId]: 'Add a resolution note of at least 3 characters.' }));
      document.getElementById(`dispute-note-${disputeId}`)?.focus();
      setError(
        'Add a short resolution note before closing the dispute.',
      );

      return;
    }

    setBusyId(
      disputeId,
    );
    setFieldErrors(current => ({ ...current, [disputeId]: '' }));

    setError('');

    try {
      await authenticatedRequest(
        '/admin/disputes/' +
          disputeId +
          '/resolve',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              status,
              resolutionNote:
                note,
            }),
        },
      );

      setNotes(
        (
          current,
        ) => ({
          ...current,
          [disputeId]:
            '',
        }),
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update dispute.',
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }

  const openCount =
    disputes.filter(
      (dispute) =>
        dispute.status ===
        'OPEN',
    ).length;

  const visibleDisputes = disputes.filter(dispute =>
    (!statusFilter || dispute.status === statusFilter) &&
    [dispute.raisedByName, dispute.raisedByInGameName, dispute.tournamentName, dispute.leagueName, dispute.reason].join(' ').toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="Disputes"
      subtitle="Review confirmed-result disputes without changing results automatically."
      action={
        <FcStatusBadge
          label={
            openCount +
            ' Open'
          }
          tone={
            openCount > 0
              ? 'amber'
              : 'emerald'
          }
        />
      }
    >
      <AdminNavigation />
      <AdminFilterBar query={query} onQueryChange={setQuery} status={statusFilter} onStatusChange={setStatusFilter} count={visibleDisputes.length} statuses={['OPEN', 'RESOLVED', 'REJECTED']} />

      {error ? (
        <FcErrorState
          message={
            error
          }
        />
      ) : null}

      <section className="space-y-4">
        {visibleDisputes.map(
          (
            dispute,
          ) => (
            <FcPanel
              key={
                dispute.id
              }
              className="p-5 sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <FcStatusBadge
                      label={
                        dispute.status
                      }
                      tone={
                        dispute.status ===
                        'RESOLVED'
                          ? 'emerald'
                          : dispute.status ===
                              'REJECTED'
                            ? 'red'
                            : 'amber'
                      }
                    />

                    <span className="theme-muted text-xs">
                      {
                        dispute.leagueName
                      }
                      {' · '}
                      {
                        dispute.tournamentName
                      }
                    </span>
                  </div>

                  <h2 className="theme-text mt-3 text-lg font-semibold">
                    {
                      dispute.roundName
                    }
                    {' · '}
                    {
                      dispute.fixtureCode
                    }
                  </h2>

                  <p className="theme-secondary-text mt-1 text-xs">
                    Raised by{' '}
                    {
                      dispute.raisedByInGameName ||
                      dispute.raisedByName
                    }
                    {' · '}
                    {new Date(
                      dispute.createdAt,
                    ).toLocaleString()}
                  </p>

                  <p className="theme-text mt-4 whitespace-pre-wrap text-sm leading-6">
                    {
                      dispute.reason
                    }
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={
                        '/matches/' +
                        dispute.matchId
                      }
                      className="theme-text-link text-sm font-semibold"
                    >
                      Open Match →
                    </a>

                    {dispute.evidenceUrl ? (
                      <a
                        href={
                          dispute.evidenceUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="theme-text-link text-sm font-semibold"
                      >
                        Evidence ↗
                      </a>
                    ) : null}
                  </div>

                  {dispute.resolutionNote ? (
                    <div className="theme-soft-accent mt-4 rounded-xl border p-4">
                      <p className="theme-muted text-xs font-medium">
                        Resolution by{' '}
                        {
                          dispute.resolvedByName ||
                          'Admin'
                        }
                      </p>

                      <p className="theme-text mt-1 text-sm leading-6">
                        {
                          dispute.resolutionNote
                        }
                      </p>
                    </div>
                  ) : null}
                </div>

                {dispute.status ===
                'OPEN' ? (
                   <div className="w-full lg:max-w-sm">
                     <label htmlFor={`dispute-note-${dispute.id}`} className="fc-field-label mb-2">Resolution note <span className="theme-muted">Required · at least 3 characters</span></label>
                     <textarea
                       id={`dispute-note-${dispute.id}`}
                       aria-invalid={Boolean(fieldErrors[dispute.id])}
                       aria-describedby={fieldErrors[dispute.id] ? `dispute-error-${dispute.id}` : undefined}
                      value={
                        notes[
                          dispute.id
                        ] ||
                        ''
                      }
                      onChange={(
                        event,
                      ) =>
                        setNotes(
                          (
                            current,
                          ) => ({
                            ...current,
                            [dispute.id]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      rows={4}
                      maxLength={1000}
                      placeholder="Resolution note..."
                      className="theme-input w-full rounded-xl border p-3 text-sm outline-none"
                     />
                     {fieldErrors[dispute.id] ? <p role="alert" id={`dispute-error-${dispute.id}`} className="theme-tone-danger mt-2 rounded-lg p-2 text-sm">{fieldErrors[dispute.id]}</p> : null}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={
                          busyId ===
                          dispute.id
                        }
                        onClick={() =>
                          void closeDispute(
                            dispute.id,
                            'RESOLVED',
                          )
                        }
                        className="theme-primary-button min-h-10 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-50"
                      >
                        Resolve
                      </button>

                      <button
                        type="button"
                        disabled={
                          busyId ===
                          dispute.id
                        }
                        onClick={() =>
                          void closeDispute(
                            dispute.id,
                            'REJECTED',
                          )
                        }
                        className="theme-danger-button min-h-10 rounded-[10px] border px-3 text-sm font-semibold disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </FcPanel>
          ),
        )}

        {visibleDisputes.length ===
        0 ? (
          <FcEmptyState
            title={query || statusFilter ? 'No matching disputes' : 'No disputes'}
            description={query || statusFilter ? 'Clear or adjust your filters to see other disputes.' : 'No match result disputes are waiting for your League Admin account.'}
          />
        ) : null}
      </section>
    </SecondaryFeaturePage>
  );
}
