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
  FcCrest,
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
  status: string;
}


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  status: string;
}


interface TeamItem
  extends Entry {
  tournamentId: string;
  tournamentName: string;
}


export default function LeagueTeamsPage() {
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
    teams,
    setTeams,
  ] =
    useState<TeamItem[]>(
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

        const tournaments:
          Tournament[] =
          tournamentResponse
            .data
            .tournaments;

        const entryGroups =
          await Promise.all(
            tournaments.map(
              async (
                tournament,
              ) => {
                try {
                  const response =
                    await authenticatedRequest<any>(
                      `/tournaments/${tournament.id}/entries`,
                    );

                  return (
                    response
                      .data
                      .entries as Entry[]
                  ).map(
                    (
                      entry,
                    ) => ({
                      ...entry,
                      tournamentId:
                        tournament.id,
                      tournamentName:
                        tournament.name,
                    }),
                  );
                } catch {
                  return [];
                }
              },
            ),
          );

        setTeams(
          entryGroups.flat(),
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
        label="Loading League Teams..."
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
          title="Teams"
          subtitle="Tournament entries currently representing this League. Team management remains scoped to each Tournament."
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />


        {teams.length ===
        0 ? (
          <FcEmptyState
            title="No Tournament teams yet"
            description="Teams are created inside Tournaments in the current backend."
            actionLabel="Open Tournaments"
            actionHref={
              `/leagues/${leagueId}/tournaments`
            }
          />
        ) : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map(
              (
                team,
              ) => (
                <FcPanel
                  key={
                    team.id
                  }
                  className="p-5"
                >
                  <div className="flex items-center gap-4">
                    <FcCrest
                      name={
                        team.entryName ||
                        'FC Team'
                      }
                      imageUrl={
                        team.entryLogoUrl
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-black">
                        {team.entryName ||
                          'Unnamed Entry'}
                      </h2>

                      <p className="mt-1 truncate text-xs text-slate-600">
                        {
                          team.tournamentName
                        }
                      </p>
                    </div>

                    <FcStatusBadge
                      label={
                        team.status
                      }
                      tone={
                        team.status ===
                        'APPROVED'
                          ? 'emerald'
                          : 'amber'
                      }
                    />
                  </div>

                  <Link
                    href={
                      `/tournaments/${team.tournamentId}/teams`
                    }
                    className="mt-4 inline-flex text-sm font-black text-sky-300"
                  >
                    Open Team Management →
                  </Link>
                </FcPanel>
              ),
            )}
          </section>
        )}


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            The current backend has Tournament entries rather than a separate persistent League Team model, so this page aggregates real Tournament team data instead of inventing a second team system.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
