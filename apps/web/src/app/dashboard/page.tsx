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

import type {
  FcIconName,
} from '@/components/fc/fc-icons';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

import {
  FcCrest,
  FcLoadingScreen,
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

  tournamentHistory: Array<{
    tournament: {
      id: string;
    };

    registration: {
      id: string;
      entryName: string | null;
    };
  }>;

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
  id: string;
  entryName: string | null;

  members: Array<{
    id: string;
    fullName: string;
    inGameName: string | null;
  }>;
}


interface Fixture {
  id: string;
  sequence: number;
  matchday: number | null;
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
  const now =
    Date.now();

  const firstTime =
    first.scheduledAt
      ? new Date(
          first.scheduledAt,
        ).getTime()
      : null;

  const secondTime =
    second.scheduledAt
      ? new Date(
          second.scheduledAt,
        ).getTime()
      : null;

  const firstFuture =
    firstTime !== null &&
    firstTime >= now;

  const secondFuture =
    secondTime !== null &&
    secondTime >= now;

  if (
    firstFuture &&
    secondFuture
  ) {
    return (
      firstTime! -
      secondTime!
    );
  }

  if (firstFuture) {
    return -1;
  }

  if (secondFuture) {
    return 1;
  }

  if (
    firstTime === null &&
    secondTime === null
  ) {
    return (
      first.sequence -
      second.sequence
    );
  }

  if (
    firstTime === null
  ) {
    return -1;
  }

  if (
    secondTime === null
  ) {
    return 1;
  }

  return (
    first.sequence -
    second.sequence
  );
}


function fixtureBelongsToUser(
  fixture: DashboardFixture,
  userId: string,
  registrationId:
    string | null,
) {
  if (
    registrationId &&
    (
      fixture.home?.id ===
        registrationId ||
      fixture.away?.id ===
        registrationId
    )
  ) {
    return true;
  }

  return [
    ...(fixture.home
      ?.members ??
      []),

    ...(fixture.away
      ?.members ??
      []),
  ].some(
    (
      member,
    ) =>
      member.id ===
      userId,
  );
}


function SectionTitle({
  icon,
  title,
  href,
  linkLabel = 'View All →',
}: {
  icon: FcIconName;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="theme-soft-accent grid h-10 w-10 place-items-center rounded-xl border" aria-hidden="true">
          <FcIcon
            name={icon}
            size={19}
          />
        </span>

        <h2 className="theme-text fc-display text-[19px] font-semibold">
          {title}
        </h2>
      </div>

      {href ? (
        <Link
          href={href}
          className="theme-text-link text-sm font-medium transition"
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


  const registrationIdsByTournament =
    useMemo(
      () =>
        new Map(
          (
            career
              ?.tournamentHistory ??
            []
          ).map(
            (
              entry,
            ) => [
              entry.tournament
                .id,

              entry.registration
                .id,
            ],
          ),
        ),
      [
        career,
      ],
    );


  const personalOpenFixtures =
    useMemo(
      () => {
        if (!user) {
          return [];
        }

        return fixtures
          .filter(
            (
              fixture,
            ) =>
              fixtureIsOpen(
                fixture,
              ) &&
              fixtureBelongsToUser(
                fixture,
                user.id,
                registrationIdsByTournament.get(
                  fixture.tournamentId,
                ) ??
                  null,
              ),
          )
          .sort(
            sortUpcoming,
          );
      },
      [
        fixtures,
        registrationIdsByTournament,
        user,
      ],
    );


  const nextFixture =
    personalOpenFixtures[0] ??
    null;


  const activeTournamentNextFixture =
    useMemo(
      () => {
        if (
          !activeTournament
        ) {
          return null;
        }

        return (
          personalOpenFixtures.find(
            (
              fixture,
            ) =>
              fixture.tournamentId ===
              activeTournament.id,
          ) ??
          null
        );
      },
      [
        activeTournament,
        personalOpenFixtures,
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
      <div className="fc-dashboard-page relative space-y-5 sm:space-y-6">
        <div
          className="fc-dashboard-backdrop"
          aria-hidden="true"
        >
          <span className="fc-dashboard-backdrop-grid" />
          <span className="fc-dashboard-light fc-dashboard-light-one" />
          <span className="fc-dashboard-light fc-dashboard-light-two" />
          <span className="fc-dashboard-beam fc-dashboard-beam-one" />
          <span className="fc-dashboard-beam fc-dashboard-beam-two" />
          <span className="fc-dashboard-particles" />
          <span className="fc-dashboard-ring fc-dashboard-ring-one" />
          <span className="fc-dashboard-ring fc-dashboard-ring-two" />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <section className="fc-dashboard-hero fc-stadium-surface relative min-h-[220px] overflow-hidden rounded-2xl border">
          <div className="fc-hero-art" />
          <div className="fc-hero-right hidden lg:block" />
          <div className="fc-dashboard-hero-scan" aria-hidden="true" />
          <div className="fc-dashboard-hero-orbit" aria-hidden="true" />

          <div className="relative z-10 grid min-h-[220px] gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[auto_minmax(0,1fr)_300px] lg:items-center lg:px-8">
            <div className="hidden lg:block">
              <div className="theme-hero-avatar-ring grid h-[86px] w-[86px] place-items-center rounded-full border-[3px]">
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
              </div>
            </div>

            <div className="min-w-0 lg:pr-5">
              <p className="theme-hero-kicker fc-dashboard-kicker text-[12px] font-bold tracking-[0.16em]">
                <span className="fc-dashboard-live-dot" aria-hidden="true" />
                WELCOME BACK
              </p>

              <h1 className="theme-text mt-2 truncate text-[38px] font-bold leading-[0.98] tracking-[-0.035em] sm:text-[44px] lg:text-[48px]">
                {
                  inGameName
                }
              </h1>

              <p className="theme-secondary-text mt-3 max-w-2xl text-[14px] leading-6">
                Your player identity, form and next competition action in one place.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="theme-soft-accent rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold">
                  {
                    playerCode
                  }
                </span>

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
                    tone="amber"
                  />
                ) : null}
              </div>
            </div>

            <div className="theme-hero-side-copy relative hidden h-full min-h-[168px] lg:block">
              <div className="absolute right-2 top-2 text-right">
                <p className="theme-hero-slogan rotate-[-5deg] text-[21px] font-semibold italic leading-[0.95] tracking-[-0.025em]">
                  More Than
                  <br />
                  A Game
                </p>
              </div>

              <div className="absolute bottom-1 right-2 text-right">
                <p className="theme-hero-side-label text-[10px] font-semibold tracking-[0.18em]">
                  PLAY
                  <br />
                  COMPETE
                  <br />
                  BELONG
                </p>

                <p className="theme-hero-side-code mt-3 font-mono text-[10px] tracking-[0.08em]">
                  {
                    playerCode
                  }
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="fc-dashboard-stats grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
              icon="fixtures"
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


        <section className="fc-dashboard-section grid gap-[18px] xl:grid-cols-[1.75fr_0.95fr]">
          <FcPanel className="fc-next-match-panel relative overflow-hidden p-5 sm:p-6">
            <div className="theme-match-art pointer-events-none absolute inset-x-0 bottom-0 h-[72%]" />
            <div className="fc-match-spotlight" aria-hidden="true" />

            <div className="relative">
              <SectionTitle
                icon="fixtures"
                title="Next Match"
              href="/fixtures"
            />

            {nextFixture ? (
              <>
                <p className="mt-4 text-xs font-medium text-[#8792A1]">
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

                    <p className="mt-3 w-full truncate text-sm font-semibold text-[#0B2545]">
                      {
                        entryName(
                          nextFixture.home,
                        )
                      }
                    </p>
                  </div>

                  <div className="theme-neutral-block grid h-12 w-12 place-items-center rounded-xl border text-xs font-semibold">
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

                    <p className="mt-3 w-full truncate text-sm font-semibold text-[#0B2545]">
                      {
                        entryName(
                          nextFixture.away,
                        )
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-[#DED8CD] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-[#8792A1]">
                      {
                        nextFixture.leagueName
                      }
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#54657A]">
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
                    className="theme-primary-button inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                  >
                    View Match →
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-6 text-center sm:p-8">
                <div className="theme-soft-accent mx-auto grid h-12 w-12 place-items-center rounded-xl border text-lg">
                  ◷
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#0B2545]">
                  No upcoming match
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8792A1]">
                  Your next scheduled fixture will appear here when a competition schedule is ready.
                </p>

                <Link
                  href="/fixtures"
                  className="theme-primary-button mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                >
                  View Fixtures →
                </Link>
              </div>
            )}
            </div>
          </FcPanel>


          <FcPanel className="fc-league-panel p-5 sm:p-6">
            <SectionTitle
              icon="league"
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
                    <h3 className="truncate text-lg font-semibold text-[#0B2545]">
                      {
                        primaryMembership
                          .league
                          .name
                      }
                    </h3>

                    <p className="mt-1 font-mono text-xs font-semibold text-[#A06B13]">
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
                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">
                      Region
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
                      {primaryMembership
                        .league
                        .region ||
                        'Global'}
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">
                      Members
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#0B2545]">
                      {
                        primaryMembership
                          .league
                          .members
                      }
                    </p>
                  </div>

                  <div className="fc-luxury-info rounded-xl p-3">
                    <p className="text-xs text-[#8792A1]">
                      Role
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
                      {primaryMembership.adminRole ||
                        'Player'}
                    </p>
                  </div>
                </div>


                <Link
                  href={
                    `/leagues/${primaryMembership.league.id}`
                  }
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  Open League →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-6 text-center">
                <p className="text-base font-semibold text-[#0B2545]">
                  No active League
                </p>

                <p className="mt-2 text-sm leading-6 text-[#8792A1]">
                  Join with an invite code or create your own FC ARENA League.
                </p>

                <Link
                  href="/leagues"
                  className="theme-primary-button mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                >
                  Join or Create League →
                </Link>
              </div>
            )}
          </FcPanel>
        </section>


        <section className="fc-dashboard-section grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <FcPanel className="fc-tournament-panel p-5 sm:p-6">
            <SectionTitle
              icon="tournament"
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
                    <h3 className="truncate text-lg font-semibold text-[#0B2545]">
                      {
                        activeTournament.name
                      }
                    </h3>

                    <p className="mt-1 text-xs text-[#8792A1]">
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
                    <span className="text-[#8792A1]">
                      Competition progress
                    </span>

                    <span className="font-medium text-[#54657A]">
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

                  <div className="theme-progress-track mt-2 h-2 overflow-hidden rounded-full">
                    <div
                      className="theme-progress-bar h-full rounded-full"
                      style={{
                        width:
                          `${progress}%`,
                      }}
                    />
                  </div>
                </div>


                {activeTournamentNextFixture ? (
                  <div className="mt-5 rounded-xl border border-[#E3DCCF] bg-[#FAF7F0] p-4">
                    <p className="text-xs text-[#8792A1]">
                      Next fixture
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-[#0B2545]">
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
                  className="theme-secondary-button mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-semibold transition"
                >
                  View Tournament →
                </Link>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-6 text-center sm:p-8">
                <div className="theme-soft-accent mx-auto grid h-12 w-12 place-items-center rounded-xl border text-lg">
                  🏆
                </div>

                <h3 className="mt-4 text-base font-semibold text-[#0B2545]">
                  No Active Tournament
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8792A1]">
                  Browse your League competitions or start a new Tournament when you have admin access.
                </p>

                <Link
                  href="/tournaments"
                  className="theme-primary-button mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold"
                >
                  Browse Tournaments →
                </Link>
              </div>
            )}
          </FcPanel>


          <div className="fc-quick-actions-panel">
            <SectionTitle
              icon="activity"
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
                icon="fixtures"
                title="View Fixtures"
                description="Check upcoming matches"
                tone="slate"
              />

              <FcQuickActionTile
                href={
                  primaryMembership
                    ? `/leaderboards?league=${primaryMembership.league.id}`
                    : '/leaderboards'
                }
                icon="activity"
                title="Leaderboard"
                description="View League performance rankings"
                tone="cyan"
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


        <FcPanel className="fc-activity-panel p-5 sm:p-6">
          <SectionTitle
            icon="history"
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
                        <p className="truncate text-sm font-medium text-[#0B2545]">
                          {
                            activity.tournament.name
                          }
                        </p>

                        <p className="mt-1 truncate text-xs text-[#8792A1]">
                          {
                            activity.tournament.league.name
                          }
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-sm font-semibold text-[#54657A]">
                        {
                          activity.home.name
                        }{' '}
                        <span className="text-[#0B2545]">
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
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-dashed border-[#DED8CD] bg-[#FBF8F2] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B2545]">
                  No recent activity
                </p>

                <p className="mt-1 text-sm text-[#8792A1]">
                  Verified match results will appear here.
                </p>
              </div>

              <Link
                href="/fixtures"
                className="theme-secondary-button inline-flex min-h-11 items-center justify-center rounded-[10px] border px-4 text-sm font-medium"
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
