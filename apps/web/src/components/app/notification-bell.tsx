'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface NotificationSummaryResponse {
  success: true;
  data: {
    unreadCount: number;
  };
  error: null;
}

export function NotificationBell() {
  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const loadUnreadCount =
    useCallback(
      async () => {
        try {
          const response =
            await authenticatedRequest<NotificationSummaryResponse>(
              '/notifications',
            );

          setUnreadCount(
            response.data.unreadCount,
          );
        } catch {
          // Notifications must never block or crash the main app shell.
        }
      },
      [],
    );

  useEffect(() => {
    void loadUnreadCount();

    const timer =
      window.setInterval(
        () => {
          void loadUnreadCount();
        },
        60_000,
      );

    const refresh = () => {
      void loadUnreadCount();
    };

    window.addEventListener(
      'focus',
      refresh,
    );

    window.addEventListener(
      'fc-arena:notifications-changed',
      refresh,
    );

    return () => {
      window.clearInterval(
        timer,
      );

      window.removeEventListener(
        'focus',
        refresh,
      );

      window.removeEventListener(
        'fc-arena:notifications-changed',
        refresh,
      );
    };
  }, [
    loadUnreadCount,
  ]);

  return (
    <Link
      href="/notifications"
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
      title={
        unreadCount > 0
          ? `${unreadCount} unread notifications`
          : 'Notifications'
      }
      className="theme-header-icon relative grid h-11 w-11 place-items-center rounded-xl border border-transparent transition duration-200"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[21px] w-[21px]"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>

      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-[19px] min-w-[19px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
          {unreadCount > 99
            ? '99+'
            : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
