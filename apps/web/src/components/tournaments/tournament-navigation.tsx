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
    <nav className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08111b]/95 p-2 backdrop-blur-xl">
      <div className="flex min-w-max gap-1.5">
        {items.map(
          (
            item,
          ) => {
            const href =
              `${base}${item.path}`;

            const active =
              item.path ===
              ''
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
                className={`rounded-xl border px-4 py-2.5 text-xs font-black transition sm:text-sm ${
                  active
                    ? 'border-sky-400/30 bg-sky-400/[0.09] text-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.05)]'
                    : 'border-transparent text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-white'
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
