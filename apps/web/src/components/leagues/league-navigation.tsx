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
    <nav className="overflow-x-auto rounded-2xl border border-[#253140] bg-[#121821] p-1.5">
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
                className={`rounded-[10px] border px-3.5 py-2.5 text-xs font-medium transition sm:text-sm ${
                  active
                    ? 'border-transparent bg-sky-400/[0.10] text-[#F8FAFC]'
                    : 'border-transparent text-[#A7B0BE] hover:bg-[#151C26] hover:text-[#F8FAFC]'
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
