"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";

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

type NotificationFilter = "inbox" | "results" | "actions" | "history";

const resultTypes = [
  "RESULT_SUBMITTED",
  "RESULT_REJECTED",
  "RESULT_CONFIRMED",
  "STATISTICS_UPDATED",
];
const actionTypes = [
  "MATCH_REMINDER",
  "MATCH_READY",
  "RESULT_SUBMITTED",
  "RESULT_REJECTED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "LEAGUE_JOIN_REQUESTED",
  "FAIR_PLAY_UPDATED",
];

function notificationIcon(type: string) {
  switch (type) {
    case "LEAGUE_JOIN_REQUESTED":
      return "👥";
    case "LEAGUE_REQUEST_APPROVED":
      return "✓";
    case "LEAGUE_REQUEST_REJECTED":
      return "×";
    case "TOURNAMENT_CREATED":
      return "🏆";
    case "TOURNAMENT_REGISTRATION_OPENED":
      return "＋";
    case "TOURNAMENT_APPLICATION_APPROVED":
      return "✓";
    case "TOURNAMENT_APPLICATION_REJECTED":
      return "×";
    case "FIXTURE_CREATED":
      return "⚽";
    case "FIXTURE_CHANGED":
      return "↻";
    case "MATCH_REMINDER":
      return "⏱";
    case "MATCH_READY":
      return "⚡";
    case "RESULT_SUBMITTED":
      return "↑";
    case "RESULT_REJECTED":
      return "!";
    case "RESULT_CONFIRMED":
      return "✓";
    case "DISPUTE_OPENED":
      return "⚠";
    case "DISPUTE_RESOLVED":
      return "⚖";
    case "STATISTICS_UPDATED":
      return "▥";
    case "TOURNAMENT_COMPLETED":
      return "★";
    case "ACHIEVEMENT_RECEIVED":
      return "🏅";
    case "FAIR_PLAY_UPDATED":
      return "🛡";
    default:
      return "●";
  }
}

function formatEventTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();

  const minute = 60 * 1000;

  const hour = 60 * minute;

  const day = 24 * hour;

  if (diff < minute) {
    return "Just now";
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
  window.dispatchEvent(new Event("fc-arena:notifications-changed"));
}

export default function NotificationsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [data, setData] = useState<NotificationData>({
    unreadCount: 0,
    notifications: [],
  });

  const [filter, setFilter] = useState<NotificationFilter>("inbox");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const requestVersion = useRef(0);
  const mutationPending = useRef(false);
  const invalidateRequests = useCallback(() => {
    requestVersion.current++;
  }, []);

  const loadNotifications = useCallback(
    async (silent = false) => {
      if (
        mutationPending.current ||
        (silent && document.visibilityState === "hidden")
      )
        return;
      const version = ++requestVersion.current;
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await authenticatedRequest<{
          success: true;
          data: NotificationData;
          error: null;
        }>(`/notifications?view=${filter}`);

        if (version !== requestVersion.current) return;
        // Keep tabs correct while the web and API releases roll out separately.
        setData({
          ...response.data,
          notifications: response.data.notifications.filter((notification) => {
            if (filter === "history") return Boolean(notification.readAt);
            if (notification.readAt) return false;
            if (filter === "results")
              return resultTypes.includes(notification.type);
            if (filter === "actions")
              return actionTypes.includes(notification.type);
            return true;
          }),
        });

        setError("");
      } catch (err) {
        if (version !== requestVersion.current) return;
        setError(
          err instanceof Error ? err.message : "Unable to load notifications.",
        );
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filter],
  );

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();

        setUser(current);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load notifications.",
        );

        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadNotifications();
    const timer = window.setInterval(
      () => void loadNotifications(true),
      30_000,
    );
    return () => {
      window.clearInterval(timer);
      invalidateRequests();
    };
  }, [user, loadNotifications, invalidateRequests]);

  const visibleNotifications = data.notifications;

  async function markAsRead(notificationId: string) {
    const currentNotification = data.notifications.find(
      (notification) => notification.id === notificationId,
    );

    if (
      mutationPending.current ||
      !currentNotification ||
      currentNotification.readAt
    ) {
      return;
    }

    mutationPending.current = true;
    requestVersion.current++;
    setBusy(true);
    try {
      await authenticatedRequest(`/notifications/${notificationId}/read`, {
        method: "POST",
      });

      setData((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),

        notifications: current.notifications.filter(
          (notification) => notification.id !== notificationId,
        ),
      }));

      notifyBellChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to clear notification.",
      );
    } finally {
      requestVersion.current++;
      mutationPending.current = false;
      setBusy(false);
      setRefreshing(false);
    }
  }

  async function markAllAsRead() {
    if (mutationPending.current || data.unreadCount === 0) {
      return;
    }

    mutationPending.current = true;
    requestVersion.current++;
    setBusy(true);

    try {
      await authenticatedRequest("/notifications/read-all", {
        method: "POST",
      });

      setData((current) => ({
        unreadCount: 0,
        notifications: filter === "history" ? current.notifications : [],
      }));

      notifyBellChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark all notifications as read.",
      );
    } finally {
      requestVersion.current++;
      mutationPending.current = false;
      setBusy(false);
      setRefreshing(false);
    }
  }

  if (loading || (!user && !error)) {
    return <FcLoadingScreen label="Loading Notifications..." />;
  }

  const playerName =
    user?.player?.identity?.inGameName || user?.fullName || "Player";

  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="FC ARENA Activity"
          title="Notifications"
          subtitle="Results, reminders and league activity. Cleared notifications stay in History."
          action={
            data.unreadCount > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markAllAsRead()}
                className="theme-primary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold transition disabled:opacity-50"
              >
                {busy ? "Updating..." : "Clear all"}
              </button>
            ) : (
              <FcStatusBadge label="All caught up" tone="emerald" />
            )
          }
        />

        {error ? (
          <FcErrorState
            message={error}
            busy={refreshing}
            onRetry={() => {
              if (!user) window.location.reload();
              else void loadNotifications(true);
            }}
          />
        ) : null}

        <FcPanel className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["inbox", `Inbox (${data.unreadCount})`],
                  ["results", "Results"],
                  ["actions", "Needs attention"],
                  ["history", "History"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  disabled={busy}
                  onClick={() => setFilter(value)}
                  className={`${filter === value ? "theme-primary-button" : "theme-secondary-button"} min-h-11 rounded-[10px] border px-4 text-sm font-semibold disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={refreshing || busy}
              onClick={() => void loadNotifications(true)}
              className="theme-secondary-button min-h-10 rounded-[10px] border px-4 text-sm font-medium disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </FcPanel>

        <p className="theme-muted text-sm" role="status">
          {filter === "results"
            ? "Uploaded, confirmed and rejected results, plus standings updates."
            : filter === "history"
              ? "Previously opened or cleared notifications. Your match results remain available."
              : "Open a notification or clear it to move it to History."}
        </p>
        <section
          className="space-y-3"
          aria-label={`${filter} notifications`}
          aria-busy={refreshing}
        >
          {visibleNotifications.map((notification) => {
            const unread = !notification.readAt;

            const content = (
              <article
                className={
                  unread
                    ? "theme-action-row rounded-2xl border p-4 transition sm:p-5"
                    : "theme-panel rounded-2xl border p-4 opacity-80 transition sm:p-5"
                }
              >
                <div className="flex items-start gap-4">
                  <span className="theme-soft-accent grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-base font-semibold">
                    {notificationIcon(notification.type)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="theme-text fc-display text-[15px] font-semibold sm:text-base">
                        {notification.href ? (
                          <Link
                            href={notification.href}
                            onClick={() => {
                              if (unread) void markAsRead(notification.id);
                            }}
                            className="hover:underline focus-visible:underline"
                          >
                            {notification.title}
                          </Link>
                        ) : (
                          notification.title
                        )}
                      </h2>

                      {unread ? (
                        <span className="theme-tone-primary inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                          New
                        </span>
                      ) : null}
                    </div>

                    <p className="theme-secondary-text mt-1.5 text-sm leading-6">
                      {notification.message}
                    </p>

                    <div className="theme-muted mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span>{formatEventTime(notification.eventAt)}</span>

                      <span>•</span>
                      <span>
                        {notification.type.startsWith("RESULT_") ||
                        notification.type === "STATISTICS_UPDATED"
                          ? "Results"
                          : "Activity"}
                      </span>
                    </div>
                  </div>

                  {unread ? (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Clear ${notification.title}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        void markAsRead(notification.id);
                      }}
                      className="theme-secondary-button min-h-11 shrink-0 rounded-[9px] border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </article>
            );

            return <div key={notification.id}>{content}</div>;
          })}

          {visibleNotifications.length === 0 ? (
            <FcEmptyState
              title={
                filter === "history"
                  ? "No notification history"
                  : filter === "results"
                    ? "No new result updates"
                    : filter === "actions"
                      ? "Nothing needs attention"
                      : "All caught up"
              }
              description={
                filter === "history"
                  ? "Notifications you open or clear will appear here."
                  : "New activity will appear here. Cleared notifications are in History."
              }
            />
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
