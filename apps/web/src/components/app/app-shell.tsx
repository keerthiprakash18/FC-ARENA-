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
    <div className="min-h-screen bg-[#030812] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-sky-500/[0.07] blur-3xl" />
        <div className="absolute right-[-12rem] top-[18%] h-[26rem] w-[26rem] rounded-full bg-blue-700/[0.05] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[280px] bg-[linear-gradient(180deg,rgba(0,167,255,0.05),transparent)]" />
      </div>


      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r border-white/[0.08] bg-[#050b14]/95 backdrop-blur-2xl lg:flex lg:flex-col">
        <div className="border-b border-white/[0.08] px-6 py-6">
          <Link
            href="/dashboard"
            className="block"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-400/25 bg-sky-400/[0.08] text-xl text-sky-300">
                ♛
              </span>

              <div>
                <p className="font-['Rajdhani','Space_Grotesk',sans-serif] text-2xl font-black leading-none tracking-[-0.02em]">
                  FC <span className="text-sky-400">ARENA</span>
                </p>

                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.28em] text-slate-600">
                  Play · Compete · Belong
                </p>
              </div>
            </div>
          </Link>
        </div>


        <nav className="flex-1 space-y-2 p-4">
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
                  className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition duration-200 ${
                    selected
                      ? 'border-sky-400/25 bg-sky-400/[0.09] text-white shadow-[0_0_26px_rgba(14,165,233,0.07)]'
                      : 'border-transparent text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl border text-sm font-black transition ${
                      selected
                        ? 'border-sky-400/20 bg-sky-400 text-[#031019]'
                        : 'border-white/[0.06] bg-white/[0.025] text-slate-500 group-hover:text-sky-300'
                    }`}
                  >
                    {
                      item.icon
                    }
                  </span>

                  <span className="font-['Rajdhani','Space_Grotesk',sans-serif] text-sm font-black tracking-[0.08em]">
                    {
                      item.label
                    }
                  </span>
                </Link>
              );
            },
          )}
        </nav>


        <div className="border-t border-white/[0.08] p-4">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-sky-400/20"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/[0.06] text-sm font-black text-sky-300">
              {(playerName ||
                'FC')
                .slice(
                  0,
                  2,
                )
                .toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                Signed in
              </span>

              <span className="mt-0.5 block truncate text-sm font-black">
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
            className="mt-2 w-full rounded-xl border border-red-400/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-red-300/70 transition hover:border-red-400/25 hover:bg-red-400/[0.04] hover:text-red-300 disabled:opacity-50"
          >
            {loggingOut
              ? 'Signing Out...'
              : 'Sign Out'}
          </button>
        </div>
      </aside>


      <div className="relative z-10 lg:pl-[252px]">
        <AppHeader
          playerName={
            playerName
          }
        />

        <main
          className={`mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1600px] px-4 pt-5 sm:px-6 md:pt-7 lg:px-8 lg:pb-10 lg:pt-8 ${
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
