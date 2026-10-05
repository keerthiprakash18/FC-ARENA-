'use client';

import {
  useEffect,
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

interface BackupView {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt: string;
  sizeBytes: string | null;
  checksumSha256: string | null;
  storageKind: string;
  retentionDays: number;
  sourceHost: string | null;
  errorMessage: string | null;
}

interface SystemData {
  status: 'HEALTHY' | 'DEGRADED';
  checkedAt: string;

  runtime: {
    environment: string;
    node: string;
    uptimeSeconds: number;

    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
  };

  database: {
    connected: boolean;
    latencyMs: number;
  };

  auth: {
    activeSessions: number;
  };

  push: {
    configured: boolean;
    devices: number;
    pendingDeliveries: number;
    failedDeliveries: number;
  };

  moderation: {
    openDisputes: number;
    pendingResults: number;
  };

  backup: {
    reportingConfigured: boolean;
    healthy: boolean;
    ageHours: number | null;
    latest: BackupView | null;
    latestSuccess: BackupView | null;
    latestFailure: BackupView | null;
  };
}

function formatUptime(
  seconds:
    number,
) {
  const days =
    Math.floor(
      seconds /
      86400,
    );

  const hours =
    Math.floor(
      (
        seconds %
        86400
      ) /
      3600,
    );

  const minutes =
    Math.floor(
      (
        seconds %
        3600
      ) /
      60,
    );

  if (
    days >
    0
  ) {
    return (
      days +
      'd ' +
      hours +
      'h'
    );
  }

  return (
    hours +
    'h ' +
    minutes +
    'm'
  );
}

function formatBytes(
  raw:
    string | null,
) {
  if (
    !raw
  ) {
    return '—';
  }

  const bytes =
    Number(
      raw,
    );

  if (
    !Number.isFinite(
      bytes,
    )
  ) {
    return raw;
  }

  if (
    bytes >=
    1024 *
      1024 *
      1024
  ) {
    return (
      (
        bytes /
        1024 /
        1024 /
        1024
      ).toFixed(
        2,
      ) +
      ' GB'
    );
  }

  if (
    bytes >=
    1024 *
      1024
  ) {
    return (
      (
        bytes /
        1024 /
        1024
      ).toFixed(
        1,
      ) +
      ' MB'
    );
  }

  return (
    Math.round(
      bytes /
      1024,
    ) +
    ' KB'
  );
}

export default function AdminSystemPage() {
  const [
    data,
    setData,
  ] =
    useState<SystemData | null>(
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
        await authenticatedRequest<{
          success: true;
          data: SystemData;
          error: null;
        }>('/admin/ops/system');

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
          : 'Unable to load system status.',
      );
    }
  }

  useEffect(() => {
    void load();

    const timer =
      window.setInterval(
        () => {
          void load();
        },
        30_000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Super Admin"
      title="System Monitoring"
      subtitle="API runtime, database latency, push delivery, moderation queues and production backup health."
      backHref="/more"
      backLabel="More"
      action={
        data ? (
          <FcStatusBadge
            label={
              data.status
            }
            tone={
              data.status ===
              'HEALTHY'
                ? 'emerald'
                : 'amber'
            }
          />
        ) : null
      }
    >
      <AdminNavigation />

      {error ? (
        <FcEmptyState
          title="System status unavailable"
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
                'Database',
                data.database
                  .connected
                  ? 'Connected'
                  : 'Offline',
                data.database
                  .connected
                  ? 'emerald'
                  : 'red',
              ],
              [
                'DB Latency',
                data.database
                  .latencyMs +
                  ' ms',
                data.database
                  .latencyMs <
                  250
                  ? 'emerald'
                  : 'amber',
              ],
              [
                'API Uptime',
                formatUptime(
                  data.runtime
                    .uptimeSeconds,
                ),
                'cyan',
              ],
              [
                'Backup',
                data.backup
                  .healthy
                  ? 'Healthy'
                  : 'Attention',
                data.backup
                  .healthy
                  ? 'emerald'
                  : 'amber',
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
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                    {
                      item[0]
                    }
                  </p>

                  <div className="mt-2">
                    <FcStatusBadge
                      label={
                        String(
                          item[1],
                        )
                      }
                      tone={
                        item[2] as
                          | 'emerald'
                          | 'red'
                          | 'cyan'
                          | 'amber'
                      }
                    />
                  </div>
                </FcPanel>
              ),
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Runtime
              </p>

              <h2 className="mt-1 text-xl font-black">
                API Process
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  [
                    'Environment',
                    data.runtime
                      .environment,
                  ],
                  [
                    'Node',
                    data.runtime
                      .node,
                  ],
                  [
                    'RSS Memory',
                    data.runtime
                      .memory
                      .rssMb +
                      ' MB',
                  ],
                  [
                    'Heap',
                    data.runtime
                      .memory
                      .heapUsedMb +
                      ' / ' +
                      data.runtime
                        .memory
                        .heapTotalMb +
                      ' MB',
                  ],
                  [
                    'Active Sessions',
                    data.auth
                      .activeSessions,
                  ],
                  [
                    'Checked',
                    new Date(
                      data.checkedAt,
                    ).toLocaleTimeString(),
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
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                        {
                          item[0]
                        }
                      </p>

                      <p className="mt-1 break-words text-sm font-black">
                        {
                          item[1]
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Push Delivery
              </p>

              <h2 className="mt-1 text-xl font-black">
                Notification Worker
              </h2>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <span className="text-sm text-slate-400">
                  Firebase Admin
                </span>

                <FcStatusBadge
                  label={
                    data.push
                      .configured
                      ? 'Configured'
                      : 'Disabled'
                  }
                  tone={
                    data.push
                      .configured
                      ? 'emerald'
                      : 'amber'
                  }
                />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  [
                    'Devices',
                    data.push
                      .devices,
                  ],
                  [
                    'Pending',
                    data.push
                      .pendingDeliveries,
                  ],
                  [
                    'Failed',
                    data.push
                      .failedDeliveries,
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
                      <p className="text-xl font-black">
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

              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <p className="text-xl font-black">
                    {
                      data
                        .moderation
                        .pendingResults
                    }
                  </p>

                  <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Pending Results
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <p className="text-xl font-black">
                    {
                      data
                        .moderation
                        .openDisputes
                    }
                  </p>

                  <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Open Disputes
                  </p>
                </div>
              </div>
            </FcPanel>
          </section>

          <FcPanel className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Disaster Recovery
                </p>

                <h2 className="mt-1 text-xl font-black">
                  PostgreSQL Backup Health
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Daily backup runner validates the pg_dump archive before reporting metadata. Database contents never pass through this monitoring endpoint.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <FcStatusBadge
                  label={
                    data.backup
                      .reportingConfigured
                      ? 'Reporter Configured'
                      : 'Reporter Not Configured'
                  }
                  tone={
                    data.backup
                      .reportingConfigured
                      ? 'cyan'
                      : 'amber'
                  }
                />

                <FcStatusBadge
                  label={
                    data.backup
                      .healthy
                      ? 'Fresh Backup'
                      : 'Backup Attention'
                  }
                  tone={
                    data.backup
                      .healthy
                      ? 'emerald'
                      : 'amber'
                  }
                />
              </div>
            </div>

            {data.backup
              .latestSuccess ? (
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Last Success
                  </p>

                  <p className="mt-2 text-sm font-black">
                    {new Date(
                      data.backup
                        .latestSuccess
                        .completedAt,
                    ).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Backup Age
                  </p>

                  <p className="mt-2 text-sm font-black">
                    {
                      data.backup
                        .ageHours ===
                      null
                        ? '—'
                        : data.backup
                            .ageHours +
                          ' h'
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Size
                  </p>

                  <p className="mt-2 text-sm font-black">
                    {
                      formatBytes(
                        data.backup
                          .latestSuccess
                          .sizeBytes,
                      )
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                    Retention
                  </p>

                  <p className="mt-2 text-sm font-black">
                    {
                      data.backup
                        .latestSuccess
                        .retentionDays
                    }{' '}
                    days
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-amber-400/20 p-5 text-sm text-slate-500">
                No successful production backup has reported yet. Configure the backup runner before launch.
              </div>
            )}

            {data.backup
              .latestFailure ? (
              <details className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-black text-red-300">
                  Latest backup failure
                </summary>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {new Date(
                    data.backup
                      .latestFailure
                      .completedAt,
                  ).toLocaleString()}
                  {' · '}
                  {
                    data.backup
                      .latestFailure
                      .errorMessage ??
                    'No failure detail was reported.'
                  }
                </p>
              </details>
            ) : null}
          </FcPanel>
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Checking production services...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
