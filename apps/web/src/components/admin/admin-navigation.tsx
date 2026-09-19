'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['Leagues', '/admin/leagues'],
  ['Tournaments', '/admin/tournaments'],
  ['Teams', '/admin/teams'],
  ['Results', '/admin/results'],
  ['Disputes', '/admin/disputes'],
] as const;

export function AdminNavigation() {
  const pathname =
    usePathname();

  return (
    <nav className="overflow-x-auto rounded-2xl border border-[#253140] bg-[#121821] p-1.5">
      <div className="flex min-w-max gap-1.5">
        {items.map(
          ([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-[10px] border px-3.5 py-2.5 text-xs font-medium transition sm:text-sm ${
                pathname === href
                  ? 'border-transparent bg-amber-400/[0.08] text-[#F8FAFC]'
                  : 'border-transparent text-[#A7B0BE] hover:bg-[#151C26] hover:text-[#F8FAFC]'
              }`}
            >
              {label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
