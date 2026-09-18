'use client';

import Link from 'next/link';
import {
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

const competitionSections = [
  {
    title: 'Leagues',
    eyebrow: 'COMMUNITIES',
    description:
      'Create a League, join with a code and manage your football community.',
    href: '/leagues',
    action: 'Open Leagues',
    icon: '◈',
  },
  {
    title: 'Tournaments',
    eyebrow: 'COMPETITIONS',
    description:
      'See every tournament from your joined Leagues and enter the competition.',
    href: '/tournaments',
    action: 'Open Tournaments',
    icon: '♛',
  },
  {
    title: 'Fixtures',
    eyebrow: 'SCHEDULE',
    description:
      'View single-table, group-stage and knockout fixtures in one dedicated center.',
    href: '/fixtures',
    action: 'Open Fixtures',
    icon: '⇄',
  },
  {
    title: 'Match System',
    eyebrow: 'MATCH CENTER',
    description:
      'Open generated matches, submit results and complete admin verification.',
    href: '/matches',
    action: 'Open Matches',
    icon: '⚽',
  },
] as const;

export default function DashboardPage() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  useEffect(() => {
    async function loadDashboard() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(currentUser);
      } catch {
        router.replace(
          '/login',
        );
      }
    }

    void loadDashboard();
  }, [router]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-semibold text-slate-500">
        Loading FC ARENA...
      </div>
    );
  }

  const playerCode =
    user.player?.playerCode ??
    'Not assigned';

  const inGameName =
    user.player?.identity
      ?.inGameName ??
    'Not configured';

  return (
    <AppShell
      playerName={inGameName}
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1018] p-6 md:p-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-sky-400/10" />
          <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-sky-400/10" />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              Player Dashboard
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-6xl">
              Welcome back,
              <span className="block text-slate-400">
                {user.fullName}
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
              Manage your League, tournaments, fixtures and matches from one competition control center.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              FC ARENA ID
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {playerCode}
            </p>

            <p className="mt-2 text-xs text-slate-600">
              Permanent player identity
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              In-Game Name
            </p>

            <p className="mt-3 text-2xl font-black text-sky-400">
              {inGameName}
            </p>

            <p className="mt-2 text-xs text-slate-600">
              Used for competition identity
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Account Status
            </p>

            <p className="mt-3 text-2xl font-black text-emerald-400">
              {user.status}
            </p>

            <p className="mt-2 text-xs text-slate-600">
              Email verified account
            </p>
          </article>
        </section>

        <section>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              Competition Control Center
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight">
              Play. Manage. Compete.
            </h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {competitionSections.map(
              (section) => (
                <Link
                  key={section.href}
                  href={section.href}
                  className="group rounded-[24px] border border-white/10 bg-[#0a1018] p-5 transition hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-sky-400/[0.04]"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-lg font-black text-sky-300">
                      {section.icon}
                    </span>

                    <span className="text-lg text-slate-700 transition group-hover:text-sky-300">
                      →
                    </span>
                  </div>

                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                    {section.eyebrow}
                  </p>

                  <h3 className="mt-2 text-2xl font-black">
                    {section.title}
                  </h3>

                  <p className="mt-3 min-h-[60px] text-sm leading-6 text-slate-500">
                    {section.description}
                  </p>

                  <p className="mt-5 text-sm font-black text-white">
                    {section.action}
                  </p>
                </Link>
              ),
            )}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              Competition Flow
            </p>

            <h2 className="mt-2 text-2xl font-black">
              League → Tournament → Fixtures → Match
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                'Create / Join League',
                'Create / Join Tournament',
                'Generate Fixtures',
                'Play & Verify Result',
              ].map(
                (
                  label,
                  index,
                ) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <p className="text-xs font-black text-sky-400">
                      0{index + 1}
                    </p>

                    <p className="mt-2 text-sm font-black leading-5">
                      {label}
                    </p>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              Player Identity
            </p>

            <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-xl font-black text-sky-400">
              {user.fullName
                .split(' ')
                .map(
                  (part) =>
                    part[0],
                )
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <p className="mt-4 text-xl font-black">
              {user.fullName}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {user.email}
            </p>

            <Link
              href="/profile"
              className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              View Player Profile
            </Link>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
