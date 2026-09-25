'use client';

import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

import {
  FC_ARENA_LOGO_DATA_URI,
} from '@/lib/brand-assets';

import {
  NotificationBell,
} from './notification-bell';


const quickSearchItems = [
  {
    label: 'Home',
    keywords: 'home dashboard overview',
    href: '/dashboard',
  },
  {
    label: 'Leagues',
    keywords: 'league join members standings',
    href: '/leagues',
  },
  {
    label: 'Tournaments',
    keywords: 'tournament competition bracket groups',
    href: '/tournaments',
  },
  {
    label: 'Fixtures',
    keywords: 'fixtures matches schedule results',
    href: '/fixtures',
  },
  {
    label: 'Career Stats',
    keywords: 'career stats performance player rating',
    href: '/career',
  },
  {
    label: 'Profile',
    keywords: 'profile account player',
    href: '/profile',
  },
  {
    label: 'Notifications',
    keywords: 'notifications alerts',
    href: '/notifications',
  },
  {
    label: 'More',
    keywords: 'more settings help awards achievements',
    href: '/more',
  },
] as const;


export function AppHeader({
  playerName,
  playerRole,
  playerImageUrl,
}: {
  playerName?: string | null;
  playerRole?: string | null;
  playerImageUrl?: string | null;
}) {
  const router =
    useRouter();

  const searchRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(false);

  const initials = (
    playerName ||
    'FC'
  )
    .slice(
      0,
      2,
    )
    .toUpperCase();


  useEffect(() => {
    function onKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        (
          event.ctrlKey ||
          event.metaKey
        ) &&
        event.key.toLowerCase() ===
          'k'
      ) {
        event.preventDefault();

        searchRef.current
          ?.focus();

        setSearchOpen(
          true,
        );
      }

      if (
        event.key ===
        'Escape'
      ) {
        setSearchOpen(
          false,
        );

        searchRef.current
          ?.blur();
      }
    }

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () =>
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
  }, []);


  const results =
    useMemo(
      () => {
        const value =
          query
            .trim()
            .toLowerCase();

        if (!value) {
          return quickSearchItems.slice(
            0,
            5,
          );
        }

        return quickSearchItems.filter(
          (
            item,
          ) =>
            item.label
              .toLowerCase()
              .includes(
                value,
              ) ||
            item.keywords.includes(
              value,
            ),
        );
      },
      [
        query,
      ],
    );


  function openResult(
    href:
      string,
  ) {
    setSearchOpen(
      false,
    );

    setQuery(
      '',
    );

    router.push(
      href,
    );
  }


  return (
    <header className="theme-top-header sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
        >
          <span
            className="theme-brand-mark grid h-9 w-9 place-items-center overflow-hidden rounded-xl border"
            aria-hidden="true"
          >
            <img
              src={FC_ARENA_LOGO_DATA_URI}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>

          <span className="fc-display text-lg font-semibold tracking-[-0.02em]">
            FC <span className="theme-brand-accent">ARENA</span>
          </span>
        </Link>


        <div className="relative hidden w-full max-w-[440px] lg:block">
          <label className="theme-search flex h-10 items-center gap-3 rounded-xl border px-3.5 shadow-[0_4px_14px_rgba(11,37,69,0.04)] transition">
            <span className="theme-muted" aria-hidden="true">
              <FcIcon
                name="search"
                size={18}
              />
            </span>

            <input
              ref={
                searchRef
              }
              value={
                query
              }
              onFocus={() =>
                setSearchOpen(
                  true,
                )
              }
              onChange={
                (
                  event,
                ) =>
                  setQuery(
                    event.target.value,
                  )
              }
              placeholder="Search leagues, tournaments, fixtures..."
              className="theme-search-input min-w-0 flex-1 bg-transparent text-xs outline-none"
            />

            <span className="theme-kbd rounded-md border px-2 py-1 text-[10px] font-medium">
              Ctrl K
            </span>
          </label>


          {searchOpen ? (
            <>
              <button
                type="button"
                aria-label="Close search"
                onClick={() =>
                  setSearchOpen(
                    false,
                  )
                }
                className="fixed inset-0 z-[-1] cursor-default"
              />

              <div className="theme-search-menu absolute left-0 right-0 top-12 overflow-hidden rounded-xl border p-1.5 shadow-[0_18px_42px_rgba(11,37,69,0.12)]">
                {results.length >
                0 ? (
                  results.map(
                    (
                      item,
                    ) => (
                      <button
                        key={
                          item.href
                        }
                        type="button"
                        onClick={() =>
                          openResult(
                            item.href,
                          )
                        }
                        className="theme-search-result flex min-h-10 w-full items-center justify-between rounded-[9px] px-3 text-left text-xs transition"
                      >
                        <span>
                          {
                            item.label
                          }
                        </span>

                        <span className="theme-muted" aria-hidden="true">
                          <FcIcon
                            name="chevronRight"
                            size={16}
                          />
                        </span>
                      </button>
                    ),
                  )
                ) : (
                  <p className="theme-secondary-text px-3 py-3 text-xs">
                    No matching app section.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>


        <div className="flex items-center gap-2.5">
          <NotificationBell />


          <div className="theme-divider h-8 w-px" />


          <Link
            href="/profile"
            className="theme-profile-chip flex h-11 items-center gap-3 rounded-xl px-2 transition duration-200"
          >
            <span className="theme-avatar grid h-9 w-9 place-items-center overflow-hidden rounded-full border text-xs font-semibold">
              {playerImageUrl ? (
                <img
                  src={
                    playerImageUrl
                  }
                  alt={
                    (playerName ||
                      'Player') +
                    ' profile'
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </span>

            <span className="hidden min-w-0 sm:block">
              <span className="theme-text fc-display block max-w-[180px] truncate text-xs font-semibold tracking-[0.01em]">
                {playerName ||
                  'Player'}
              </span>

              <span className="theme-secondary-text mt-0.5 block text-[10px]">
                {playerRole ||
                  'Player'}
              </span>
            </span>

            <span className="theme-muted hidden sm:block" aria-hidden="true">
              <FcIcon
                name="chevronDown"
                size={15}
              />
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
