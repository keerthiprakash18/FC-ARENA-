'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

const menu = [
  {
    title: 'Match Center',
    description:
      'Upcoming, active and completed matches',
    href: '/matches',
    icon: '⚔',
  },
  {
    title: 'Career',
    description:
      'Player statistics and competition history',
    href: '/career',
    icon: '★',
  },
  {
    title: 'Notifications',
    description:
      'Competition alerts and updates',
    href: '/notifications',
    icon: '●',
  },
  {
    title: 'Profile',
    description:
      'FC ARENA player identity and settings',
    href: '/profile',
    icon: '◎',
  },
];

export default function MorePage() {
  const [user, setUser] =
    useState<CurrentUser | null>(null);

  useEffect(() => {
    void getCurrentUser().then(setUser);
  }, []);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity?.inGameName
      }
    >
      <div className="space-y-6">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            FC ARENA
          </p>

          <h1 className="mt-2 text-4xl font-black">
            More
          </h1>
        </section>

        <div className="space-y-3">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              scroll
              className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-[#0a1018] p-5 transition hover:border-sky-400/30"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-400/10 text-xl text-sky-400">
                {item.icon}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-black">
                  {item.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {item.description}
                </p>
              </div>

              <span className="text-slate-600">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
