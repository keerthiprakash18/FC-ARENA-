'use client';
import Link from 'next/link';

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

interface OverviewData {
  scope: {
    global: boolean;
    leagueIds: string[];
  };

  totals: {
    players: number;
    leagues: number;
    tournaments: number;
    activeTournaments: number;
    completedTournaments: number;
    scheduledMatches: number;
    liveMatches: number;
    completedMatches: number;
    pendingResults: number;
    openDisputes: number;
    pendingApplications: number;
    activeWars: number;
    pushDevices: number;
  };

  trend: {
    label: string;

    days: Array<{
      day: string;
      newPlayers: number;
      confirmedResults: number;
    }>;
  };

  alerts: {
    staleScheduledMatches: number;
    oldPendingResults: number;
    oldOpenDisputes: number;
    total: number;
  };

  topLeagues: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    region: string | null;
    members: number;
    tournaments: number;
  }>;

  recentAudit: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    scopeType: string | null;
    scopeId: string | null;
    createdAt: string;

    actor: {
      id: string;
      name: string;
      playerCode: string | null;
    } | null;
  }>;
}

function humanize(
  value:
    string,
) {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}

export default function AdminAnalyticsPage() {
  const [
    data,
    setData,
  ] =
    useState<OverviewData | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void authenticatedRequest<{
      success: true;
      data: OverviewData;
      error: null;
    }>('/admin/ops/overview')
      .then(
        (
          response,
        ) => {
          setData(
            response.data,
          );
        },
      )
      .catch(
        (
          err,
        ) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load admin analytics.',
          );
        },
      );
  }, []);

  const maxTrend =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            data
              ?.trend.days ??
            []
          ).map(
            (
              day,
            ) =>
              Math.max(
                day.newPlayers,
                day.confirmedResults,
              ),
          ),
        ),
      [
        data,
      ],
    );

  return (
    <SecondaryFeaturePage
      eyebrow="Admin · V3.3"
      title="Analytics"
      subtitle="Competition health, operational workload and verified activity for your admin scope."
      backHref="/more"
      backLabel="More"
      action={
        data ? (
          <FcStatusBadge
            label={
              data.scope
                .global
                ? 'Global Scope'
                : data.scope
                    .leagueIds
                    .length +
                  ' Managed League' +
                  (
                    data.scope
                      .leagueIds
                      .length ===
                    1
                      ? ''
                      : 's'
                  )
            }
            tone={
              data.scope
                .global
                ? 'amber'
                : 'cyan'
            }
          />
        ) : null
      }
    >
      <AdminNavigation />

      {error ? (
        <FcEmptyState
          title="Analytics unavailable"
          description={
            error
          }
        />
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                'Players',
                data.totals
                  .players,
              ],
              [
                'Active Tournaments',
                data.totals
                  .activeTournaments,
              ],
              [
                'Completed Matches',
                data.totals
                  .completedMatches,
              ],
              [
                'Action Queue',
                data.totals
                  .pendingResults +
                data.totals
                  .openDisputes +
                data.totals
                  .pendingApplications,
              ],
            ].map(
              (
                item,
              ) => (
                <FcPanel
                  key={
                    item[0]
                  }
                  className="p-4 sm:p-5"
                >
                  <p className="text-2xl font-black">
                    {
                      item[1]
                    }
                  </p>

                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                    {
                      item[0]
                    }
                  </p>
                </FcPanel>
              ),
            )}
          </section>

          <section className="theme-panel rounded-2xl border p-5" aria-label="Admin workspace">
            <h2 className="fc-form-section-title">Pending review</h2>
            <p className="theme-secondary-text mt-1 text-sm">Choose the queue that needs your attention.</p>
            <div className="fc-admin-task-list mt-4 grid gap-3 sm:grid-cols-3">
              <Link className="theme-action-row rounded-xl border p-4" href="/admin/results"><strong className="block">{data.totals.pendingResults} results</strong><span className="theme-muted text-xs">Review submitted scores →</span></Link>
              <Link className="theme-action-row rounded-xl border p-4" href="/admin/disputes"><strong className="block">{data.totals.openDisputes} disputes</strong><span className="theme-muted text-xs">Review evidence and decisions →</span></Link>
              <Link className="theme-action-row rounded-xl border p-4" href="/admin/leagues"><strong className="block">{data.totals.pendingApplications} applications</strong><span className="theme-muted text-xs">Open managed leagues →</span></Link>
            </div>
            <p className="theme-muted mt-3 text-xs">Recently completed: {data.totals.completedMatches} matches · {data.totals.completedTournaments} tournaments</p>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <FcPanel className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                    Last 14 Days
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Verified Activity
                  </h2>
                </div>

                <div className="flex gap-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <span>
                    ● {
                      data
                        .trend
                        .label
                    }
                  </span>

                  <span className="text-emerald-400">
                    ● Confirmed Results
                  </span>
                </div>
              </div>

              <div className="mt-6 grid h-52 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5">
                {data.trend.days.map(
                  (
                    day,
                  ) => (
                    <div
                      key={
                        day.day
                      }
                      className="flex h-full min-w-0 flex-col justify-end gap-1"
                      title={
                        day.day +
                        ': ' +
                        day.newPlayers +
                        ' ' +
                        data.trend
                          .label
                          .toLowerCase() +
                        ', ' +
                        day.confirmedResults +
                        ' confirmed results'
                      }
                    >
                      <div
                        className="rounded-t bg-sky-400/55"
                        style={{
                          height:
                            Math.max(
                              day.newPlayers >
                                0
                                ? 5
                                : 0,
                              (
                                day.newPlayers /
                                maxTrend
                              ) *
                                100,
                            ) +
                            '%',
                        }}
                      />

                      <div
                        className="rounded-t bg-emerald-400/70"
                        style={{
                          height:
                            Math.max(
                              day.confirmedResults >
                                0
                                ? 5
                                : 0,
                              (
                                day.confirmedResults /
                                maxTrend
                              ) *
                                100,
                            ) +
                            '%',
                        }}
                      />

                      <span className="truncate text-center text-[8px] text-slate-700">
                        {
                          day.day.slice(
                            8,
                          )
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                    Operational Alerts
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Needs Attention
                  </h2>
                </div>

                <FcStatusBadge
                  label={
                    data.alerts
                      .total ===
                    0
                      ? 'Clear'
                      : data.alerts
                          .total +
                        ' Alert' +
                        (
                          data.alerts
                            .total ===
                          1
                            ? ''
                            : 's'
                        )
                  }
                  tone={
                    data.alerts
                      .total ===
                    0
                      ? 'emerald'
                      : 'amber'
                  }
                />
              </div>

              <div className="mt-5 space-y-2">
                {[
                  [
                    'Scheduled matches >2h late',
                    data.alerts
                      .staleScheduledMatches,
                  ],
                  [
                    'Pending results >30m',
                    data.alerts
                      .oldPendingResults,
                  ],
                  [
                    'Open disputes >24h',
                    data.alerts
                      .oldOpenDisputes,
                  ],
                ].map(
                  (
                    alert,
                  ) => (
                    <div
                      key={
                        alert[0]
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <span className="text-sm text-slate-400">
                        {
                          alert[0]
                        }
                      </span>

                      <span className="text-lg font-black">
                        {
                          alert[1]
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Competition Operations
              </p>

              <h2 className="mt-1 text-xl font-black">
                Current Load
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {Object.entries(
                  {
                    tournaments:
                      data.totals
                        .tournaments,
                    completed_tournaments:
                      data.totals
                        .completedTournaments,
                    scheduled_matches:
                      data.totals
                        .scheduledMatches,
                    live_matches:
                      data.totals
                        .liveMatches,
                    pending_results:
                      data.totals
                        .pendingResults,
                    open_disputes:
                      data.totals
                        .openDisputes,
                    pending_applications:
                      data.totals
                        .pendingApplications,
                    active_league_wars:
                      data.totals
                        .activeWars,
                    push_devices:
                      data.totals
                        .pushDevices,
                  },
                ).map(
                  (
                    [
                      label,
                      value,
                    ],
                  ) => (
                    <div
                      key={
                        label
                      }
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <p className="text-lg font-black">
                        {
                          value
                        }
                      </p>

                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                        {
                          humanize(
                            label,
                          )
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Managed Ecosystem
              </p>

              <h2 className="mt-1 text-xl font-black">
                League Overview
              </h2>

              <div className="mt-5 space-y-2">
                {data.topLeagues.map(
                  (
                    league,
                  ) => (
                    <div
                      key={
                        league.id
                      }
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <span className="theme-avatar grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border text-xs font-black">
                        {league.logoUrl ? (
                          <img
                            src={
                              league.logoUrl
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          league.name
                            .slice(
                              0,
                              2,
                            )
                            .toUpperCase()
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">
                          {
                            league.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            league.members
                          }{' '}
                          members ·{' '}
                          {
                            league.tournaments
                          }{' '}
                          tournaments
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          </section>

          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Audit Trail
              </p>

              <h2 className="mt-1 text-xl font-black">
                Recent Admin Activity
              </h2>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {data.recentAudit.map(
                (
                  event,
                ) => (
                  <div
                    key={
                      event.id
                    }
                    className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {
                          humanize(
                            event.action,
                          )
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {
                          event.actor
                            ?.name ??
                          'System'
                        }{' '}
                        ·{' '}
                        {
                          event.targetType
                        }
                      </p>
                    </div>

                    <span className="text-xs text-slate-600">
                      {new Date(
                        event.createdAt,
                      ).toLocaleString()}
                    </span>
                  </div>
                ),
              )}

              {data.recentAudit
                .length ===
                0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  No audit events in this admin scope yet.
                </p>
              ) : null}
            </div>
          </FcPanel>
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading admin analytics...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
