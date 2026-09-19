'use client';

import Link from 'next/link';

export function AppHeader({
  playerName,
  playerRole,
}: {
  playerName?: string | null;
  playerRole?: string | null;
}) {
  const initials = (
    playerName ||
    'FC'
  )
    .slice(
      0,
      2,
    )
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-[#203141] bg-[#071019]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#284154] bg-[#101923] text-[#19B7FF]">
            ♛
          </span>

          <span className="text-lg font-semibold tracking-[-0.02em]">
            FC <span className="text-[#19B7FF]">ARENA</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="text-xs font-medium text-[#536273]">
            Football competition platform
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="grid h-11 w-11 place-items-center rounded-xl border border-[#203141] bg-[#101923] text-[#A7B0BE] transition duration-200 hover:border-[#2D4356] hover:bg-[#121D28] hover:text-[#F8FAFC]"
          >
            ◉
          </Link>

          <Link
            href="/profile"
            className="flex h-11 items-center gap-2.5 rounded-xl border border-[#203141] bg-[#101923] px-2.5 transition duration-200 hover:border-[#2D4356] hover:bg-[#121D28]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#14212D] text-[11px] font-semibold text-[#19B7FF]">
              {initials}
            </span>

            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[160px] truncate text-xs font-semibold text-[#F8FAFC]">
                {playerName ||
                  'Player'}
              </span>

              <span className="mt-0.5 block text-[10px] text-[#6F7B8A]">
                {playerRole ||
                  'Player'}
              </span>
            </span>

            <span className="hidden text-xs text-[#536273] sm:block">
              ▾
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
