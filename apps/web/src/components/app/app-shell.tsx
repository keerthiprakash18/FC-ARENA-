'use client';

import Link from 'next/link';
import {
  usePathname,
  useRouter,
} from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { logoutCurrentUser } from '@/lib/auth-client';

interface AppShellProps {
  children: ReactNode;
  playerName?: string | null;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  mobile: boolean;
  desktop: boolean;
}

const navigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '⌂',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Leagues',
    href: '/leagues',
    icon: '◈',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Tournaments',
    href: '/tournaments',
    icon: '◇',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Fixtures',
    href: '/fixtures',
    icon: '≡',
    mobile: true,
    desktop: true,
  },
  {
    label: 'Matches',
    href: '/matches',
    icon: '⚔',
    mobile: false,
    desktop: true,
  },
  {
    label: 'Career',
    href: '/career',
    icon: '★',
    mobile: false,
    desktop: true,
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: '●',
    mobile: false,
    desktop: true,
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: '◎',
    mobile: false,
    desktop: true,
  },
  {
    label: 'More',
    href: '/more',
    icon: '•••',
    mobile: true,
    desktop: false,
  },
];

function isActive(
  pathname: string,
  item: NavigationItem,
) {
  if (item.href === '/dashboard') {
    return pathname === '/dashboard';
  }

  if (item.href === '/more') {
    return (
      pathname === '/more' ||
      pathname.startsWith('/matches') ||
      pathname.startsWith('/career') ||
      pathname.startsWith('/notifications') ||
      pathname.startsWith('/profile')
    );
  }

  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}

export function AppShell({
  children,
  playerName,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] =
    useState(false);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logoutCurrentUser();

      router.replace('/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#05080d] text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-white/10 bg-[#070b11]/95 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <Link href="/dashboard" className="block">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-sky-400">
              Football Esports
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight">
              FC ARENA
            </h1>
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navigation
            .filter((item) => item.desktop)
            .map((item) => {
              const active = isActive(
                pathname,
                item,
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll
                  className={`flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    active
                      ? 'border border-sky-400/20 bg-sky-400/10 text-sky-300'
                      : 'border border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl ${
                      active
                        ? 'bg-sky-400 text-[#041019]'
                        : 'bg-white/[0.04]'
                    }`}
                  >
                    {item.icon}
                  </span>

                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Signed in as
            </p>

            <p className="mt-1 truncate font-black">
              {playerName || 'FC ARENA Player'}
            </p>
          </div>

          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="w-full rounded-xl border border-red-400/15 bg-red-400/[0.03] px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
          >
            {loggingOut
              ? 'Signing out...'
              : 'Sign Out'}
          </button>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05080d]/90 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link href="/dashboard">
              <p className="text-lg font-black">
                FC{' '}
                <span className="text-sky-400">
                  ARENA
                </span>
              </p>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/notifications"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400"
                aria-label="Notifications"
              >
                ●
              </Link>

              <Link
                href="/profile"
                className="grid h-10 max-w-[150px] place-items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-black"
              >
                <span className="truncate">
                  {playerName || 'Player'}
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-screen w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 md:pt-7 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#070b11]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {navigation
            .filter((item) => item.mobile)
            .map((item) => {
              const active = isActive(
                pathname,
                item,
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll
                  className={`flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-[9px] font-black transition ${
                    active
                      ? 'text-sky-300'
                      : 'text-slate-600'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-xl text-sm ${
                      active
                        ? 'bg-sky-400 text-[#041019]'
                        : 'bg-white/[0.03]'
                    }`}
                  >
                    {item.icon}
                  </span>

                  <span className="max-w-full truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
  );
}
