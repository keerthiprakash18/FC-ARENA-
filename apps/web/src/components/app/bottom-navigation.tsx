'use client';

import Link from 'next/link';

import {
  primaryNavigation,
} from './primary-navigation';

export function BottomNavigation({
  active,
}: {
  active: string;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.09] bg-[#050b14]/96 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5">
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
                className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[9px] font-black transition ${
                  selected
                    ? 'text-sky-300'
                    : 'text-slate-600'
                }`}
              >
                {selected ? (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                ) : null}

                <span
                  className={`grid h-8 w-8 place-items-center rounded-xl text-sm ${
                    selected
                      ? 'bg-sky-400 text-[#031019]'
                      : 'bg-white/[0.025]'
                  }`}
                >
                  {
                    item.icon
                  }
                </span>

                <span className="max-w-full truncate">
                  {
                    item.shortLabel
                  }
                </span>
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}
