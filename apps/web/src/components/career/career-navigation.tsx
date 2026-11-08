'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { careerHref } from '@/lib/career-scope';

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
  const leagueId = useSearchParams().get('leagueId');

  return (
    <FcContextNav
      ariaLabel="Career sections"
      items={items.map(([label, href]) => ({
        label,
        href: careerHref(href, leagueId),
        active:
          pathname === href ||
          (href !== '/career' && pathname.startsWith(`${href}/`)),
      }))}
    />
  );
}
