'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

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
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const reveal = () => {
      const current = element.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      const left = current.offsetLeft;
      if (left < element.scrollLeft || left + current.offsetWidth > element.scrollLeft + element.clientWidth) {
        element.scrollLeft = Math.max(0, left - (element.clientWidth - current.offsetWidth) / 2);
      }
    };
    const frame = requestAnimationFrame(reveal);
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [active]);
  return (
    <nav
      className="theme-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary navigation"
    >
       <div ref={rail} className="premium-primary-rail mx-auto max-w-3xl">
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
                className="theme-bottom-item relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition duration-200"
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

                <span className="max-w-full text-xs leading-tight">
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
