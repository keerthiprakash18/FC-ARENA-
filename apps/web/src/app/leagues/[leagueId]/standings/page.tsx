'use client';

import Link from 'next/link';
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
  competitionLabel,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  LeagueNavigation,
} from '@/components/leagues/league-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface LeagueHome {
  id: string;
  name: string;
}


interface Tournament {
  id: string;
  name: string;
  code: string;
  status: string;
  format: string;
  competitionFormat?: string;
  approvedEntries: number;
}


export default function LeagueStandingsPage() {
  const {
    leagueId,
  } =
    useParams<{
      leagueId:
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
    league,
    setLeague,
  ] =
    useState<LeagueHome | null>(
      null,
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<Tournament[]>(
      [],
    );


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagueResponse,
          tournamentResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/leagues/${leagueId}`,
            ),

            authenticatedRequest<any>(
              `/leagues/${leagueId}/tournaments`,
            ),
          ]);

        setUser(
          current,
        );

        setLeague(
          leagueResponse
            .data
            .league,
        );

        setTournaments(
          tournamentResponse
            .data
            .tournaments,
        );
      } catch {
        router.replace(
          `/leagues/${leagueId}`,
        );
      }
    })();
  }, [
    leagueId,
    router,
  ]);


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading Standings..."
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
            `/leagues/${leagueId}`
          }
          backLabel="League Overview"
          eyebrow={
            league.name
          }
          title="Standings"
          subtitle="FC ARENA standings are calculated per Tournament, so choose a competition to open its live table."
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />


        {tournaments.length ===
        0 ? (
          <FcEmptyState
            title="No Tournament standings yet"
            description="Create or join a Tournament in this League before standings can be calculated."
            actionLabel="Open Tournaments"
            actionHref={
              `/leagues/${leagueId}/tournaments`
            }
          />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {tournaments.map(
              (
                tournament,
              ) => (
                <Link
                  key={
                    tournament.id
                  }
                  href={
                    `/tournaments/${tournament.id}/standings`
                  }
                  className="group rounded-[22px] border border-white/10 bg-[#08111b] p-5 transition hover:-translate-y-0.5 hover:border-sky-400/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] text-sky-400">
                        {
                          tournament.code
                        }
                      </p>

                      <h2 className="mt-2 text-xl font-black">
                        {
                          tournament.name
                        }
                      </h2>

                      <p className="mt-2 text-xs text-slate-600">
                        {
                          competitionLabel(
                            tournament.competitionFormat ||
                            tournament.format,
                          )
                        }
                        {' · '}
                        {
                          tournament.approvedEntries
                        }{' '}
                        entries
                      </p>
                    </div>

                    <FcStatusBadge
                      label={
                        tournament.status
                      }
                      tone={
                        tournament.status ===
                        'COMPLETED'
                          ? 'emerald'
                          : 'cyan'
                      }
                    />
                  </div>

                  <span className="mt-5 inline-flex text-sm font-black text-sky-300">
                    Open Standings →
                  </span>
                </Link>
              ),
            )}
          </section>
        )}


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            There is currently no separate League-wide standings table in the backend. This screen keeps the League context clean and routes you to each Tournament’s real standings data.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
