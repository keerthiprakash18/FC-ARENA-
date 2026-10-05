'use client';

import {
  usePathname,
} from 'next/navigation';

import { FcContextNav } from '@/components/fc/fc-context-nav';

const items = [
  ['Overview', ''],
  ['Leaderboard', '/leaderboard'],
  ['Standings', '/standings'],
  ['Fixtures', '/fixtures'],
  ['Members', '/members'],
  ['Teams', '/teams'],
  ['Settings', '/settings'],
] as const;

export function LeagueNavigation({
  leagueId,
}: {
  leagueId: string;
}) {
  const pathname =
    usePathname();

  const base =
    `/leagues/${leagueId}`;

  return (
    <FcContextNav
      ariaLabel="League sections"
      items={items.map(([label, suffix]) => {
        const isLeaderboard = suffix === '/leaderboard';
        const href = isLeaderboard
          ? `/leaderboards?league=${leagueId}`
          : `${base}${suffix}`;
        const active = isLeaderboard
          ? pathname === '/leaderboards'
          : suffix === ''
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);

        return { label, href, active };
      })}
    />
  );
}
