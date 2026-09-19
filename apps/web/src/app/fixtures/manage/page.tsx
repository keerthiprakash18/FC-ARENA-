'use client';

import Link from 'next/link';
import {
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
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


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
  code: string;
  status: string;
  fixturesGeneratedAt?: string | null;
}


interface ManagedTournament
  extends Tournament {
  leagueName: string;
}


export default function FixtureManagementPage() {
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
    tournaments,
    setTournaments,
  ] =
    useState<ManagedTournament[]>(
      [],
    );


  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const leaguesResponse =
          await authenticatedRequest<any>(
            '/leagues/my',
          );

        const adminLeagues:
          Membership[] =
          leaguesResponse
            .data
            .leagues
            .filter(
              (
                membership:
                  Membership,
              ) =>
                Boolean(
                  membership.adminRole,
                ),
            );

        const groups =
          await Promise.all(
            adminLeagues.map(
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
        router.replace(
          '/fixtures',
        );
      }
    })();
  }, [
    router,
  ]);


  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Fixture Management..."
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
          backHref="/fixtures"
          backLabel="Fixtures"
          eyebrow="Admin Workflow"
          title="Fixture Management"
          subtitle="Open the existing Tournament fixture and match tools without cluttering the normal player Match Center."
          action={
            <Link
              href="/fixtures/generator"
              className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
            >
              Open Generator
            </Link>
          }
        />


        {tournaments.length ===
        0 ? (
          <FcEmptyState
            title="No admin Tournaments"
            description="You need League admin access and a Tournament before fixture management is available."
            actionLabel="Open Tournaments"
            actionHref="/tournaments"
          />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {tournaments.map(
              (
                tournament,
              ) => (
                <FcPanel
                  key={
                    tournament.id
                  }
                  className="p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                        {
                          tournament.leagueName
                        }
                      </p>

                      <h2 className="mt-2 text-xl font-black">
                        {
                          tournament.name
                        }
                      </h2>

                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        {
                          tournament.code
                        }
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
                          : tournament.status ===
                              'DRAFT'
                            ? 'amber'
                            : 'cyan'
                      }
                    />
                  </div>


                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={
                        `/tournaments/${tournament.id}/fixtures`
                      }
                      className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                    >
                      Manage Schedule
                    </Link>

                    <Link
                      href={
                        `/tournaments/${tournament.id}/settings`
                      }
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                    >
                      Tournament Settings
                    </Link>

                    {tournament.status ===
                    'DRAFT' ? (
                      <Link
                        href={
                          `/tournaments/${tournament.id}/wizard/fixture-settings`
                        }
                        className="rounded-xl border border-emerald-400/20 px-4 py-3 text-sm font-black text-emerald-300"
                      >
                        Draft Generator
                      </Link>
                    ) : null}
                  </div>
                </FcPanel>
              ),
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
