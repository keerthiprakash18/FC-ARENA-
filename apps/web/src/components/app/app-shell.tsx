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
}


export function AppShell({
  children,
  playerName,
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
    <div className="min-h-screen bg-[#0B0F14] text-[#F8FAFC]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] border-r border-[#253140] bg-[#0E141B] lg:flex lg:flex-col">
        <div className="border-b border-[#253140] px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#2B3948] bg-[#151C26] text-base text-[#38BDF8]">
              ♛
            </span>

            <div>
              <p className="text-lg font-semibold tracking-[-0.02em] text-[#F8FAFC]">
                FC <span className="text-[#38BDF8]">ARENA</span>
              </p>

              <p className="mt-0.5 text-[10px] font-medium text-[#6F7B8A]">
                Play · Compete · Belong
              </p>
            </div>
          </Link>
        </div>


        <nav className="flex-1 space-y-1.5 p-3">
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
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200 ${
                    selected
                      ? 'bg-sky-400/[0.10] text-[#F8FAFC]'
                      : 'text-[#A7B0BE] hover:bg-[#151C26] hover:text-[#F8FAFC]'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg text-sm transition ${
                      selected
                        ? 'text-[#38BDF8]'
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


        <div className="border-t border-[#253140] p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[#151C26]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#2B3948] bg-[#151C26] text-xs font-semibold text-[#38BDF8]">
              {(playerName ||
                'FC')
                .slice(
                  0,
                  2,
                )
                .toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-xs text-[#6F7B8A]">
                Signed in
              </span>

              <span className="mt-0.5 block truncate text-sm font-medium text-[#F8FAFC]">
                {playerName ||
                  'FC ARENA Player'}
              </span>
            </span>
          </Link>

          <button
            type="button"
            disabled={
              loggingOut
            }
            onClick={() =>
              void logout()
            }
            className="mt-1 w-full rounded-[10px] border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-50"
          >
            {loggingOut
              ? 'Signing out...'
              : 'Sign out'}
          </button>
        </div>
      </aside>


      <div className="lg:pl-[232px]">
        <AppHeader
          playerName={
            playerName
          }
        />

        <main
          className={`mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1280px] px-4 pt-5 sm:px-6 md:pt-6 lg:px-8 lg:pb-10 lg:pt-7 ${
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
