'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

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
  notifications: NotificationItem[];
}

type NotificationFilter =
  | 'all'
  | 'unread';

function notificationIcon(
  type: string,
) {
  switch (type) {
    case 'LEAGUE_JOIN_REQUESTED':
      return '👥';
    case 'LEAGUE_REQUEST_APPROVED':
      return '✓';
    case 'LEAGUE_REQUEST_REJECTED':
      return '×';
    case 'TOURNAMENT_CREATED':
      return '🏆';
    case 'TOURNAMENT_REGISTRATION_OPENED':
      return '＋';
    case 'TOURNAMENT_APPLICATION_APPROVED':
      return '✓';
    case 'TOURNAMENT_APPLICATION_REJECTED':
      return '×';
    case 'FIXTURE_CREATED':
      return '⚽';
    case 'FIXTURE_CHANGED':
      return '↻';
    case 'MATCH_REMINDER':
      return '⏱';
    case 'RESULT_SUBMITTED':
      return '↑';
    case 'RESULT_CONFIRMED':
      return '✓';
    case 'STATISTICS_UPDATED':
      return '▥';
    case 'TOURNAMENT_COMPLETED':
      return '★';
    case 'ACHIEVEMENT_RECEIVED':
      return '🏅';
    default:
      return '●';
  }
}

function formatEventTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const diff =
    Date.now() -
    date.getTime();

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  if (diff < minute) {
    return 'Just now';
  }

  if (diff < hour) {
    return `${Math.floor(diff / minute)}m ago`;
  }

  if (diff < day) {
    return `${Math.floor(diff / hour)}h ago`;
  }

  if (diff < 7 * day) {
    return `${Math.floor(diff / day)}d ago`;
  }

  return date.toLocaleString();
}

function notifyBellChanged() {
  window.dispatchEvent(
    new Event(
      'fc-arena:notifications-changed',
    ),
  );
}

export default function NotificationsPage() {
  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    data,
    setData,
  ] =
    useState<NotificationData>({
      unreadCount: 0,
      notifications: [],
    });

  const [
    filter,
    setFilter,
  ] =
    useState<NotificationFilter>(
      'all',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

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

  async function loadNotifications(
    silent = false,
  ) {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        await authenticatedRequest<{
          success: true;
          data: NotificationData;
          error: null;
        }>('/notifications');

      setData(
        response.data,
      );

      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load notifications.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

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
        30_000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    user,
  ]);

  const visibleNotifications =
    useMemo(
      () =>
        filter === 'unread'
          ? data.notifications.filter(
              (notification) =>
                !notification.readAt,
            )
          : data.notifications,
      [
        data.notifications,
        filter,
      ],
    );

  async function markAsRead(
    notificationId: string,
  ) {
    const currentNotification =
      data.notifications.find(
        (notification) =>
          notification.id ===
          notificationId,
      );

    if (
      !currentNotification ||
      currentNotification.readAt
    ) {
      return;
    }

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
                1,
            ),

          notifications:
            current.notifications.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      readAt:
                        new Date().toISOString(),
                    }
                  : notification,
            ),
        }),
      );

      notifyBellChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark notification as read.',
      );
    }
  }

  async function markAllAsRead() {
    if (
      busy ||
      data.unreadCount === 0
    ) {
      return;
    }

    setBusy(
      true,
    );

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

      notifyBellChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark all notifications as read.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    loading ||
    !user
  ) {
    return (
      <FcLoadingScreen
        label="Loading Notifications..."
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
    >
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="FC ARENA Activity"
          title="Notifications"
          subtitle="Match alerts, league requests, tournament activity, result updates and achievements in one place."
          action={
            data.unreadCount > 0 ? (
              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void markAllAsRead()
                }
                className="theme-primary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold transition disabled:opacity-50"
              >
                {busy
                  ? 'Updating...'
                  : 'Mark all read'}
              </button>
            ) : (
              <FcStatusBadge
                label="All caught up"
                tone="emerald"
              />
            )
          }
        />

        {error ? (
          <FcErrorState
            message={
              error
            }
          />
        ) : null}

        <FcPanel className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilter(
                    'all',
                  )
                }
                className={
                  filter === 'all'
                    ? 'theme-primary-button min-h-10 rounded-[10px] px-4 text-sm font-semibold'
                    : 'theme-secondary-button min-h-10 rounded-[10px] border px-4 text-sm font-medium'
                }
              >
                All ({data.notifications.length})
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    'unread',
                  )
                }
                className={
                  filter === 'unread'
                    ? 'theme-primary-button min-h-10 rounded-[10px] px-4 text-sm font-semibold'
                    : 'theme-secondary-button min-h-10 rounded-[10px] border px-4 text-sm font-medium'
                }
              >
                Unread ({data.unreadCount})
              </button>
            </div>

            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadNotifications(
                  true,
                )
              }
              className="theme-secondary-button min-h-10 rounded-[10px] border px-4 text-sm font-medium disabled:opacity-50"
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </FcPanel>

        <section className="space-y-3">
          {visibleNotifications.map(
            (
              notification,
            ) => {
              const unread =
                !notification.readAt;

              const content = (
                <article
                  className={
                    unread
                      ? 'theme-action-row rounded-2xl border p-4 transition sm:p-5'
                      : 'theme-panel rounded-2xl border p-4 opacity-80 transition sm:p-5'
                  }
                >
                  <div className="flex items-start gap-4">
                    <span className="theme-soft-accent grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-base font-semibold">
                      {notificationIcon(
                        notification.type,
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="theme-text fc-display text-[15px] font-semibold sm:text-base">
                          {
                            notification.title
                          }
                        </h2>

                        {unread ? (
                          <span className="theme-tone-primary inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                            New
                          </span>
                        ) : null}
                      </div>

                      <p className="theme-secondary-text mt-1.5 text-sm leading-6">
                        {
                          notification.message
                        }
                      </p>

                      <div className="theme-muted mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span>
                          {formatEventTime(
                            notification.eventAt,
                          )}
                        </span>

                        {notification.entityType ? (
                          <>
                            <span>
                              •
                            </span>

                            <span>
                              {
                                notification.entityType
                              }
                            </span>
                          </>
                        ) : null}
                      </div>
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
                        className="theme-secondary-button shrink-0 rounded-[9px] border px-3 py-2 text-xs font-semibold"
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
                    className="block"
                  >
                    {
                      content
                    }
                  </Link>
                );
              }

              return (
                <div
                  key={
                    notification.id
                  }
                >
                  {
                    content
                  }
                </div>
              );
            },
          )}

          {visibleNotifications.length ===
          0 ? (
            <FcEmptyState
              title={
                filter === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'
              }
              description={
                filter === 'unread'
                  ? 'You are fully caught up. New FC ARENA activity will appear here.'
                  : 'League, tournament, fixture, match result and achievement activity will appear here.'
              }
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
