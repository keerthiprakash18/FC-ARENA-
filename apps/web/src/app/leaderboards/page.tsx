'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
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
  status: string;
  approvedEntries: number;
}

export default function LeaderboardsPage() {
  const [
    tournaments,
    setTournaments,
  ] =
    useState<
      Array<
        Tournament & {
          leagueName: string;
        }
      >
    >([]);

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

        const groups =
          await Promise.all(
            memberships.map(
              async (
                membership,
              ) => {
                const response =
                  await authenticatedRequest<any>(
                    `/leagues/${membership.league.id}/tournaments`,
                  );

                return (
                  response
                    .data
                    .tournaments as Tournament[]
                ).map(
                  (
                    tournament,
                  ) => ({
                    ...tournament,
                    leagueName:
                      membership
                        .league
                        .name,
                  }),
                );
              },
            ),
          );

        setTournaments(
          groups.flat(),
        );
      } catch {
        setTournaments(
          [],
        );
      }
    })();
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="Leaderboards"
      subtitle="Choose a Tournament to open its real standings. FC ARENA does not currently expose a separate global leaderboard API."
    >
      {tournaments.length === 0 ? (
        <FcEmptyState
          title="No Tournament leaderboards yet"
          description="Join a League and enter a Tournament to access live standings."
          actionLabel="Open Tournaments"
          actionHref="/tournaments"
        />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
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
                className="group"
              >
                <FcPanel className="p-5 transition group-hover:border-sky-400/25">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                        {
                          tournament.leagueName
                        }
                      </p>

                      <h2 className="mt-2 text-lg font-black">
                        {
                          tournament.name
                        }
                      </h2>

                      <p className="mt-1 text-xs text-slate-600">
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

                  <span className="mt-4 inline-flex text-sm font-black text-sky-300">
                    Open Standings →
                  </span>
                </FcPanel>
              </Link>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
