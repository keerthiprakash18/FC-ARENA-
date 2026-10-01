'use client';

import {
  FormEvent,
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

interface LeagueOption {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Member {
  membershipId: string;

  user: {
    id: string;
    fullName: string;
    playerCode: string | null;
    profileImageUrl: string | null;
    inGameName: string | null;
    adminRole: string | null;
  };
}

interface QueueData {
  policy: Array<{
    kind: string;
    points: number;
    activeDays: number;
    title: string;
  }>;

  leagues:
    LeagueOption[];

  pendingAppeals: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;

    player: {
      userId: string;
      fullName: string;
      inGameName: string | null;
      playerCode: string | null;
    };

    event: {
      id: string;
      kind: string;
      pointsDelta: number;
      title: string;
      reason: string;

      league: {
        id: string;
        name: string;
      };
    };
  }>;

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
    };

    player: {
      userId: string;
      fullName: string;
      inGameName: string | null;
      playerCode: string | null;
      profileImageUrl: string | null;
    };

    issuer: {
      userId: string;
      fullName: string;
      inGameName: string | null;
      playerCode: string | null;
    };

    summary: {
      score: number;
      status: string;
      activePenaltyEvents: number;
    } | null;
  }>;
}

function nameFor(
  player: {
    fullName: string;
    inGameName: string | null;
  },
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

export default function AdminFairPlayPage() {
  const [
    data,
    setData,
  ] =
    useState<QueueData | null>(
      null,
    );

  const [
    selectedLeagueId,
    setSelectedLeagueId,
  ] =
    useState('');

  const [
    members,
    setMembers,
  ] =
    useState<Member[]>(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    targetUserId,
    setTargetUserId,
  ] =
    useState('');

  const [
    kind,
    setKind,
  ] =
    useState(
      'WARNING',
    );

  const [
    reason,
    setReason,
  ] =
    useState('');

  const [
    evidenceUrl,
    setEvidenceUrl,
  ] =
    useState('');

  const [
    appealNotes,
    setAppealNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      {},
    );

  const [
    revokeEventId,
    setRevokeEventId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    revokeReason,
    setRevokeReason,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

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

  async function loadQueue(
    leagueId?:
      string,
  ) {
    const suffix =
      leagueId
        ? '?' +
          new URLSearchParams({
            leagueId,
          }).toString()
        : '';

    const response =
      await authenticatedRequest<{
        success: true;
        data: QueueData;
        error: null;
      }>(
        '/admin/fair-play' +
          suffix,
      );

    setData(
      response.data,
    );

    if (
      !selectedLeagueId &&
      response.data
        .leagues[0]
    ) {
      setSelectedLeagueId(
        response.data
          .leagues[0]
          .id,
      );
    }
  }

  async function loadMembers(
    leagueId:
      string,
    query = '',
  ) {
    if (
      !leagueId
    ) {
      setMembers(
        [],
      );
      return;
    }

    const params =
      new URLSearchParams();

    if (
      query.trim()
    ) {
      params.set(
        'search',
        query.trim(),
      );
    }

    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          members:
            Member[];
        };

        error: null;
      }>(
        '/leagues/' +
          leagueId +
          '/members' +
          (
            params.toString()
              ? '?' +
                params.toString()
              : ''
          ),
      );

    setMembers(
      response.data
        .members,
    );
  }

  useEffect(() => {
    void loadQueue()
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Fair Play admin.',
          ),
      );
  }, []);

  useEffect(() => {
    if (
      !selectedLeagueId
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          void loadMembers(
            selectedLeagueId,
            search,
          ).catch(
            (
              err,
            ) =>
              setError(
                err instanceof Error
                  ? err.message
                  : 'Unable to load League members.',
              ),
          );
        },
        220,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    selectedLeagueId,
    search,
  ]);

  const selectedPolicy =
    useMemo(
      () =>
        data?.policy.find(
          (
            item,
          ) =>
            item.kind ===
            kind,
        ) ??
        null,
      [
        data,
        kind,
      ],
    );

  async function issue(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      busy ||
      !selectedLeagueId ||
      !targetUserId
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
        '/admin/fair-play/events',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              leagueId:
                selectedLeagueId,
              targetUserId,
              kind,
              reason:
                reason.trim(),

              ...(
                evidenceUrl
                  .trim()
                  ? {
                      evidenceUrl:
                        evidenceUrl
                          .trim(),
                    }
                  : {}
              ),
            }),
        },
      );

      setMessage(
        'Fair Play event recorded with the fixed policy value.',
      );
      setTargetUserId(
        '',
      );
      setReason(
        '',
      );
      setEvidenceUrl(
        '',
      );

      await loadQueue(
        selectedLeagueId,
      );
      await loadMembers(
        selectedLeagueId,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to record Fair Play event.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function resolveAppeal(
    appealId:
      string,
    status:
      | 'UPHELD'
      | 'OVERTURNED',
  ) {
    const note =
      appealNotes[
        appealId
      ]?.trim();

    if (
      busy ||
      !note
    ) {
      setError(
        'Add a resolution note before closing an appeal.',
      );
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
        '/admin/fair-play/appeals/' +
          appealId +
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

      setMessage(
        status ===
        'OVERTURNED'
          ? 'Appeal accepted and event revoked.'
          : 'Appeal reviewed and event upheld.',
      );

      setAppealNotes(
        (
          current,
        ) => {
          const next = {
            ...current,
          };

          delete next[
            appealId
          ];

          return next;
        },
      );

      await loadQueue(
        selectedLeagueId ||
        undefined,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to resolve Fair Play appeal.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function revoke(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !revokeEventId ||
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
        '/admin/fair-play/events/' +
          revokeEventId +
          '/revoke',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              reason:
                revokeReason
                  .trim(),
            }),
        },
      );

      setMessage(
        'Fair Play event revoked and score recalculated.',
      );
      setRevokeEventId(
        null,
      );
      setRevokeReason(
        '',
      );

      await loadQueue(
        selectedLeagueId ||
        undefined,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to revoke Fair Play event.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Admin · V3.4"
      title="Fair Play Management"
      subtitle="Auditable conduct events, fixed point policy, automatic expiry and player appeals."
      backHref="/more"
      backLabel="More"
      action={
        <FcStatusBadge
          label={
            data
              ? data
                  .pendingAppeals
                  .length +
                ' Pending Appeal' +
                (
                  data
                    .pendingAppeals
                    .length ===
                  1
                    ? ''
                    : 's'
                )
              : 'Loading'
          }
          tone={
            data &&
            data
              .pendingAppeals
              .length >
              0
              ? 'amber'
              : 'emerald'
          }
        />
      }
    >
      <AdminNavigation />

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
          <FcPanel className="p-5 sm:p-6">
            <form
              onSubmit={
                issue
              }
              className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Record Event
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Fair Play Action
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Pick a League member and an event type. Point value and expiry are fixed by FC Arena policy; admins cannot edit them.
                </p>

                {selectedPolicy ? (
                  <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <p className="font-black">
                      {
                        selectedPolicy.title
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {
                        selectedPolicy.points >
                        0
                          ? '+'
                          : ''
                      }
                      {
                        selectedPolicy.points
                      }{' '}
                      points ·{' '}
                      {
                        selectedPolicy.activeDays
                      }{' '}
                      days
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    League
                  </span>

                  <select
                    required
                    value={
                      selectedLeagueId
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedLeagueId(
                        event
                          .target
                          .value,
                      );
                      setTargetUserId(
                        '',
                      );
                      setSearch(
                        '',
                      );
                    }}
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  >
                    {data.leagues.map(
                      (
                        league,
                      ) => (
                        <option
                          key={
                            league.id
                          }
                          value={
                            league.id
                          }
                        >
                          {
                            league.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Event Type
                  </span>

                  <select
                    value={
                      kind
                    }
                    onChange={(
                      event,
                    ) =>
                      setKind(
                        event
                          .target
                          .value,
                      )
                    }
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  >
                    {data.policy.map(
                      (
                        item,
                      ) => (
                        <option
                          key={
                            item.kind
                          }
                          value={
                            item.kind
                          }
                        >
                          {
                            item.title
                          }{' '}
                          ({
                            item.points >
                            0
                              ? '+'
                              : ''
                          }{
                            item.points
                          })
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Find League Member
                  </span>

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Search name or in-game name..."
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  />
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Player
                  </span>

                  <select
                    required
                    value={
                      targetUserId
                    }
                    onChange={(
                      event,
                    ) =>
                      setTargetUserId(
                        event
                          .target
                          .value,
                      )
                    }
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  >
                    <option value="">
                      Select player
                    </option>

                    {members.map(
                      (
                        member,
                      ) => (
                        <option
                          key={
                            member
                              .user.id
                          }
                          value={
                            member
                              .user.id
                          }
                        >
                          {
                            member
                              .user
                              .inGameName ||
                            member
                              .user
                              .fullName
                          }{
                            member
                              .user
                              .playerCode
                              ? ' · ' +
                                member
                                  .user
                                  .playerCode
                              : ''
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Reason
                  </span>

                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={
                      reason
                    }
                    onChange={(
                      event,
                    ) =>
                      setReason(
                        event
                          .target
                          .value,
                      )
                    }
                    rows={3}
                    placeholder="Factual reason for this Fair Play event..."
                    className="theme-input rounded-xl border px-3 py-3 text-sm outline-none"
                  />
                </label>

                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Evidence URL · Optional
                  </span>

                  <input
                    type="url"
                    value={
                      evidenceUrl
                    }
                    onChange={(
                      event,
                    ) =>
                      setEvidenceUrl(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="https://..."
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    busy ||
                    !targetUserId
                  }
                  className="theme-primary-button min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-50 sm:col-span-2"
                >
                  {busy
                    ? 'Saving...'
                    : 'Record Fair Play Event'}
                </button>
              </div>
            </form>
          </FcPanel>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Appeals
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Pending Review
                </h2>
              </div>

              <span className="text-xs text-slate-600">
                {
                  data
                    .pendingAppeals
                    .length
                }{' '}
                pending
              </span>
            </div>

            <div className="space-y-3">
              {data.pendingAppeals.map(
                (
                  appeal,
                ) => (
                  <FcPanel
                    key={
                      appeal.id
                    }
                    className="p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {
                            nameFor(
                              appeal.player,
                            )
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            appeal
                              .event
                              .league
                              .name
                          }{' '}
                          ·{' '}
                          {
                            appeal
                              .event
                              .title
                          }{' '}
                          ·{' '}
                          {
                            appeal
                              .event
                              .pointsDelta
                          }{' '}
                          pts
                        </p>
                      </div>

                      <FcStatusBadge
                        label="PENDING"
                        tone="amber"
                      />
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      <b className="text-slate-300">
                        Appeal:
                      </b>{' '}
                      {
                        appeal.reason
                      }
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      Original reason: {
                        appeal
                          .event
                          .reason
                      }
                    </p>

                    <textarea
                      value={
                        appealNotes[
                          appeal.id
                        ] ??
                        ''
                      }
                      onChange={(
                        event,
                      ) =>
                        setAppealNotes(
                          (
                            current,
                          ) => ({
                            ...current,
                            [appeal.id]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      rows={2}
                      placeholder="Required resolution note..."
                      className="theme-input mt-4 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void resolveAppeal(
                            appeal.id,
                            'OVERTURNED',
                          )
                        }
                        className="min-h-10 rounded-xl bg-emerald-400 px-4 text-xs font-black text-[#04130d] disabled:opacity-50"
                      >
                        Accept Appeal · Revoke Event
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void resolveAppeal(
                            appeal.id,
                            'UPHELD',
                          )
                        }
                        className="theme-secondary-button min-h-10 rounded-xl border px-4 text-xs font-black disabled:opacity-50"
                      >
                        Uphold Event
                      </button>
                    </div>
                  </FcPanel>
                ),
              )}

              {data
                .pendingAppeals
                .length ===
                0 ? (
                <FcEmptyState
                  title="No pending Fair Play appeals"
                  description="Appeals from players in your managed League scope will appear here."
                />
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Audit History
              </p>

              <h2 className="mt-1 text-xl font-black">
                Recent Fair Play Events
              </h2>
            </div>

            <FcPanel className="overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {data.events.map(
                  (
                    item,
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-black">
                            {
                              nameFor(
                                item.player,
                              )
                            }{' '}
                            ·{' '}
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

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {
                            item
                              .league
                              .name
                          }{' '}
                          · score{' '}
                          {
                            item.summary
                              ?.score ??
                            '—'
                          }{' '}
                          · issued by{' '}
                          {
                            nameFor(
                              item.issuer,
                            )
                          }
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {
                            item.reason
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <span
                          className={
                            item.pointsDelta <
                            0
                              ? 'font-black text-amber-300'
                              : item.pointsDelta >
                                  0
                                ? 'font-black text-emerald-400'
                                : 'font-black text-slate-500'
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

                        {item.active ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeEventId(
                                item.id,
                              );
                              setRevokeReason(
                                '',
                              );
                            }}
                            className="theme-secondary-button min-h-9 rounded-lg border px-3 text-[10px] font-black"
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          </section>

          {revokeEventId ? (
            <FcPanel className="border-red-400/15 p-5">
              <form
                onSubmit={
                  revoke
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
                      Revoke Event
                    </p>

                    <h2 className="mt-1 text-lg font-black">
                      Record why this event is being removed
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRevokeEventId(
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
                  minLength={5}
                  maxLength={1000}
                  value={
                    revokeReason
                  }
                  onChange={(
                    event,
                  ) =>
                    setRevokeReason(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={3}
                  className="theme-input mt-4 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                  placeholder="Reason for revocation..."
                />

                <button
                  type="submit"
                  disabled={
                    busy
                  }
                  className="mt-3 min-h-10 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 text-xs font-black text-red-300 disabled:opacity-50"
                >
                  Revoke Fair Play Event
                </button>
              </form>
            </FcPanel>
          ) : null}
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading Fair Play administration...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
