'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="border-b border-white/5 py-4 last:border-0">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 break-all text-sm font-semibold text-slate-200">
        {value || 'Not provided'}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setUser(await getCurrentUser());
      } catch {
        router.replace('/login');
      }
    }

    void loadProfile();
  }, [router]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-semibold text-slate-500">
        Loading Player Profile...
      </div>
    );
  }

  const identity = user.player?.identity;

  const initials = user.fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell playerName={identity?.inGameName}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1018]">
          <div className="h-28 bg-gradient-to-r from-sky-500/20 via-sky-400/5 to-transparent md:h-36" />

          <div className="px-5 pb-7 md:px-8">
            <div className="-mt-10 flex flex-col gap-5 md:-mt-12 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="grid h-24 w-24 place-items-center rounded-[26px] border-4 border-[#0a1018] bg-sky-400 text-2xl font-black text-[#041019]">
                  {initials}
                </div>

                <div className="pb-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                    FC ARENA PLAYER
                  </p>

                  <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] md:text-4xl">
                    {user.fullName}
                  </h1>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {identity?.inGameName ?? 'No in-game name'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                {user.status}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              Player Identity
            </p>

            <div className="mt-4">
              <Detail
                label="FC ARENA ID"
                value={user.player?.playerCode}
              />

              <Detail
                label="In-Game Name"
                value={identity?.inGameName}
              />

              <Detail
                label="Game UID"
                value={identity?.gameUid}
              />

              <Detail
                label="Identity Verification"
                value={
                  identity?.isVerified
                    ? 'Verified & Locked'
                    : 'Not yet verified'
                }
              />
            </div>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              Account Information
            </p>

            <div className="mt-4 grid gap-x-8 md:grid-cols-2">
              <div>
                <Detail label="Full Name" value={user.fullName} />
                <Detail label="Email" value={user.email} />
              </div>

              <div>
                <Detail
                  label="Phone Number"
                  value={user.phoneNumber}
                />

                <Detail label="Account Role" value={user.role} />
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600">
              Primary League
            </p>

            <p className="mt-4 text-lg font-black text-slate-400">
              Not joined
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600">
              Career Matches
            </p>

            <p className="mt-4 text-lg font-black text-slate-400">
              No matches yet
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600">
              Achievements
            </p>

            <p className="mt-4 text-lg font-black text-slate-400">
              No achievements yet
            </p>
          </article>
        </section>
      </div>
    </AppShell>
  );
}