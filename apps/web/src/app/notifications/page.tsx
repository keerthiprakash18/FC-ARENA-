'use client';

import Link from 'next/link';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  eventAt: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationData {
  unreadCount: number;

  notifications:
    NotificationItem[];
}

function notificationIcon(
  type: string,
) {
  switch (type) {
    case 'LEAGUE_JOIN_REQUESTED':
      return '👥';

    case 'LEAGUE_REQUEST_APPROVED':
      return '✅';

    case 'LEAGUE_REQUEST_REJECTED':
      return '❌';

    case 'TOURNAMENT_CREATED':
      return '🏟️';

    case 'TOURNAMENT_REGISTRATION_OPENED':
      return '📝';

    case 'TOURNAMENT_APPLICATION_APPROVED':
      return '✅';

    case 'TOURNAMENT_APPLICATION_REJECTED':
      return '❌';

    case 'FIXTURE_CREATED':
      return '📅';

    case 'FIXTURE_CHANGED':
      return '🔄';

    case 'MATCH_REMINDER':
      return '⏰';

    case 'RESULT_SUBMITTED':
      return '📤';

    case 'RESULT_CONFIRMED':
      return '✅';

    case 'STATISTICS_UPDATED':
      return '📊';

    case 'TOURNAMENT_COMPLETED':
      return '🏁';

    case 'ACHIEVEMENT_RECEIVED':
      return '🏆';

    default:
      return '🔔';
  }
}

export default function NotificationsPage() {
  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [data, setData] =
    useState<NotificationData>({
      unreadCount: 0,
      notifications: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  async function loadNotifications(
    silent = false,
  ) {
    try {
      if (!silent) {
        setLoading(true);
      }

      const response =
        await authenticatedRequest<{
          success: true;

          data:
            NotificationData;

          error: null;
        }>('/notifications');

      setData(
        response.data,
      );

      setError('');
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load notifications.',
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        await loadNotifications();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load notifications.',
        );

        setLoading(false);
      }
    })();
  }, []);

  /*
   * Cross-device near-realtime refresh.
   * No manual page reload required.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void loadNotifications(
            true,
          );
        },
        5000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [user]);

  async function markAsRead(
    notificationId: string,
  ) {
    try {
      await authenticatedRequest(
        `/notifications/${notificationId}/read`,
        {
          method: 'POST',
        },
      );

      setData(
        (current) => ({
          unreadCount:
            Math.max(
              0,
              current.unreadCount -
                (
                  current.notifications.find(
                    (notification) =>
                      notification.id ===
                        notificationId &&
                      !notification.readAt,
                  )
                    ? 1
                    : 0
                ),
            ),

          notifications:
            current.notifications.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      readAt:
                        notification.readAt ??
                        new Date().toISOString(),
                    }
                  : notification,
            ),
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark notification as read.',
      );
    }
  }

  async function markAllAsRead() {
    setBusy(true);

    try {
      await authenticatedRequest(
        '/notifications/read-all',
        {
          method: 'POST',
        },
      );

      const now =
        new Date().toISOString();

      setData(
        (current) => ({
          unreadCount: 0,

          notifications:
            current.notifications.map(
              (notification) => ({
                ...notification,

                readAt:
                  notification.readAt ??
                  now,
              }),
            ),
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark all notifications as read.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    loading ||
    !user
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        {error ||
          'Loading Notifications...'}
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-7 md:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                FC ARENA Activity
              </p>

              <h1 className="mt-3 text-4xl font-black md:text-5xl">
                Notifications
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                {
                  data.unreadCount
                }{' '}
                unread notification
                {data.unreadCount ===
                1
                  ? ''
                  : 's'}
              </p>
            </div>

            {data.unreadCount >
            0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void markAllAsRead()
                }
                className="rounded-xl border border-sky-400/20 bg-sky-400/5 px-5 py-3 text-sm font-black text-sky-300 disabled:opacity-50"
              >
                Mark All Read
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          {data.notifications.map(
            (notification) => {
              const unread =
                !notification.readAt;

              const body = (
                <article
                  className={`rounded-[22px] border p-5 transition ${
                    unread
                      ? 'border-sky-400/25 bg-sky-400/[0.04]'
                      : 'border-white/10 bg-[#0a1018]'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl">
                      {notificationIcon(
                        notification.type,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black">
                          {
                            notification.title
                          }
                        </h2>

                        {unread ? (
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {
                          notification.message
                        }
                      </p>

                      <p className="mt-3 text-xs text-slate-600">
                        {new Date(
                          notification.eventAt,
                        ).toLocaleString()}
                      </p>
                    </div>

                    {unread ? (
                      <button
                        type="button"
                        onClick={(
                          event,
                        ) => {
                          event.preventDefault();

                          event.stopPropagation();

                          void markAsRead(
                            notification.id,
                          );
                        }}
                        className="h-fit shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-400 hover:text-white"
                      >
                        Read
                      </button>
                    ) : null}
                  </div>
                </article>
              );

              if (
                notification.href
              ) {
                return (
                  <Link
                    key={
                      notification.id
                    }
                    href={
                      notification.href
                    }
                    onClick={() => {
                      if (unread) {
                        void markAsRead(
                          notification.id,
                        );
                      }
                    }}
                  >
                    {body}
                  </Link>
                );
              }

              return (
                <div
                  key={
                    notification.id
                  }
                >
                  {body}
                </div>
              );
            },
          )}

          {data.notifications
            .length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-[#0a1018] p-12 text-center">
              <p className="text-5xl">
                🔔
              </p>

              <h2 className="mt-4 text-xl font-black">
                No notifications yet
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                League, Tournament, Match and Achievement activity will appear here.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}