'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminNavigation } from '@/components/admin/admin-navigation';
import {
  FcCrest,
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

interface Membership {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

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

interface TeamItem
  extends Entry {
  tournamentId: string;
  tournamentName: string;
  leagueName: string;
}

export default function AdminTeamsPage() {
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

        const adminLeagues:
          Membership[] =
          leagues.data.leagues.filter(
            (
              membership:
                Membership,
            ) =>
              Boolean(
                membership.adminRole,
              ),
          );

        const all =
          await Promise.all(
            adminLeagues.map(
              async (
                membership,
              ) => {
                const tournamentResponse =
                  await authenticatedRequest<any>(
                    `/leagues/${membership.league.id}/tournaments`,
                  );

                const tournaments:
                  Tournament[] =
                  tournamentResponse
                    .data
                    .tournaments;

                const groups =
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

                return groups.flat();
              },
            ),
          );

        setTeams(
          all.flat(),
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
      eyebrow="Admin"
      title="Team Management"
      subtitle="Tournament teams are managed in their Tournament context to preserve existing team and fixture logic."
    >
      <AdminNavigation />

      {teams.length === 0 ? (
        <FcEmptyState
          title="No Tournament teams"
          description="Teams are stored as Tournament entries in the current backend."
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
                  Manage in Tournament →
                </Link>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
