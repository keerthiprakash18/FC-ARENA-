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


type SidebarIconName =
  | 'home'
  | 'league'
  | 'tournament'
  | 'fixtures'
  | 'more'
  | 'join'
  | 'create'
  | 'profile'
  | 'help'
  | 'chevron'
  | 'logout';


const quickLinks = [
  {
    label: 'Join League',
    href: '/leagues',
    icon: 'join' as const,
  },
  {
    label: 'Create Tournament',
    href: '/tournaments',
    icon: 'create' as const,
  },
  {
    label: 'View Profile',
    href: '/profile',
    icon: 'profile' as const,
  },
  {
    label: 'Help & Support',
    href: '/help',
    icon: 'help' as const,
  },
] as const;


function SidebarIcon({
  name,
  className = 'h-[22px] w-[22px]',
}: {
  name:
    SidebarIconName;
  className?: string;
}) {
  if (
    name ===
    'home'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="m3 10.5 9-7 9 7" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (
    name ===
    'league'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M12 3 4.5 6v5.2c0 4.6 3.1 8 7.5 9.8 4.4-1.8 7.5-5.2 7.5-9.8V6L12 3Z" />
        <path d="M8.5 10.5h7" />
        <path d="M10 7.8h4v5.4h-4z" />
      </svg>
    );
  }

  if (
    name ===
    'tournament'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M8 4h8v3.3c0 3.3-1.8 5.7-4 6.7-2.2-1-4-3.4-4-6.7V4Z" />
        <path d="M8 6H4.5v1.3c0 2.4 1.5 4.2 4.2 4.7" />
        <path d="M16 6h3.5v1.3c0 2.4-1.5 4.2-4.2 4.7" />
        <path d="M12 14v4" />
        <path d="M8.5 21h7" />
        <path d="M10 18h4" />
      </svg>
    );
  }

  if (
    name ===
    'fixtures'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <rect
          x="3"
          y="5.5"
          width="18"
          height="15.5"
          rx="2.5"
        />
        <path d="M7 3v5" />
        <path d="M17 3v5" />
        <path d="M3 10h18" />
        <path d="m8 15 2 2 5-5" />
      </svg>
    );
  }

  if (
    name ===
    'more'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="5"
          cy="12"
          r="1.65"
        />
        <circle
          cx="12"
          cy="12"
          r="1.65"
        />
        <circle
          cx="19"
          cy="12"
          r="1.65"
        />
      </svg>
    );
  }

  if (
    name ===
    'join'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="9"
          cy="8"
          r="3"
        />
        <path d="M3.5 19c.7-3.1 2.6-4.8 5.5-4.8s4.8 1.7 5.5 4.8" />
        <path d="M18 8v6" />
        <path d="M15 11h6" />
      </svg>
    );
  }

  if (
    name ===
    'create'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M8 4h8v3c0 3-1.8 5.2-4 6.2C9.8 12.2 8 10 8 7V4Z" />
        <path d="M12 13.2V18" />
        <path d="M9 21h6" />
        <path d="M18.5 4.5v5" />
        <path d="M16 7h5" />
      </svg>
    );
  }

  if (
    name ===
    'profile'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="8"
          r="3.5"
        />
        <path d="M4.5 20c.9-4 3.4-6 7.5-6s6.6 2 7.5 6" />
      </svg>
    );
  }

  if (
    name ===
    'help'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="M9.7 9a2.4 2.4 0 0 1 4.7.7c0 1.8-2.4 2.2-2.4 3.8" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (
    name ===
    'logout'
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10" />
        <path d="m14 8 4 4-4 4" />
        <path d="M9 12h9" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}


function mainIconForHref(
  href:
    string,
): SidebarIconName {
  if (
    href ===
    '/dashboard'
  ) {
    return 'home';
  }

  if (
    href ===
    '/leagues'
  ) {
    return 'league';
  }

  if (
    href ===
    '/tournaments'
  ) {
    return 'tournament';
  }

  if (
    href ===
    '/fixtures'
  ) {
    return 'fixtures';
  }

  return 'more';
}


function DesktopNavItem({
  href,
  label,
  icon,
  selected,
}: {
  href: string;
  label: string;
  icon:
    SidebarIconName;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={
        selected
          ? 'page'
          : undefined
      }
      className={`group relative flex h-[56px] items-center gap-4 overflow-hidden rounded-[13px] border px-[17px] text-[15px] font-semibold transition duration-200 ${
        selected
          ? 'border-[#D5AE5C]/35 bg-[#D5AE5C]/[0.14] text-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
          : 'border-transparent bg-transparent text-[#D5DCE5] hover:border-white/[0.05] hover:bg-white/[0.055] hover:text-white'
      }`}
    >
      {selected ? (
        <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-[#D5AE5C]" />
      ) : null}

      <span
        className={`grid h-7 w-7 shrink-0 place-items-center transition duration-200 ${
          selected
            ? 'text-[#E0B95F]'
            : 'text-[#9BA8B6] group-hover:text-[#E0B95F]'
        }`}
      >
        <SidebarIcon
          name={icon}
        />
      </span>

      <span className="truncate">
        {label}
      </span>
    </Link>
  );
}


function QuickActionItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon:
    SidebarIconName;
}) {
  return (
    <Link
      href={href}
      className="group flex h-[46px] items-center gap-3 rounded-[11px] border border-[#173A57] bg-[#0B2D4C]/55 px-3.5 text-[14px] font-medium text-[#D5DCE5] transition duration-200 hover:border-[#36546E] hover:bg-[#0B2D4C] hover:text-white"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center text-[#9BA8B6] transition duration-200 group-hover:text-[#E0B95F]">
        <SidebarIcon
          name={icon}
          className="h-[19px] w-[19px]"
        />
      </span>

      <span className="min-w-0 flex-1 truncate">
        {label}
      </span>

      <span className="text-[#758697] transition duration-200 group-hover:translate-x-0.5 group-hover:text-[#D5AE5C]">
        <SidebarIcon
          name="chevron"
          className="h-4 w-4"
        />
      </span>
    </Link>
  );
}


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


  const initials =
    (
      playerName ||
      'FC'
    )
      .slice(
        0,
        2,
      )
      .toUpperCase();


  return (
    <div className="fc-app-shell min-h-screen bg-[#F8F5EE] text-[#10213A]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] border-r border-[#173A57] bg-[#071E35] lg:flex lg:flex-col">
        <div className="shrink-0 border-b border-[#173A57] px-[22px] py-5">
          <Link
            href="/dashboard"
            className="flex min-h-[58px] items-center gap-3.5"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] border border-[#36546E] bg-[#0B2D4C] text-[#D5AE5C] shadow-[0_8px_22px_rgba(0,0,0,0.18)]">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                className="h-8 w-8"
                aria-hidden="true"
              >
                <path
                  d="M8 17.5 13 31h22l5-13.5-9 6-7-12-7 12-9-6Z"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 35h22"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M10 10.5h.01M38 10.5h.01M24 6h.01"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <span className="min-w-0">
              <span className="block text-[22px] font-bold leading-none tracking-[-0.025em] text-white">
                FC <span className="text-[#D5AE5C]">ARENA</span>
              </span>

              <span className="mt-2 block text-[11px] font-medium tracking-[0.045em] text-[#9BA8B6]">
                PLAY • COMPETE • BELONG
              </span>
            </span>
          </Link>
        </div>


        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8391A0]">
            Main
          </p>

          <nav className="mt-3 space-y-2">
            {primaryNavigation.map(
              (
                item,
              ) => (
                <DesktopNavItem
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  label={
                    item.shortLabel
                  }
                  icon={
                    mainIconForHref(
                      item.href,
                    )
                  }
                  selected={
                    active ===
                    item.href
                  }
                />
              ),
            )}
          </nav>


          <div className="my-6 h-px bg-[#173A57]" />


          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8391A0]">
            Quick Actions
          </p>

          <div className="mt-3 space-y-2">
            {quickLinks.map(
              (
                item,
              ) => (
                <QuickActionItem
                  key={
                    item.href +
                    item.label
                  }
                  href={
                    item.href
                  }
                  label={
                    item.label
                  }
                  icon={
                    item.icon
                  }
                />
              ),
            )}
          </div>
        </div>


        <div className="shrink-0 border-t border-[#173A57] bg-[#071E35] px-5 pb-4 pt-4">
          <Link
            href="/profile"
            className="group flex items-center gap-3 rounded-[13px] border border-[#173A57] bg-[#0B2D4C]/70 p-3 transition duration-200 hover:border-[#36546E] hover:bg-[#0B2D4C]"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#214154] bg-[#0E1A25] text-xs font-semibold text-[#D5AE5C]">
              {
                initials
              }

              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071E35] bg-[#22C55E]" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-white">
                {playerName ||
                  'FC ARENA Player'}
              </span>

              <span className="mt-0.5 block text-[12px] font-normal text-[#9BA8B6]">
                {playerRole ||
                  'Player'}
              </span>
            </span>

            <span className="text-[#7D8B99] transition duration-200 group-hover:text-[#83919F]">
              <SidebarIcon
                name="chevron"
                className="h-4 w-4"
              />
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
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[#EF5350]/35 bg-transparent px-4 text-[13px] font-semibold text-[#FF6B67] transition duration-200 hover:bg-[#EF5350]/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SidebarIcon
              name="logout"
              className="h-[18px] w-[18px]"
            />

            {loggingOut
              ? 'Signing out...'
              : 'Sign Out'}
          </button>


          <div className="mt-4 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-medium text-[#7D8B99]">
                FC ARENA v1.0.0
              </p>

              <p className="mt-1 text-[9px] font-medium tracking-[0.08em] text-[#738392]">
                MORE THAN A GAME
              </p>
            </div>

            <span className="text-[10px] text-[#738392]">
              ●
            </span>
          </div>
        </div>
      </aside>


      <div className="lg:pl-[270px]">
        <AppHeader
          playerName={
            playerName
          }
          playerRole={
            playerRole
          }
        />

        <main
          className={`fc-main mx-auto min-h-[calc(100vh-4.25rem)] w-full max-w-[1280px] px-4 pt-5 sm:px-6 md:pt-6 lg:px-8 lg:pb-10 lg:pt-7 ${
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
