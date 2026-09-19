'use client';

import Link from 'next/link';

import {
  usePathname,
} from 'next/navigation';

const items = [
  ['Overview', ''],
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
    <nav className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08111b]/95 p-2 backdrop-blur-xl">
      <div className="flex min-w-max gap-1.5">
        {items.map(
          ([
            label,
            suffix,
          ]) => {
            const href =
              `${base}${suffix}`;

            const active =
              suffix === ''
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
                  label
                }
                href={
                  href
                }
                className={`rounded-xl border px-4 py-2.5 text-xs font-black transition sm:text-sm ${
                  active
                    ? 'border-sky-400/30 bg-sky-400/[0.09] text-sky-300'
                    : 'border-transparent text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-white'
                }`}
              >
                {
                  label
                }
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}
