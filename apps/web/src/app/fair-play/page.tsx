'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

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

interface FairPlayPolicy {
  kind: string;
  points: number;
  activeDays: number;
  title: string;
}

interface FairPlayData {
  summary: {
    score: number;
    status: string;
    baseScore: number;
    activePointsDelta: number;
    activeEvents: number;
    activePenaltyEvents: number;
    activeWarnings: number;
    commendations: number;
    lastUpdatedAt: string | null;
    automaticPenalty: boolean;
  };

  policy:
    FairPlayPolicy[];

  events: Array<{
    id: string;
    kind: string;
    pointsDelta: number;
    title: string;
    reason: string;
    evidenceUrl: string | null;
    issuedAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
    revocationNote: string | null;
    active: boolean;

    league: {
      id: string;
      name: string;
      logoUrl: string | null;
    };

    issuedBy: {
      id: string;
      name: string;
      playerCode: string | null;
    };

    appeal: {
      id: string;
      reason: string;
      status: string;
      resolutionNote: string | null;
      resolvedAt: string | null;
      createdAt: string;
    } | null;
  }>;
}

function statusTone(
  status:
    string,
) {
  if (
    status ===
    'EXEMPLARY'
  ) {
    return 'emerald' as const;
  }

  if (
    status ===
    'GOOD_STANDING'
  ) {
    return 'cyan' as const;
  }

  if (
    status ===
    'CAUTION'
  ) {
    return 'amber' as const;
  }

  return 'red' as const;
}

export default function FairPlayPage() {
  const [
    data,
    setData,
  ] =
    useState<FairPlayData | null>(
      null,
    );

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

  const [
    appealEventId,
    setAppealEventId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    appealReason,
    setAppealReason,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  async function load() {
    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: FairPlayData;
          error: null;
        }>(
          '/fair-play/me',
        );

      setData(
        response.data,
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
          : 'Unable to load Fair Play.',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitAppeal(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !appealEventId ||
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      await authenticatedRequest(
        '/fair-play/events/' +
          appealEventId +
          '/appeal',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              reason:
                appealReason
                  .trim(),
            }),
        },
      );

      setMessage(
        'Fair Play appeal submitted.',
      );

      setAppealEventId(
        null,
      );

      setAppealReason(
        '',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit appeal.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena V3.4"
      title="Fair Play"
      subtitle="Transparent competition conduct record with fixed policy values, expiry and appeal rights."
      backHref="/more"
      backLabel="More"
      action={
        data ? (
          <FcStatusBadge
            label={
              data.summary
                .status
            }
            tone={
              statusTone(
                data.summary
                  .status,
              )
            }
          />
        ) : null
      }
    >
      {error ? (
        <FcPanel className="border-red-400/20 p-4 text-sm text-red-300">
          {
            error
          }
        </FcPanel>
      ) : null}

      {message ? (
        <FcPanel className="border-emerald-400/20 p-4 text-sm font-black text-emerald-300">
          ✓ {
            message
          }
        </FcPanel>
      ) : null}

      {data ? (
        <>
          <FcPanel className="overflow-hidden p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
              <div className="grid h-36 w-36 place-items-center rounded-full border border-emerald-400/20 bg-emerald-400/[0.04]">
                <div className="text-center">
                  <p className="text-5xl font-black">
                    {
                      data.summary
                        .score
                    }
                  </p>

                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
                    / 100
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Reputation Summary
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {
                    data.summary
                      .status
                      .replaceAll(
                        '_',
                        ' ',
                      )
                  }
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Every player starts at 100. Only explicit admin-issued Fair Play events can change the score. Reports, disputes, losses and normal result corrections never reduce it automatically.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [
                      'Active Delta',
                      (
                        data.summary
                          .activePointsDelta >
                        0
                          ? '+'
                          : ''
                      ) +
                      data.summary
                        .activePointsDelta,
                    ],
                    [
                      'Penalties',
                      data.summary
                        .activePenaltyEvents,
                    ],
                    [
                      'Warnings',
                      data.summary
                        .activeWarnings,
                    ],
                    [
                      'Commendations',
                      data.summary
                        .commendations,
                    ],
                  ].map(
                    (
                      item,
                    ) => (
                      <div
                        key={
                          item[0]
                        }
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <p className="text-lg font-black">
                          {
                            item[1]
                          }
                        </p>

                        <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                          {
                            item[0]
                          }
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </FcPanel>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <FcPanel className="overflow-hidden">
              <div className="border-b border-white/[0.07] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Your Record
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Fair Play Events
                </h2>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {data.events.map(
                  (
                    item,
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">
                              {
                                item.title
                              }
                            </p>

                            <FcStatusBadge
                              label={
                                item.active
                                  ? 'ACTIVE'
                                  : item.revokedAt
                                    ? 'REVOKED'
                                    : 'EXPIRED'
                              }
                              tone={
                                item.active
                                  ? item.pointsDelta <
                                    0
                                    ? 'amber'
                                    : item.pointsDelta >
                                        0
                                      ? 'emerald'
                                      : 'slate'
                                  : 'slate'
                              }
                            />
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              item
                                .league
                                .name
                            }{' '}
                            · Issued by{' '}
                            {
                              item
                                .issuedBy
                                .name
                            }
                          </p>
                        </div>

                        <span
                          className={
                            item.pointsDelta >
                            0
                              ? 'text-xl font-black text-emerald-400'
                              : item.pointsDelta <
                                  0
                                ? 'text-xl font-black text-amber-300'
                                : 'text-xl font-black text-slate-500'
                          }
                        >
                          {
                            item.pointsDelta >
                            0
                              ? '+'
                              : ''
                          }
                          {
                            item.pointsDelta
                          }
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {
                          item.reason
                        }
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                        <span>
                          Issued{' '}
                          {new Date(
                            item.issuedAt,
                          ).toLocaleDateString()}
                        </span>

                        {item.expiresAt ? (
                          <span>
                            Expires{' '}
                            {new Date(
                              item.expiresAt,
                            ).toLocaleDateString()}
                          </span>
                        ) : null}

                        {item.evidenceUrl ? (
                          <a
                            href={
                              item.evidenceUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-black text-sky-400"
                          >
                            Evidence ↗
                          </a>
                        ) : null}
                      </div>

                      {item.appeal ? (
                        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black">
                              Appeal
                            </p>

                            <FcStatusBadge
                              label={
                                item
                                  .appeal
                                  .status
                              }
                              tone={
                                item
                                  .appeal
                                  .status ===
                                'OVERTURNED'
                                  ? 'emerald'
                                  : item
                                      .appeal
                                      .status ===
                                    'PENDING'
                                    ? 'amber'
                                    : 'slate'
                              }
                            />
                          </div>

                          {item
                            .appeal
                            .resolutionNote ? (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {
                                item
                                  .appeal
                                  .resolutionNote
                              }
                            </p>
                          ) : null}
                        </div>
                      ) : item.kind !==
                          'COMMENDATION' &&
                        !item.revokedAt ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppealEventId(
                              item.id,
                            );
                            setAppealReason(
                              '',
                            );
                          }}
                          className="theme-secondary-button mt-4 min-h-10 rounded-xl border px-4 text-xs font-black"
                        >
                          Appeal this event
                        </button>
                      ) : null}

                      {item.revocationNote ? (
                        <p className="mt-3 text-xs leading-5 text-emerald-300">
                          Revoked: {
                            item.revocationNote
                          }
                        </p>
                      ) : null}
                    </div>
                  ),
                )}

                {data.events
                  .length ===
                  0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No Fair Play events recorded. Your record is clean.
                  </p>
                ) : null}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Transparent Policy
              </p>

              <h2 className="mt-1 text-xl font-black">
                Fixed Values
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Admins choose an event type and provide a reason. They cannot manually change its point value or expiry period.
              </p>

              <div className="mt-4 space-y-2">
                {data.policy.map(
                  (
                    policy,
                  ) => (
                    <div
                      key={
                        policy.kind
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            policy.title
                          }
                        </p>

                        <p className="mt-1 text-[10px] text-slate-600">
                          Active for{' '}
                          {
                            policy.activeDays
                          }{' '}
                          days
                        </p>
                      </div>

                      <span
                        className={
                          policy.points >
                          0
                            ? 'font-black text-emerald-400'
                            : policy.points <
                                0
                              ? 'font-black text-amber-300'
                              : 'font-black text-slate-500'
                        }
                      >
                        {
                          policy.points >
                          0
                            ? '+'
                            : ''
                        }
                        {
                          policy.points
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>

              <p className="mt-4 text-[11px] leading-5 text-slate-600">
                Score bands: 95–100 Exemplary · 85–94 Good Standing · 70–84 Caution · below 70 Needs Review. These labels do not automatically ban or remove a player from competitions.
              </p>
            </FcPanel>
          </section>

          {appealEventId ? (
            <FcPanel className="border-amber-400/20 p-5">
              <form
                onSubmit={
                  submitAppeal
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                      Appeal
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      Explain why this event should be reviewed
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAppealEventId(
                        null,
                      )
                    }
                    className="text-xs font-black text-slate-500"
                  >
                    Cancel
                  </button>
                </div>

                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  value={
                    appealReason
                  }
                  onChange={(
                    event,
                  ) =>
                    setAppealReason(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={4}
                  placeholder="Give factual context for the admin review..."
                  className="theme-input mt-4 w-full rounded-xl border px-4 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    busy
                  }
                  className="theme-primary-button mt-3 min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-50"
                >
                  {busy
                    ? 'Submitting...'
                    : 'Submit Appeal'}
                </button>
              </form>
            </FcPanel>
          ) : null}
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading Fair Play record...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
