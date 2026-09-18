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
  type HubTournament,
  loadAccessibleTournaments,
} from '@/lib/competition-hub';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

export default function TournamentsHubPage() {
  const router =
    useRouter();

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<HubTournament[]>(
      [],
    );

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        setTournaments(
          await loadAccessibleTournaments(),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournaments.',
        );

        if (!user) {
          router.replace(
            '/login',
          );
        }
      }
    }

    void load();
  }, [router]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Tournaments...
      </div>
    );
  }

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Competition Hub
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Tournaments
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Every tournament created inside your joined Leagues appears here. Enter a tournament to register, manage entries, generate fixtures or view standings.
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {tournaments.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-white/10 bg-[#0a1018] p-10 text-center">
            <p className="text-lg font-black text-slate-300">
              No tournaments available yet.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Join a League first, or create a tournament from a League you manage.
            </p>

            <Link
              href="/leagues"
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Leagues
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {tournaments.map(
              (tournament) => (
                <article
                  key={tournament.id}
                  className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-black text-sky-400">
                      {tournament.mode}
                    </span>

                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400">
                      {tournament.format.replaceAll(
                        '_',
                        ' ',
                      )}
                    </span>

                    {tournament.adminRole ? (
                      <span className="rounded-full border border-amber-400/20 px-3 py-1 text-[10px] font-black text-amber-300">
                        {tournament.adminRole}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {tournament.leagueName}
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    {tournament.name}
                  </h2>

                  <p className="mt-2 font-mono text-xs text-slate-600">
                    {tournament.code}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Entries
                      </p>

                      <p className="mt-1 font-black">
                        {tournament.approvedEntries}/
                        {tournament.maxEntries}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Status
                      </p>

                      <p className="mt-1 truncate text-xs font-black">
                        {tournament.status.replaceAll(
                          '_',
                          ' ',
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Start
                      </p>

                      <p className="mt-1 text-xs font-black">
                        {tournament.startAt
                          ? new Date(
                              tournament.startAt,
                            ).toLocaleDateString()
                          : 'TBD'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#041019]"
                    >
                      Enter Tournament
                    </Link>

                    <Link
                      href={`/tournaments/${tournament.id}/standings`}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                    >
                      Points Table
                    </Link>
                  </div>
                </article>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
