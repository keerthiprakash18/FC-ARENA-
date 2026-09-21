'use client';

import Link from 'next/link';

import {
  useParams,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface Dispute {
  id: string;
  reason: string;
  evidenceUrl: string | null;
  status: string;
  resolutionNote: string | null;
  raisedByName?: string;
  raisedByInGameName?: string | null;
  resolvedByName?: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface MatchSummary {
  id: string;
  matchCode: string | null;
  status: string;

  tournament: {
    id: string;
    name: string;
  };

  fixture: {
    roundName: string;
  };
}

export default function MatchDisputePage() {
  const params =
    useParams<{
      matchId: string;
    }>();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    match,
    setMatch,
  ] =
    useState<MatchSummary | null>(
      null,
    );

  const [
    disputes,
    setDisputes,
  ] =
    useState<Dispute[]>(
      [],
    );

  const [
    hasConfirmedResult,
    setHasConfirmedResult,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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
      const [
        current,
        matchResponse,
        disputesResponse,
        resultsResponse,
      ] =
        await Promise.all([
          getCurrentUser(),

          authenticatedRequest<any>(
            '/matches/' +
              params.matchId,
          ),

          authenticatedRequest<any>(
            '/matches/' +
              params.matchId +
              '/disputes',
          ),

          authenticatedRequest<any>(
            '/matches/' +
              params.matchId +
              '/results',
          ),
        ]);

      setUser(
        current,
      );

      setMatch(
        matchResponse
          .data
          .match,
      );

      setDisputes(
        disputesResponse
          .data
          .disputes,
      );

      setHasConfirmedResult(
        Boolean(
          resultsResponse
            .data
            .confirmedResultSubmissionId,
        ),
      );

      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Dispute Center.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(() => {
    void load();
  }, [
    params.matchId,
  ]);

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    const data =
      new FormData(
        form,
      );

    setBusy(
      true,
    );

    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<any>(
          '/matches/' +
            params.matchId +
            '/disputes',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                reason:
                  String(
                    data.get(
                      'reason',
                    ) ||
                      '',
                  ),

                evidenceUrl:
                  String(
                    data.get(
                      'evidenceUrl',
                    ) ||
                      '',
                  ) ||
                  undefined,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      form.reset();

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to raise dispute.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    loading ||
    !user ||
    !match
  ) {
    return (
      <FcLoadingScreen
        label={
          error ||
          'Loading Dispute Center...'
        }
      />
    );
  }

  const playerName =
    user.player
      ?.identity
      ?.inGameName ||
    user.fullName;

  const hasOpenDispute =
    disputes.some(
      (dispute) =>
        dispute.status ===
        'OPEN',
    );

  return (
    <AppShell
      playerName={
        playerName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref={
            '/matches/' +
            params.matchId
          }
          backLabel="Match Center"
          eyebrow="Result Integrity"
          title="Dispute Center"
          subtitle={
            match.tournament.name +
            ' · ' +
            match.fixture.roundName
          }
          action={
            <FcStatusBadge
              label={
                hasOpenDispute
                  ? 'Open Dispute'
                  : 'Protected Result'
              }
              tone={
                hasOpenDispute
                  ? 'amber'
                  : 'emerald'
              }
            />
          }
        />

        {error ? (
          <FcErrorState
            message={
              error
            }
          />
        ) : null}

        {message ? (
          <div className="theme-tone-success rounded-2xl border p-4 text-sm font-medium">
            {
              message
            }
          </div>
        ) : null}

        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="theme-muted text-xs font-medium">
                Match
              </p>

              <h2 className="theme-text mt-1 text-xl font-semibold">
                {
                  match.matchCode ||
                  match.id
                }
              </h2>

              <p className="theme-secondary-text mt-2 text-sm">
                A dispute does not change scores automatically. A League Admin must review the claim and take a separate result-correction action when required.
              </p>
            </div>

            <Link
              href={
                '/matches/' +
                params.matchId
              }
              className="theme-secondary-button inline-flex min-h-10 items-center rounded-[10px] border px-4 text-sm font-medium"
            >
              View Match
            </Link>
          </div>
        </FcPanel>

        {hasConfirmedResult &&
        !hasOpenDispute ? (
          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">
              Raise a dispute
            </h2>

            <p className="theme-secondary-text mt-2 text-sm leading-6">
              Explain exactly what is wrong with the confirmed result. Add a screenshot or evidence link when available.
            </p>

            <form
              onSubmit={
                submit
              }
              className="mt-5 grid gap-4"
            >
              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-text">
                  Reason
                </span>

                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={1000}
                  required
                  rows={5}
                  placeholder="Example: The confirmed score is 2-1, but the final screenshot shows 3-1."
                  className="theme-input rounded-xl border px-4 py-3 outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                <span className="theme-text">
                  Evidence URL
                  <span className="theme-muted">
                    {' '}
                    (optional)
                  </span>
                </span>

                <input
                  name="evidenceUrl"
                  type="text"
                  maxLength={2000}
                  placeholder="Cloudinary, Drive or screenshot link"
                  className="theme-input rounded-xl border px-4 py-3 outline-none"
                />
              </label>

              <button
                disabled={
                  busy
                }
                className="theme-primary-button min-h-11 rounded-[10px] px-5 text-sm font-semibold disabled:opacity-50"
              >
                {busy
                  ? 'Submitting...'
                  : 'Raise Dispute'}
              </button>
            </form>
          </FcPanel>
        ) : !hasConfirmedResult ? (
          <FcPanel className="p-5">
            <p className="theme-secondary-text text-sm">
              A dispute can be raised after the match has a confirmed result.
            </p>
          </FcPanel>
        ) : null}

        <section className="space-y-3">
          {disputes.map(
            (
              dispute,
            ) => (
              <FcPanel
                key={
                  dispute.id
                }
                className="p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
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
                        {new Date(
                          dispute.createdAt,
                        ).toLocaleString()}
                      </span>
                    </div>

                    <p className="theme-text mt-4 whitespace-pre-wrap text-sm leading-6">
                      {
                        dispute.reason
                      }
                    </p>

                    {dispute.evidenceUrl ? (
                      <a
                        href={
                          dispute.evidenceUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="theme-text-link mt-3 inline-flex text-sm font-semibold"
                      >
                        Open evidence ↗
                      </a>
                    ) : null}

                    {dispute.resolutionNote ? (
                      <div className="theme-soft-accent mt-4 rounded-xl border p-4">
                        <p className="theme-muted text-xs font-medium">
                          Admin resolution
                        </p>

                        <p className="theme-text mt-1 text-sm leading-6">
                          {
                            dispute.resolutionNote
                          }
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </FcPanel>
            ),
          )}

          {disputes.length ===
          0 ? (
            <FcEmptyState
              title="No disputes"
              description="No result dispute has been raised for this match."
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
