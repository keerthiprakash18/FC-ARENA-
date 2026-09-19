'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
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
}


interface Entry {
  entryName: string | null;

  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}


interface Fixture {
  id: string;
  roundName: string;
  status: string;
  scheduledAt: string | null;
  home: Entry | null;
  away: Entry | null;

  match: {
    id: string;
    status: string;
  } | null;
}


interface LeagueFixture
  extends Fixture {
  tournamentId: string;
  tournamentName: string;
}


function entryName(
  entry: Entry | null,
) {
  return (
    entry?.entryName ||
    entry?.members[0]
      ?.inGameName ||
    entry?.members[0]
      ?.fullName ||
    'TBD'
  );
}


export default function LeagueFixturesPage() {
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
    fixtures,
    setFixtures,
  ] =
    useState<LeagueFixture[]>(
      [],
    );

  const [
    filter,
    setFilter,
  ] =
    useState<
      'ALL'
      | 'UPCOMING'
      | 'COMPLETED'
    >(
      'ALL',
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

        const groups =
          await Promise.all(
            tournaments.map(
              async (
                tournament,
              ) => {
                try {
                  const response =
                    await authenticatedRequest<any>(
                      `/tournaments/${tournament.id}/fixtures`,
                    );

                  return (
                    response
                      .data
                      .fixtures as Fixture[]
                  ).map(
                    (
                      fixture,
                    ) => ({
                      ...fixture,
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

        setFixtures(
          groups.flat(),
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


  const visible =
    useMemo(
      () =>
        fixtures.filter(
          (
            fixture,
          ) => {
            const status =
              fixture.match
                ?.status ||
              fixture.status;

            if (
              filter ===
              'ALL'
            ) {
              return true;
            }

            if (
              filter ===
              'COMPLETED'
            ) {
              return (
                status ===
                'COMPLETED'
              );
            }

            return (
              status !==
                'COMPLETED' &&
              status !==
                'CANCELLED'
            );
          },
        ),
      [
        filter,
        fixtures,
      ],
    );


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading League Fixtures..."
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
          title="Fixtures"
          subtitle="A focused League match list. Open a match to view result, evidence and verification details."
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />


        <FcPanel className="p-3">
          <div className="grid grid-cols-3 gap-2">
            {([
              'ALL',
              'UPCOMING',
              'COMPLETED',
            ] as const).map(
              (
                value,
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      value,
                    )
                  }
                  className={`rounded-xl border px-3 py-3 text-xs font-black ${
                    filter ===
                    value
                      ? 'border-sky-400/30 bg-sky-400/[0.08] text-sky-300'
                      : 'border-white/[0.07] text-slate-500'
                  }`}
                >
                  {
                    value
                  }
                </button>
              ),
            )}
          </div>
        </FcPanel>


        {visible.length ===
        0 ? (
          <FcEmptyState
            title="No matching fixtures"
            description="Tournament fixtures from this League will appear here."
            actionLabel="Open Tournaments"
            actionHref={
              `/leagues/${leagueId}/tournaments`
            }
          />
        ) : (
          <section className="grid gap-3 xl:grid-cols-2">
            {visible.map(
              (
                fixture,
              ) => {
                const home =
                  entryName(
                    fixture.home,
                  );

                const away =
                  entryName(
                    fixture.away,
                  );

                return (
                  <Link
                    key={
                      fixture.id
                    }
                    href={
                      fixture.match
                        ?.id
                        ? `/matches/${fixture.match.id}`
                        : `/tournaments/${fixture.tournamentId}/fixtures`
                    }
                    className="group rounded-[22px] border border-white/10 bg-[#08111b] p-5 transition hover:-translate-y-0.5 hover:border-sky-400/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-400">
                          {
                            fixture.tournamentName
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {
                            fixture.roundName
                          }
                        </p>
                      </div>

                      <FcStatusBadge
                        label={
                          fixture.match
                            ?.status ||
                          fixture.status
                        }
                        tone={
                          (
                            fixture.match
                              ?.status ||
                            fixture.status
                          ) ===
                          'COMPLETED'
                            ? 'emerald'
                            : 'cyan'
                        }
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="flex min-w-0 items-center justify-end gap-2">
                        <p className="truncate text-right text-sm font-black">
                          {
                            home
                          }
                        </p>

                        <FcCrest
                          name={
                            home
                          }
                          size="sm"
                        />
                      </div>

                      <span className="text-xs font-black text-sky-300">
                        VS
                      </span>

                      <div className="flex min-w-0 items-center gap-2">
                        <FcCrest
                          name={
                            away
                          }
                          size="sm"
                        />

                        <p className="truncate text-sm font-black">
                          {
                            away
                          }
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                      <p className="text-xs text-slate-500">
                        {fixture.scheduledAt
                          ? new Date(
                              fixture.scheduledAt,
                            ).toLocaleString()
                          : 'Schedule pending'}
                      </p>

                      <span className="text-xs font-black text-sky-300">
                        Open →
                      </span>
                    </div>
                  </Link>
                );
              },
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
