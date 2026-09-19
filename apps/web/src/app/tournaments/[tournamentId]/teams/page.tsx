'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  fixtureCount: number;
}


export default function TournamentTeamsPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId:
        string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    tournament,
    setTournament,
  ] =
    useState<any>(
      null,
    );

  const [
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
      [],
    );


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          competition,
          teams,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/entries`,
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          competition
            .data
            .tournament,
        );

        setEntries(
          teams
            .data
            .entries,
        );
      } catch {
        router.replace(
          '/tournaments',
        );
      }
    }

    void load();
  }, [
    router,
    tournamentId,
  ]);


  if (
    !user ||
    !tournament
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Teams...
      </div>
    );
  }


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >

      <div className="space-y-6">

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        <section className="rounded-[28px] border border-white/10 bg-[#0a1018] p-6 md:p-8">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Tournament Teams
          </p>

          <h1 className="mt-2 text-4xl font-black">
            {
              tournament.name
            }
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {
              entries.length
            } team(s)
          </p>

        </section>


        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {entries.map(
            (
              entry,
            ) => (

              <article
                key={
                  entry.id
                }
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1018] p-5"
              >

                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-white/[0.04]">

                  {entry.entryLogoUrl ? (
                    <img
                      src={
                        entry.entryLogoUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-black text-slate-500">
                      {entry.entryName
                        ?.slice(
                          0,
                          2,
                        )
                        .toUpperCase() ??
                        'FC'}
                    </span>
                  )}

                </div>


                <div>
                  <h2 className="font-black">
                    {
                      entry.entryName ??
                      'Unnamed Team'
                    }
                  </h2>

                  <p className="mt-1 text-xs text-slate-600">
                    {
                      entry.fixtureCount
                    } fixtures
                  </p>
                </div>

              </article>
            ),
          )}

        </div>

      </div>

    </AppShell>
  );
}