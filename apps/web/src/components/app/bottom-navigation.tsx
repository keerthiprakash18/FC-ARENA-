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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#203141] bg-[#0B1118]/98 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
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
                className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition ${
                  selected
                    ? 'text-[#F8FAFC]'
                    : 'text-[#6F7B8A]'
                }`}
              >
                {selected ? (
                  <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[#19B7FF]" />
                ) : null}

                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${
                    selected
                      ? 'bg-sky-400/[0.10] text-[#19B7FF]'
                      : 'text-[#6F7B8A]'
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
