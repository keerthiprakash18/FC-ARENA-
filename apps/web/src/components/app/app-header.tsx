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
  useTheme,
} from '@/components/theme/theme-provider';

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
    label: 'Discover',
    keywords: 'discover search players leagues tournaments seasons hall fame',
    href: '/discover',
  },
  {
    label: 'Hall of Fame',
    keywords: 'hall fame honours winners champions ballon history',
    href: '/awards/hall-of-fame',
  },
  {
    label: 'Fair Play',
    keywords: 'fair play reputation conduct appeal',
    href: '/fair-play',
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

  const {
    resolvedDark,
    setDisplayMode,
  } =
    useTheme();

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

  const [
    highlightedIndex,
    setHighlightedIndex,
  ] =
    useState(0);

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

        setHighlightedIndex(0);
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

  const hasGlobalSearch = query.trim().length >= 2;
  const optionCount = results.length + (hasGlobalSearch ? 1 : 0);

  function handleSearchKeyDown(event: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault: () => void;
  }) {
    if (event.key === 'ArrowDown' && optionCount > 0) {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedIndex(index => (index + 1) % optionCount);
      return;
    }

    if (event.key === 'ArrowUp' && optionCount > 0) {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedIndex(index => (index - 1 + optionCount) % optionCount);
      return;
    }

    if (event.key === 'Enter' && searchOpen && optionCount > 0) {
      event.preventDefault();
      if (hasGlobalSearch && highlightedIndex === 0) {
        openResult(`/discover?q=${encodeURIComponent(query.trim())}`);
      } else {
        const result = results[highlightedIndex - (hasGlobalSearch ? 1 : 0)];
        if (result) openResult(result.href);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
    }
  }


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


        <div className="relative hidden w-full max-w-[440px] lg:block" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
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
                 ) => {
                   setQuery(event.target.value);
                   setHighlightedIndex(0);
                 }
               }
               onKeyDown={handleSearchKeyDown}
               role="combobox"
               aria-label="Search app sections"
               aria-controls="fc-search-results"
               aria-expanded={searchOpen}
               aria-autocomplete="list"
               aria-haspopup="listbox"
               aria-activedescendant={searchOpen && optionCount > 0 ? `fc-search-option-${highlightedIndex}` : undefined}
              placeholder="Search FC Arena or jump to a section..."
              className="theme-search-input min-w-0 flex-1 bg-transparent text-xs outline-none"
            />

            <span className="theme-kbd rounded-md border px-2 py-1 text-[10px] font-medium">
              Ctrl K
            </span>
          </label>


          {searchOpen ? (
            <>
               <div id="fc-search-results" role="listbox" aria-label="FC Arena search results" className="theme-search-menu absolute left-0 right-0 top-12 overflow-hidden rounded-xl border p-1.5 shadow-[0_18px_42px_rgba(11,37,69,0.12)]">
                {hasGlobalSearch ? (
                  <button
                    type="button"
                    id="fc-search-option-0"
                    role="option"
                    tabIndex={-1}
                    onMouseDown={event => event.preventDefault()}
                    aria-selected={highlightedIndex === 0}
                    onMouseEnter={() => setHighlightedIndex(0)}
                    onClick={() =>
                      openResult(
                        `/discover?q=${encodeURIComponent(
                          query.trim(),
                        )}`,
                      )
                    }
                    className={`theme-search-result mb-1 flex min-h-11 w-full items-center justify-between rounded-[9px] border border-sky-400/15 px-3 text-left text-xs font-black text-sky-400 transition ${highlightedIndex === 0 ? 'is-highlighted' : ''}`}
                  >
                    <span>
                      Search all FC Arena for “{query.trim()}”
                    </span>

                    <span aria-hidden="true">
                      <FcIcon
                        name="search"
                        size={16}
                      />
                    </span>
                  </button>
                ) : null}

                {results.length >
                0 ? (
                   results.map(
                     (
                       item,
                       index,
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
                         id={`fc-search-option-${(hasGlobalSearch ? 1 : 0) + index}`}
                         role="option"
                         tabIndex={-1}
                         onMouseDown={event => event.preventDefault()}
                         aria-selected={highlightedIndex === (hasGlobalSearch ? 1 : 0) + index}
                         onMouseEnter={() => setHighlightedIndex((hasGlobalSearch ? 1 : 0) + index)}
                         className={`theme-search-result flex min-h-10 w-full items-center justify-between rounded-[9px] px-3 text-left text-xs transition ${highlightedIndex === (hasGlobalSearch ? 1 : 0) + index ? 'is-highlighted' : ''}`}
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
          <Link
            href="/discover"
            aria-label="Discover FC Arena"
            title="Discover"
            className="theme-profile-chip theme-text grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-transparent transition duration-200 lg:hidden"
          >
            <FcIcon
              name="search"
              size={19}
            />
          </Link>

          <button
            type="button"
            aria-label={
              resolvedDark
                ? 'Switch to Light Mode'
                : 'Switch to Dark Mode'
            }
            title={
              resolvedDark
                ? 'Light Mode'
                : 'Dark Mode'
            }
            onClick={() =>
              setDisplayMode(
                resolvedDark
                  ? 'LIGHT'
                  : 'DARK',
              )
            }
            className="theme-profile-chip theme-text grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-transparent text-[18px] transition duration-200"
          >
            <span
              aria-hidden="true"
              className="leading-none"
            >
              {
                resolvedDark
                  ? '☀'
                  : '◐'
              }
            </span>
          </button>

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
