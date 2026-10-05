'use client';

import {
  usePathname,
} from 'next/navigation';

import { FcContextNav } from '@/components/fc/fc-context-nav';


interface Props {
  tournamentId: string;
}


const items = [
  ['Overview', ''],
  ['Registration', '/registration'],
  ['Teams', '/teams'],
  ['Groups', '/groups'],
  ['Fixtures', '/fixtures'],
  ['Standings', '/standings'],
  ['Bracket', '/playoffs'],
  ['Stats', '/stats'],
  ['Awards', '/achievements'],
  ['Settings', '/settings'],
] as const;


export function TournamentNavigation({
  tournamentId,
}: Props) {
  const pathname =
    usePathname();

  const base =
    `/tournaments/${tournamentId}`;

  return (
    <FcContextNav
      ariaLabel="Tournament sections"
      items={items.map(([label, suffix]) => {
        const href = `${base}${suffix}`;
        const active = suffix === ''
          ? pathname === base
          : pathname === href || pathname.startsWith(`${href}/`);

        return { label, href, active };
      })}
    />
  );
}
