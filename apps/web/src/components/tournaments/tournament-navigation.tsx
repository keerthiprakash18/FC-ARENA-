'use client';

import Link from 'next/link';

import {
  usePathname,
} from 'next/navigation';


interface Props {
  tournamentId: string;
}


const items = [
  {
    label: 'Overview',
    path: '',
  },
  {
    label: 'Teams',
    path: '/teams',
  },
  {
    label: 'Groups',
    path: '/groups',
  },
  {
    label: 'Fixtures',
    path: '/fixtures',
  },
  {
    label: 'Standings',
    path: '/standings',
  },
  {
    label: 'Knockout',
    path: '/playoffs',
  },
  {
    label: 'Settings',
    path: '/settings',
  },
];


export function TournamentNavigation({
  tournamentId,
}: Props) {
  const pathname =
    usePathname();

  const base =
    `/tournaments/${tournamentId}`;

  return (
    <nav className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0a1018] p-2">
      <div className="flex min-w-max gap-2">

        {items.map(
          (
            item,
          ) => {
            const href =
              `${base}${item.path}`;

            const active =
              item.path === ''
                ? pathname ===
                  base
                : pathname ===
                    href ||
                  pathname.startsWith(
                    `${href}/`,
                  );

            return (
              <Link
                key={
                  item.label
                }
                href={
                  href
                }
                className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                  active
                    ? 'bg-sky-400 text-[#041019]'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {
                  item.label
                }
              </Link>
            );
          },
        )}

      </div>
    </nav>
  );
}