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
}: {
  playerName?: string | null;
  playerRole?: string | null;
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
    <header className="sticky top-0 z-30 border-b border-[#DED8CD] bg-[#FFFDF9]/96 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#DED8CD] bg-[#FFFDF9] text-[#C9972D]">
            ♛
          </span>

          <span className="fc-display text-lg font-semibold tracking-[-0.02em]">
            FC <span className="text-[#C9972D]">ARENA</span>
          </span>
        </Link>


        <div className="relative hidden w-full max-w-[440px] lg:block">
          <label className="flex h-10 items-center gap-3 rounded-xl border border-[#DED8CD] bg-white px-3.5 text-[#54657A] shadow-[0_4px_14px_rgba(11,37,69,0.04)] transition focus-within:border-[#C9972D]/55 focus-within:bg-[#FFFDF9] focus-within:shadow-[0_0_0_3px_rgba(201,151,45,0.08)]">
            <span className="text-base text-[#8792A1]">
              ⌕
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
              className="min-w-0 flex-1 bg-transparent text-xs text-[#0B2545] outline-none placeholder:text-[#8792A1]"
            />

            <span className="rounded-md border border-[#DED8CD] bg-[#FBF8F2] px-2 py-1 text-[10px] font-medium text-[#8792A1]">
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

              <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-[#DED8CD] bg-[#FFFDF9] p-1.5 shadow-[0_18px_42px_rgba(11,37,69,0.12)]">
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
                        className="flex min-h-10 w-full items-center justify-between rounded-[9px] px-3 text-left text-xs text-[#A7B0BE] transition hover:bg-[#14212D] hover:text-[#0B2545]"
                      >
                        <span>
                          {
                            item.label
                          }
                        </span>

                        <span className="text-[#8792A1]">
                          →
                        </span>
                      </button>
                    ),
                  )
                ) : (
                  <p className="px-3 py-3 text-xs text-[#54657A]">
                    No matching app section.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>


        <div className="flex items-center gap-2.5">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative grid h-11 w-11 place-items-center rounded-xl border border-transparent text-[#0B2545] transition duration-200 hover:border-[#DED8CD] hover:bg-[#FBF8F2]"
          >
            ♧

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E34C4C] ring-2 ring-[#FFFDF9]" />
          </Link>


          <div className="h-8 w-px bg-[#DED8CD]" />


          <Link
            href="/profile"
            className="flex h-11 items-center gap-3 rounded-xl px-2 transition duration-200 hover:bg-[#FBF8F2]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#D9B45A]/45 bg-[#0B2545] text-xs font-semibold text-[#D9B45A]">
              {initials}
            </span>

            <span className="hidden min-w-0 sm:block">
              <span className="fc-display block max-w-[180px] truncate text-xs font-semibold tracking-[0.01em] text-[#0B2545]">
                {playerName ||
                  'Player'}
              </span>

              <span className="mt-0.5 block text-[10px] text-[#54657A]">
                {playerRole ||
                  'Player'}
              </span>
            </span>

            <span className="hidden text-[10px] text-[#8792A1] sm:block">
              ▾
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
