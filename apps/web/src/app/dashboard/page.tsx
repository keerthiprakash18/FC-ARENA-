'use client';

import Link from 'next/link';
import {
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
  FcCrest,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcQuickActionTile,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface CareerData {
  profile: {
    playerCode: string | null;
    profileImageUrl: string | null;

    identity: {
      inGameName: string;
      isVerified: boolean;
    } | null;

    primaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
        logoUrl: string | null;
        region: string | null;
      };
    } | null;

    secondaryLeague: {
      league: {
        id: string;
        name: string;
        code: string;
        logoUrl: string | null;
        region: string | null;
      };
    } | null;
  };

  lifetimeStatistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
  };

  matchHistory: Array<{
    id: string;
    outcome: 'W' | 'D' | 'L';
    confirmedAt: string;

    tournament: {
      name: string;

      league: {
        name: string;
      };
    };

    home: {
      name: string;
      score: number;
    };

    away: {
      name: string;
      score: number;
    };
  }>;
}


interface Membership {
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';

  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
    code: string;
    logoUrl?: string | null;
    region: string | null;
    members: number;
    maxMembers: number;
  };
}


interface Tournament {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  status: string;
  format: string;
  competitionFormat?: string;
  approvedEntries: number;
  maxEntries: number;
  startAt: string | null;
}


interface FixtureEntry {
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
  home: FixtureEntry | null;
  away: FixtureEntry | null;

  match: {
    id: string;
    status: string;
  } | null;
}


interface DashboardTournament
  extends Tournament {
  leagueId: string;
  leagueName: string;
}


interface DashboardFixture
  extends Fixture {
  tournamentId: string;
  tournamentName: string;
  leagueName: string;
}


function entryName(
  entry: FixtureEntry | null,
) {
  if (!entry) {
    return 'TBD';
  }

  return (
    entry.entryName ||
    entry.members[0]
      ?.inGameName ||
    entry.members[0]
      ?.fullName ||
    'Entry'
  );
}


function fixtureIsOpen(
  fixture: DashboardFixture,
) {
  return (
    ![
      'COMPLETED',
      'CANCELLED',
    ].includes(
      fixture.status,
    ) &&
    ![
      'COMPLETED',
      'CANCELLED',
    ].includes(
      fixture.match
        ?.status ??
        '',
    )
  );
}


function sortUpcoming(
  first: DashboardFixture,
  second: DashboardFixture,
) {
  if (
    !first.scheduledAt &&
    !second.scheduledAt
  ) {
    return 0;
  }

  if (
    !first.scheduledAt
  ) {
    return 1;
  }

  if (
    !second.scheduledAt
  ) {
    return -1;
  }

  return (
    new Date(
      first.scheduledAt,
    ).getTime() -
    new Date(
      second.scheduledAt,
    ).getTime()
  );
}


function SectionTitle({
  icon,
  title,
  href,
  linkLabel = 'View All →',
}: {
  icon: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#203141] bg-[#14212D] text-base text-[#19B7FF]">
          {icon}
        </span>

        <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#F8FAFC]">
          {title}
        </h2>
      </div>

      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-[#8290A0] transition hover:text-[#19B7FF]"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}


export default function DashboardPage() {
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
    career,
    setCareer,
  ] =
    useState<CareerData | null>(
      null,
    );

  const [
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<DashboardTournament[]>(
      [],
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<DashboardFixture[]>(
      [],
    );

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    async function load() {
      try {
        const [
          currentUser,
          careerResponse,
          leaguesResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              success: true;
              data: CareerData;
              error: null;
            }>(
              '/players/me/career',
            ),

            authenticatedRequest<{
              data: {
                leagues:
                  Membership[];
              };
            }>(
              '/leagues/my',
            ),
          ]);

        setUser(
          currentUser,
        );

        setCareer(
          careerResponse.data,
        );

        const leagues =
          leaguesResponse
            .data
            .leagues;

        setMemberships(
          leagues,
        );

        const primary =
          leagues.find(
            (
              membership,
            ) =>
              membership.membershipType ===
              'PRIMARY',
          ) ??
          leagues[0];

        if (!primary) {
          return;
        }

        const tournamentResponse =
          await authenticatedRequest<{
            data: {
              tournaments:
                Tournament[];
            };
          }>(
            `/leagues/${primary.league.id}/tournaments`,
          );

        const dashboardTournaments =
          tournamentResponse
            .data
            .tournaments
            .map(
              (
                tournament,
              ) => ({
                ...tournament,

                leagueId:
                  primary.league.id,

                leagueName:
                  primary.league.name,
              }),
            );

        setTournaments(
          dashboardTournaments,
        );

        const fixtureGroups =
          await Promise.all(
            dashboardTournaments.map(
              async (
                tournament,
              ) => {
                try {
                  const response =
                    await authenticatedRequest<{
                      data: {
                        fixtures:
                          Fixture[];
                      };
                    }>(
                      `/tournaments/${tournament.id}/fixtures`,
                    );

                  return response
                    .data
                    .fixtures
                    .map(
                      (
                        fixture,
                      ) => ({
                        ...fixture,

                        tournamentId:
                          tournament.id,

                        tournamentName:
                          tournament.name,

                        leagueName:
                          primary
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

        setFixtures(
          fixtureGroups.flat(),
        );
      } catch (
        err
      ) {
        try {
          await getCurrentUser();
        } catch {
          router.replace(
            '/login',
          );

          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard.',
        );
      }
    }

    void load();
  }, [
    router,
  ]);


  const primaryMembership =
    useMemo(
      () =>
        memberships.find(
          (
            membership,
          ) =>
            membership.membershipType ===
            'PRIMARY',
        ) ??
        memberships[0] ??
        null,
      [
        memberships,
      ],
    );


  const activeTournament =
    useMemo(
      () =>
        tournaments.find(
          (
            tournament,
          ) =>
            ![
              'COMPLETED',
              'CANCELLED',
            ].includes(
              tournament.status,
            ),
        ) ??
        null,
      [
        tournaments,
      ],
    );


  const nextFixture =
    useMemo(
      () =>
        fixtures
          .filter(
            fixtureIsOpen,
          )
          .sort(
            sortUpcoming,
          )[0] ??
        null,
      [
        fixtures,
      ],
    );


  const activeTournamentNextFixture =
    useMemo(
      () => {
        if (
          !activeTournament
        ) {
          return null;
        }

        return (
          fixtures
            .filter(
              (
                fixture,
              ) =>
                fixture.tournamentId ===
                  activeTournament.id &&
                fixtureIsOpen(
                  fixture,
                ),
            )
            .sort(
              sortUpcoming,
            )[0] ??
          null
        );
      },
      [
        activeTournament,
        fixtures,
      ],
    );


  if (
    !user ||
    !career
  ) {
    return (
      <FcLoadingScreen
        label="Loading Home..."
      />
    );
  }


  const inGameName =
    career.profile
      .identity
      ?.inGameName ||
    user.player
      ?.identity
      ?.inGameName ||
    user.fullName;

  const playerCode =
    career.profile
      .playerCode ||
    user.player
      ?.playerCode ||
    'Pending';

  const stats =
    career.lifetimeStatistics;

  const isLeagueAdmin =
    Boolean(
      primaryMembership
        ?.adminRole,
    );

  const leagueLogo =
    primaryMembership
      ?.league
      .logoUrl ||
    career.profile
      .primaryLeague
      ?.league
      .logoUrl ||
    null;

  const createTournamentHref =
    primaryMembership
      ? `/leagues/${primaryMembership.league.id}/tournaments`
      : '/leagues';

  const progress =
    activeTournament &&
    activeTournament.maxEntries >
      0
      ? Math.min(
          100,
          (
            activeTournament.approvedEntries /
            activeTournament.maxEntries
          ) *
            100,
        )
      : 0;

  const recentActivity =
    career.matchHistory.slice(
      0,
      3,
    );


  return (
    <AppShell
      playerName={
        inGameName
      }
      playerRole={
        primaryMembership
          ?.adminRole ||
        'Player'
      }
    >
      <div className="space-y-7">
        <FcPageHeader
          title="Home"
          subtitle="Your FC ARENA overview"
        />


        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="relative min-h-[190px] overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_82%_105%,rgba(25,183,255,0.13),transparent_38%),linear-gradient(115deg,rgba(25,183,255,0.045),transparent_48%)]" />

          <div className="pointer-events-none absolute -bottom-20 right-[-4%] hidden h-64 w-[46%] rounded-[50%] border border-white/[0.045] lg:block" />
          <div className="pointer-events-none absolute -bottom-12 right-[3%] hidden h-48 w-[34%] rounded-[50%] border border-white/[0.035] lg:block" />
          <div className="pointer-events-none absolute bottom-0 right-[10%] hidden h-24 w-px bg-white/[0.04] lg:block" />

          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-[#19B7FF]">
                WELCOME BACK
              </p>

              <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.05] tracking-[-0.035em] text-[#F8FAFC] sm:text-[38px] lg:text-[42px]">
                {
                  inGameName
                }
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#A7B0BE]">
                Your player identity, form and next competition action in one place.
              </p>
            </div>


            <div className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-[#203141] bg-[#0B1118]/75 p-3.5 backdrop-blur-sm">
              <FcCrest
                name={
                  inGameName
                }
                imageUrl={
                  career.profile
                    .profileImageUrl
                }
                size="lg"
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#F8FAFC]">
                  {
                    inGameName
                  }
                </p>

                <p className="mt-1 font-mono text-xs text-[#19B7FF]">
                  {
                    playerCode
                  }
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <FcStatusBadge
                    label={
                      user.status
                    }
                    tone="emerald"
                  />

                  {career.profile
                    .identity
                    ?.isVerified ? (
                    <FcStatusBadge
                      label="Verified"
                      tone="cyan"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </FcPanel>


        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Link href="/career">
            <FcStatCard
              label="Matches"
              value={
                stats.matches
              }
              detail="View career stats"
              icon="▤"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Wins"
              value={
                stats.wins
              }
              detail={
                `${stats.draws} draws • ${stats.losses} losses`
              }
              tone="emerald"
              icon="✓"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Goals"
              value={
                stats.goalsFor
              }
              detail={
                `Goal difference: ${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}`
              }
              tone="amber"
              icon="⚽"
            />
          </Link>

          <Link href="/career">
            <FcStatCard
              label="Win Rate"
              value={
                `${stats.winRate}%`
              }
              detail="View detailed stats"
              icon="↗"
            />
          </Link>
        </section>


        <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <FcPanel className="p-5 sm:p-6">
            <SectionTitle
              icon="⚽"
              title="Next Match"
              href="/fixtures"
            />

            {nextFixture ? (
              <>
                <p className="mt-4 text-xs font-medium text-[#6F7B8A]">
                  {
                    nextFixture.tournamentName
                  }
                  {' • '}
                  {
                    nextFixture.roundName
                  }
                </p>

                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                  <div className="flex min-w-0 flex-col items-center text-center">
                    <FcCrest
                      name={
                        entryName(
                          nextFixture.home,
                        )
                      }
                      size="lg"
                    />

                    <p className="mt-3 w-full truncate text-sm font-semibold text-[#F8FAFC]">
                      {
                        entryName(
                          nextFixture.home,
                        )
                      }
                    </p>
                  </div>

                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#284154] bg-[#14212D] text-xs font-semibold text-[#A7B0BE]">
                    VS
                  </div>

                  <div className="flex min-w-0 flex-col items-center text-center">
                    <FcCrest
                      name={
                        entryName(
                          nextFixture.away,
                        )
                      }
                      size="lg"
                    />

                    <p className="mt-3 w-full truncate text-sm font-semibold text-[#F8FAFC]">
                      {
                        entryName(
                          nextFixture.away,
                        )
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-[#203141] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-[#6F7B8A]">
                      {
                        nextFixture.leagueName
                      }
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#A7B0BE]">
                      {nextFixture.scheduledAt
                        ? new Date(
                            nextFixture.scheduledAt,
                          ).toLocaleString()
                        : 'Schedule pending'}
                    </p>
                  </div>

                  <Link
                    href={
                      nextFixture.match
                        ?.id
                        ? `/matches/${nextFixture.match.id}`
                        : `/tournaments/${nextFixture.tournamentId}/fixtures`
                    }
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#19B7FF] px-5 text-sm font-semibold text-[#071019] transition hover:bg-[#21C3FF]"
                  >
                    View Match →
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#284154] bg-[#0B1118]/55 p-6 text-center sm:p-8">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[#284154] bg-[#14212D] text-lg text-[#19B7FF]">
                  ◷
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">
                  No upcoming match
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6F7B8A]">
                  Your next scheduled fixture will appear here when a competition schedule is ready.
                </p>

                <Link
                  href="/fixtures"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#19B7FF] px-5 text-sm font-semibold text-[#071019] hover:bg-[#21C3FF]"
                >
                  View Fixtures →
                </Link>
              </div>
            )}
          </FcPanel>


          <FcPanel className="p-5 sm:p-6">
            <SectionTitle
              icon="◈"
              title="My League"
              href="/leagues"
              linkLabel="All Leagues →"
            />

            {primaryMembership ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={
                      primaryMembership
                        .league
                        .name
                    }
                    imageUrl={
                      leagueLogo
                    }
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-[#F8FAFC]">
                      {
                        primaryMembership
                          .league
                          .name
                      }
                    </h3>

                    <p className="mt-1 font-mono text-xs text-[#19B7FF]">
                      {
                        primaryMembership
                          .league
                          .code
                      }
                    </p>

                    <div className="mt-2">
                      <FcStatusBadge
                        label={
                          primaryMembership.membershipType
                        }
                        tone="cyan"
                      />
                    </div>
                  </div>
                </div>


                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-[#203141] bg-[#0B1118]/60 p-3">
                    <p className="text-xs text-[#6F7B8A]">
                      Region
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#F8FAFC]">
                      {primaryMembership
                        .league
                        .region ||
                        'Global'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#203141] bg-[#0B1118]/60 p-3">
                    <p className="text-xs text-[#6F7B8A]">
                      Members
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#F8FAFC]">
                      {
                        primaryMembership
                          .league
                          .members
                      }
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#203141] bg-[#0B1118]/60 p-3">
                    <p className="text-xs text-[#6F7B8A]">
                      Role
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#F8FAFC]">
                      {primaryMembership.adminRole ||
                        'Player'}
                    </p>
                  </div>
                </div>


                <Link
                  href={
                    `/leagues/${primaryMembership.league.id}`
                  }
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-[#284154] bg-[#14212D] px-5 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#19B7FF]/40 hover:bg-[#182936]"
                >
                  Open League →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#284154] bg-[#0B1118]/55 p-6 text-center">
                <p className="text-base font-semibold text-[#F8FAFC]">
                  No active League
                </p>

                <p className="mt-2 text-sm leading-6 text-[#6F7B8A]">
                  Join with an invite code or create your own FC ARENA League.
                </p>

                <Link
                  href="/leagues"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#19B7FF] px-5 text-sm font-semibold text-[#071019]"
                >
                  Join or Create League →
                </Link>
              </div>
            )}
          </FcPanel>
        </section>


        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <FcPanel className="p-5 sm:p-6">
            <SectionTitle
              icon="🏆"
              title="Active Tournament"
              href="/tournaments"
            />

            {activeTournament ? (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <FcCrest
                    name={
                      activeTournament.name
                    }
                    imageUrl={
                      activeTournament.logoUrl
                    }
                    size="lg"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-[#F8FAFC]">
                      {
                        activeTournament.name
                      }
                    </h3>

                    <p className="mt-1 text-xs text-[#6F7B8A]">
                      {
                        (
                          activeTournament.competitionFormat ||
                          activeTournament.format
                        ).replaceAll(
                          '_',
                          ' ',
                        )
                      }
                    </p>

                    <div className="mt-2">
                      <FcStatusBadge
                        label={
                          activeTournament.status
                        }
                        tone="emerald"
                      />
                    </div>
                  </div>
                </div>


                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6F7B8A]">
                      Competition progress
                    </span>

                    <span className="font-medium text-[#A7B0BE]">
                      {
                        activeTournament.approvedEntries
                      }
                      /
                      {
                        activeTournament.maxEntries
                      }{' '}
                      entries
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0B1118]">
                    <div
                      className="h-full rounded-full bg-[#19B7FF]"
                      style={{
                        width:
                          `${progress}%`,
                      }}
                    />
                  </div>
                </div>


                {activeTournamentNextFixture ? (
                  <div className="mt-5 rounded-xl border border-[#203141] bg-[#0B1118]/55 p-4">
                    <p className="text-xs text-[#6F7B8A]">
                      Next fixture
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#F8FAFC]">
                      {entryName(
                        activeTournamentNextFixture.home,
                      )}
                      {'  vs  '}
                      {entryName(
                        activeTournamentNextFixture.away,
                      )}
                    </p>
                  </div>
                ) : null}


                <Link
                  href={
                    `/tournaments/${activeTournament.id}`
                  }
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-[#284154] bg-[#14212D] px-5 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#19B7FF]/40 hover:bg-[#182936]"
                >
                  View Tournament →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#284154] bg-[#0B1118]/55 p-6 text-center sm:p-8">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[#284154] bg-[#14212D] text-lg text-[#F3B326]">
                  🏆
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">
                  No Active Tournament
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6F7B8A]">
                  Browse your League competitions or start a new Tournament when you have admin access.
                </p>

                <Link
                  href="/tournaments"
                  className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#19B7FF] px-5 text-sm font-semibold text-[#071019]"
                >
                  Browse Tournaments →
                </Link>
              </div>
            )}
          </FcPanel>


          <div>
            <SectionTitle
              icon="✦"
              title="Quick Actions"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FcQuickActionTile
                href="/leagues"
                icon="+"
                title="Join League"
                description="Use invite code"
                tone="cyan"
              />

              <FcQuickActionTile
                href={
                  createTournamentHref
                }
                icon="◇"
                title={
                  isLeagueAdmin
                    ? 'Create Tournament'
                    : 'Tournaments'
                }
                description={
                  isLeagueAdmin
                    ? 'Start a new competition'
                    : 'Browse competitions'
                }
                tone="emerald"
              />

              <FcQuickActionTile
                href="/fixtures"
                icon="⚽"
                title="View Fixtures"
                description="Check upcoming matches"
                tone="slate"
              />

              <FcQuickActionTile
                href="/profile"
                icon="◎"
                title="Update Profile"
                description="Edit your information"
                tone="amber"
              />
            </div>
          </div>
        </section>


        <FcPanel className="p-5 sm:p-6">
          <SectionTitle
            icon="↺"
            title="Latest Activity"
            href="/career/matches"
            linkLabel="View All Activity →"
          />

          {recentActivity.length >
          0 ? (
            <div className="mt-5 divide-y divide-[#203141]">
              {recentActivity.map(
                (
                  activity,
                ) => (
                  <Link
                    key={
                      activity.id
                    }
                    href={
                      `/matches/${activity.id}`
                    }
                    className="flex flex-col gap-3 py-4 transition first:pt-0 last:pb-0 hover:bg-white/[0.012] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-semibold ${
                          activity.outcome ===
                          'W'
                            ? 'border-[#1FD18A]/20 bg-[#1FD18A]/[0.07] text-[#1FD18A]'
                            : activity.outcome ===
                                'D'
                              ? 'border-[#F3B326]/20 bg-[#F3B326]/[0.07] text-[#F3B326]'
                              : 'border-[#EF5350]/20 bg-[#EF5350]/[0.07] text-[#EF5350]'
                        }`}
                      >
                        {
                          activity.outcome
                        }
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#F8FAFC]">
                          {
                            activity.tournament.name
                          }
                        </p>

                        <p className="mt-1 truncate text-xs text-[#6F7B8A]">
                          {
                            activity.tournament.league.name
                          }
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-sm font-semibold text-[#A7B0BE]">
                        {
                          activity.home.name
                        }{' '}
                        <span className="text-[#F8FAFC]">
                          {
                            activity.home.score
                          }
                          -
                          {
                            activity.away.score
                          }
                        </span>{' '}
                        {
                          activity.away.name
                        }
                      </p>

                      <p className="mt-1 text-xs text-[#536273]">
                        {new Date(
                          activity.confirmedAt,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-dashed border-[#284154] bg-[#0B1118]/45 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#F8FAFC]">
                  No recent activity
                </p>

                <p className="mt-1 text-sm text-[#6F7B8A]">
                  Verified match results will appear here.
                </p>
              </div>

              <Link
                href="/fixtures"
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#284154] bg-[#14212D] px-4 text-sm font-medium text-[#F8FAFC]"
              >
                View Fixtures →
              </Link>
            </div>
          )}
        </FcPanel>
      </div>
    </AppShell>
  );
}
