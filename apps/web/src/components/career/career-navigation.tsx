'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
    <nav className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#08111b]/95 p-2 backdrop-blur-xl">
      <div className="flex min-w-max gap-1.5">
        {items.map(([label, href]) => {
          const active =
            pathname === href ||
            (href !== '/career' &&
              pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              className={`rounded-xl border px-4 py-2.5 text-xs font-black transition sm:text-sm ${
                active
                  ? 'border-sky-400/30 bg-sky-400/[0.09] text-sky-300'
                  : 'border-transparent text-slate-500 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-white'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
