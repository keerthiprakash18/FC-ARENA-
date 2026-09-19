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
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#030812]/88 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 lg:hidden"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/[0.07] text-sky-300">
            ♛
          </span>

          <span className="font-['Rajdhani','Space_Grotesk',sans-serif] text-xl font-black">
            FC <span className="text-sky-400">ARENA</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
            More Than A Game
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 transition hover:border-sky-400/25 hover:text-sky-300"
          >
            ◉
          </Link>

          <Link
            href="/profile"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-2.5 transition hover:border-sky-400/25"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-400 text-[10px] font-black text-[#031019]">
              {initials}
            </span>

            <span className="hidden max-w-[150px] truncate text-xs font-black text-slate-300 sm:block">
              {playerName ||
                'Player'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
