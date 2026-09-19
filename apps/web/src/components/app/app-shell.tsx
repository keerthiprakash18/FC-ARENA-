'use client';

import Link from 'next/link';
import {
  usePathname,
  useRouter,
} from 'next/navigation';
import type {
  ReactNode,
} from 'react';
import {
  useState,
} from 'react';

import {
  logoutCurrentUser,
} from '@/lib/auth-client';

import {
  AppHeader,
} from './app-header';

import {
  BottomNavigation,
} from './bottom-navigation';

import {
  getActivePrimarySection,
  primaryNavigation,
  shouldShowPrimaryBottomNavigation,
} from './primary-navigation';


interface AppShellProps {
  children: ReactNode;
  playerName?: string | null;
  playerRole?: string | null;
}


const quickLinks = [
  {
    label: 'Join League',
    href: '/leagues',
    icon: '+',
  },
  {
    label: 'Create Tournament',
    href: '/tournaments',
    icon: '◇',
  },
  {
    label: 'View Profile',
    href: '/profile',
    icon: '◎',
  },
  {
    label: 'Help & Support',
    href: '/help',
    icon: '?',
  },
] as const;


export function AppShell({
  children,
  playerName,
  playerRole,
}: AppShellProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  const active =
    getActivePrimarySection(
      pathname,
    );

  const showBottomNavigation =
    shouldShowPrimaryBottomNavigation(
      pathname,
    );


  async function logout() {
    if (
      loggingOut
    ) {
      return;
    }

    setLoggingOut(
      true,
    );

    try {
      await logoutCurrentUser();

      router.replace(
        '/login',
      );

      router.refresh();
    } finally {
      setLoggingOut(
        false,
      );
    }
  }


  return (
    <div className="min-h-screen bg-[#071019] text-[#F8FAFC]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-[#203141] bg-[#0B1118] lg:flex lg:flex-col">
        <div className="border-b border-[#203141] px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#284154] bg-[#101923] text-base font-semibold text-[#19B7FF]">
              ♛
            </span>

            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-[#F8FAFC]">
                FC <span className="text-[#19B7FF]">ARENA</span>
              </p>

              <p className="mt-0.5 text-[10px] font-medium tracking-[0.06em] text-[#6F7B8A]">
                PLAY • COMPETE • BELONG
              </p>
            </div>
          </Link>
        </div>


        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 text-[11px] font-medium text-[#536273]">
            Main
          </p>

          <nav className="mt-2 space-y-1.5">
            {primaryNavigation.map(
              (
                item,
              ) => {
                const selected =
                  active ===
                  item.href;

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={`group relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition duration-200 ${
                      selected
                        ? 'bg-[linear-gradient(90deg,rgba(25,183,255,0.12),rgba(25,183,255,0.04))] text-[#F8FAFC]'
                        : 'text-[#A7B0BE] hover:bg-[#101923] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {selected ? (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#19B7FF]" />
                    ) : null}

                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl text-[17px] transition ${
                        selected
                          ? 'bg-[#19B7FF]/[0.08] text-[#19B7FF]'
                          : 'text-[#6F7B8A] group-hover:text-[#A7B0BE]'
                      }`}
                    >
                      {
                        item.icon
                      }
                    </span>

                    <span className="font-medium">
                      {
                        item.shortLabel
                      }
                    </span>
                  </Link>
                );
              },
            )}
          </nav>


          <div className="mx-3 my-5 h-px bg-[#203141]" />

          <p className="px-3 text-[11px] font-medium text-[#536273]">
            Quick Links
          </p>

          <div className="mt-2 space-y-1">
            {quickLinks.map(
              (
                item,
              ) => (
                <Link
                  key={
                    item.href +
                    item.label
                  }
                  href={
                    item.href
                  }
                  className="group flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm text-[#8290A0] transition hover:bg-[#101923] hover:text-[#F8FAFC]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#203141] bg-[#101923] text-xs text-[#19B7FF]">
                    {
                      item.icon
                    }
                  </span>

                  <span>
                    {
                      item.label
                    }
                  </span>
                </Link>
              ),
            )}
          </div>
        </div>


        <div className="border-t border-[#203141] p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[#101923]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#284154] bg-[#101923] text-xs font-semibold text-[#19B7FF]">
              {(playerName ||
                'FC')
                .slice(
                  0,
                  2,
                )
                .toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[#F8FAFC]">
                {playerName ||
                  'FC ARENA Player'}
              </span>

              <span className="mt-0.5 block text-xs text-[#6F7B8A]">
                {playerRole ||
                  'Player'}
              </span>
            </span>
          </Link>

          <div className="mt-1 flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-[10px] text-[#536273]">
              FC ARENA v1.0
            </span>

            <button
              type="button"
              disabled={
                loggingOut
              }
              onClick={() =>
                void logout()
              }
              className="text-xs font-medium text-[#8290A0] transition hover:text-red-300 disabled:opacity-50"
            >
              {loggingOut
                ? 'Signing out...'
                : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>


      <div className="lg:pl-[260px]">
        <AppHeader
          playerName={
            playerName
          }
          playerRole={
            playerRole
          }
        />

        <main
          className={`mx-auto min-h-[calc(100vh-4.25rem)] w-full max-w-[1440px] px-4 pt-5 sm:px-6 md:pt-6 lg:px-8 lg:pb-10 lg:pt-7 ${
            showBottomNavigation
              ? 'pb-28'
              : 'pb-8'
          }`}
        >
          {
            children
          }
        </main>
      </div>


      {showBottomNavigation ? (
        <BottomNavigation
          active={
            active
          }
        />
      ) : null}
    </div>
  );
}
