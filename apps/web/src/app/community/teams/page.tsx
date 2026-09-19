'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  FcCrest,
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

interface Membership {
  league: {
    id: string;
    name: string;
  };
}

interface Tournament {
  id: string;
  name: string;
}

interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  status: string;
}

interface TeamItem extends Entry {
  tournamentId: string;
  tournamentName: string;
  leagueName: string;
}

export default function CommunityTeamsPage() {
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
        const leagues =
          await authenticatedRequest<any>(
            '/leagues/my',
          );

        const memberships:
          Membership[] =
          leagues.data.leagues;

        const leagueGroups =
          await Promise.all(
            memberships.map(
              async (
                membership,
              ) => {
                const tournamentsResponse =
                  await authenticatedRequest<any>(
                    `/leagues/${membership.league.id}/tournaments`,
                  );

                const tournaments:
                  Tournament[] =
                  tournamentsResponse
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
                              leagueName:
                                membership
                                  .league
                                  .name,
                            }),
                          );
                        } catch {
                          return [];
                        }
                      },
                    ),
                  );

                return entryGroups.flat();
              },
            ),
          );

        setTeams(
          leagueGroups.flat(),
        );
      } catch {
        setTeams(
          [],
        );
      }
    })();
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Community"
      title="Teams"
      subtitle="Real Tournament teams aggregated from the Leagues you currently belong to."
    >
      {teams.length === 0 ? (
        <FcEmptyState
          title="No competition teams yet"
          description="The current backend stores teams as Tournament entries rather than a separate global Team directory."
          actionLabel="Open Tournaments"
          actionHref="/tournaments"
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
                      {' · '}
                      {
                        team.leagueName
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
                  Open Tournament Teams →
                </Link>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
