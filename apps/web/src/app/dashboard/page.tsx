'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        router.replace('/login');
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

  const playerCode = user.player?.playerCode ?? 'Not assigned';
  const inGameName =
    user.player?.identity?.inGameName ?? 'Not configured';

  return (
    <AppShell playerName={inGameName}>
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
              Your FC ARENA identity is active. Your league,
              tournament, match and career data will build here as
              you compete.
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

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                  Current Competition
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  No active league yet
                </h2>
              </div>

              <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-500">
                READY
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <p className="font-bold text-slate-300">
                Your football journey starts with a League.
              </p>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                In the next development stage you will be able to
                create a League or join one using a unique League
                Code.
              </p>
            </div>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              Player Identity
            </p>

            <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-xl font-black text-sky-400">
              {user.fullName
                .split(' ')
                .map((part) => part[0])
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

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}