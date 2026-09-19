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
  BackHeader,
} from '@/components/app/back-header';

import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

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


interface Tournament {
  id: string;
  name: string;
  maxEntries: number;
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
    useState<Tournament | null>(
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
    void (async () => {
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
          `/tournaments/${tournamentId}`,
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);


  if (
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen
        label="Loading Tournament Teams..."
      />
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
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Teams"
          subtitle="Tournament entries only. Group assignment and fixture scheduling stay on their own dedicated screens."
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        {entries.length ===
        0 ? (
          <FcEmptyState
            title="No Tournament teams yet"
            description="Teams will appear here once entries are added or approved."
            actionLabel="Open Registration"
            actionHref={
              `/tournaments/${tournamentId}/registration`
            }
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map(
              (
                entry,
              ) => (
                <FcPanel
                  key={
                    entry.id
                  }
                  className="p-5"
                >
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={
                        entry.entryName ||
                        'FC Team'
                      }
                      imageUrl={
                        entry.entryLogoUrl
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-black">
                        {entry.entryName ||
                          'Unnamed Team'}
                      </h2>

                      <p className="mt-1 text-xs text-slate-600">
                        {
                          entry.fixtureCount
                        }{' '}
                        fixtures
                      </p>
                    </div>
                  </div>
                </FcPanel>
              ),
            )}
          </section>
        )}


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            {entries.length} of {tournament.maxEntries} Tournament entry slots currently contain real team data.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
