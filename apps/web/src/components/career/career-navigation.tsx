'use client';

import { usePathname } from 'next/navigation';

import { FcContextNav } from '@/components/fc/fc-context-nav';

const items = [
  ['Stats', '/career'],
  ['Matches', '/career/matches'],
  ['Tournaments', '/career/tournaments'],
  ['Leagues', '/career/leagues'],
  ['Achievements', '/career/achievements'],
] as const;

export function CareerNavigation() {
  const pathname = usePathname();

  return (
    <FcContextNav
      ariaLabel="Career sections"
      items={items.map(([label, href]) => ({
        label,
        href,
        active:
          pathname === href ||
          (href !== '/career' && pathname.startsWith(`${href}/`)),
      }))}
    />
  );
}
