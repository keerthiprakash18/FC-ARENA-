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


export default function TournamentSettingsPage() {
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


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}`,
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          response
            .data
            .tournament,
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
        Loading Settings...
      </div>
    );
  }


  const rows = [
    [
      'Format',
      tournament.competitionFormat,
    ],
    [
      'Group Mode',
      tournament.groupMode,
    ],
    [
      'Leg Type',
      tournament.legType,
    ],
    [
      'Fixture Mode',
      tournament.fixtureMode,
    ],
    [
      'Visibility',
      tournament.visibility,
    ],
    [
      'Registration',
      tournament.registrationMode,
    ],
    [
      'Maximum Entries',
      tournament.maxEntries,
    ],
  ];


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
            Tournament Settings
          </p>

          <h1 className="mt-2 text-4xl font-black">
            {
              tournament.name
            }
          </h1>


          <div className="mt-7 divide-y divide-white/5">

            {rows.map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    String(
                      label,
                    )
                  }
                  className="flex items-center justify-between gap-4 py-4"
                >

                  <p className="text-sm text-slate-500">
                    {
                      label
                    }
                  </p>

                  <p className="text-right font-black">
                    {String(
                      value ??
                      '—',
                    ).replaceAll(
                      '_',
                      ' ',
                    )}
                  </p>

                </div>
              ),
            )}

          </div>

        </section>

      </div>

    </AppShell>
  );
}