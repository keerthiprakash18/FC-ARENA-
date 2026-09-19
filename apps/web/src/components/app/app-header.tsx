'use client';

import Link from 'next/link';

export function AppHeader({
  playerName,
}: {
  playerName?: string | null;
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
    <header className="sticky top-0 z-30 border-b border-[#253140] bg-[#0B0F14]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#2B3948] bg-[#151C26] text-[#38BDF8]">
            ♛
          </span>

          <span className="text-lg font-semibold tracking-[-0.02em]">
            FC <span className="text-[#38BDF8]">ARENA</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <p className="text-xs font-medium text-[#6F7B8A]">
            FC ARENA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#253140] bg-[#121821] text-[#A7B0BE] transition hover:bg-[#151C26] hover:text-[#F8FAFC]"
          >
            ◉
          </Link>

          <Link
            href="/profile"
            className="flex h-10 items-center gap-2 rounded-[10px] border border-[#253140] bg-[#121821] px-2.5 transition hover:bg-[#151C26]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#18212C] text-[10px] font-semibold text-[#38BDF8]">
              {initials}
            </span>

            <span className="hidden max-w-[150px] truncate text-xs font-medium text-[#A7B0BE] sm:block">
              {playerName ||
                'Player'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
