'use client';

import Link from 'next/link';
import {
  FcIcon,
} from '@/components/fc/fc-icons';

import {
  mobilePrimaryNavigation,
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
       <div className="premium-primary-grid mx-auto max-w-3xl">
        {mobilePrimaryNavigation.map(
          (
            item,
          ) => {
             const selected =
               active === item.href ||
               (item.href === '/more' &&
                 !mobilePrimaryNavigation.some(
                   candidate => candidate.href === active,
                 ));

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
                className="theme-bottom-item relative flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition duration-200"
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

                <span className="max-w-full truncate text-[10px] leading-tight">
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
