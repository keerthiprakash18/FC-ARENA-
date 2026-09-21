'use client';

import Link from 'next/link';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

import {
  primaryNavigation,
} from './primary-navigation';

export function BottomNavigation({
  active,
}: {
  active: string;
}) {
  return (
    <nav
      className="theme-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary navigation"
    >
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
                aria-current={
                  selected
                    ? 'page'
                    : undefined
                }
                data-active={
                  selected
                    ? 'true'
                    : 'false'
                }
                className="theme-bottom-item relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition duration-200"
              >
                {selected ? (
                  <span className="theme-bottom-accent absolute inset-x-5 top-0 h-0.5 rounded-full" />
                ) : null}

                <span className="theme-bottom-icon grid h-8 w-8 place-items-center rounded-lg">
                  <FcIcon
                    name={
                      item.icon
                    }
                    size={20}
                  />
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
