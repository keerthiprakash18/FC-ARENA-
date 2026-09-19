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
    <nav className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08111b]/95 p-2">
      <div className="flex min-w-max gap-1.5">
        {items.map(
          ([label, href]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-xl border px-4 py-2.5 text-xs font-black transition sm:text-sm ${
                pathname === href
                  ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300'
                  : 'border-transparent text-slate-500 hover:border-white/[0.07] hover:text-white'
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
