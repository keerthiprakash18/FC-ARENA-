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
  FcEmptyState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
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
    region: string | null;
    members: number;
    maxMembers: number;
  };
}


interface Tournament {
  id: string;
  name: string;
  code: string;
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
      () => {
        const open =
          fixtures.filter(
            (
              fixture,
            ) =>
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
              ),
          );

        return (
          open.sort(
            (
              first,
              second,
            ) => {
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
            },
          )[0] ??
          null
        );
      },
      [
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


  return (
    <AppShell
      playerName={
        inGameName
      }
    >
      <div className="space-y-7">
        <FcPageHeader
          eyebrow="Player Command Center"
          title="Home"
          subtitle="Your live FC ARENA snapshot — identity, form, league, tournaments and next action."
        />

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}

        <FcPanel className="relative overflow-hidden p-6 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.16),transparent_28%),linear-gradient(120deg,rgba(14,165,233,0.04),transparent_55%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Welcome Back
              </p>

              <h2 className="mt-2 font-['Rajdhani','Space_Grotesk',sans-serif] text-4xl font-black uppercase tracking-[-0.035em] sm:text-5xl">
                {
                  inGameName
                }
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                Keep your competition identity sharp, track form, and jump directly into the next match.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
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
                <p className="truncate text-lg font-black">
                  {
                    inGameName
                  }
                </p>

                <p className="mt-1 font-mono text-xs text-sky-400">
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


        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Matches"
            value={
              stats.matches
            }
            detail="Career total"
          />

          <FcStatCard
            label="Wins"
            value={
              stats.wins
            }
            detail={
              `${stats.draws} draws · ${stats.losses} losses`
            }
            tone="emerald"
          />

          <FcStatCard
            label="Goals"
            value={
              stats.goalsFor
            }
            detail={
              `GD ${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}`
            }
            tone="amber"
          />

          <FcStatCard
            label="Win Rate"
            value={
              `${stats.winRate}%`
            }
            detail="Verified results"
          />
        </section>


        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          {nextFixture ? (
            <FcPanel className="overflow-hidden p-5 sm:p-6">
              <FcSectionHeading
                eyebrow="Next Match"
                title={
                  nextFixture
                    .tournamentName
                }
                action={
                  <FcStatusBadge
                    label={
                      nextFixture.status
                    }
                    tone="cyan"
                  />
                }
              />

              <p className="mt-2 text-xs text-slate-600">
                {
                  nextFixture.leagueName
                }
                {' · '}
                {
                  nextFixture.roundName
                }
              </p>

              <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                <div className="flex min-w-0 flex-col items-center text-center">
                  <FcCrest
                    name={
                      entryName(
                        nextFixture.home,
                      )
                    }
                    size="lg"
                  />

                  <p className="mt-3 w-full truncate font-black">
                    {
                      entryName(
                        nextFixture.home,
                      )
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-sm font-black text-sky-300">
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

                  <p className="mt-3 w-full truncate font-black">
                    {
                      entryName(
                        nextFixture.away,
                      )
                    }
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-slate-400">
                  {nextFixture.scheduledAt
                    ? new Date(
                        nextFixture.scheduledAt,
                      ).toLocaleString()
                    : 'Schedule pending'}
                </p>

                <Link
                  href={
                    nextFixture.match
                      ?.id
                      ? `/matches/${nextFixture.match.id}`
                      : `/tournaments/${nextFixture.tournamentId}/fixtures`
                  }
                  className="rounded-xl bg-sky-400 px-5 py-3 text-center text-sm font-black text-[#031019]"
                >
                  View Match
                </Link>
              </div>
            </FcPanel>
          ) : (
            <FcEmptyState
              title="No upcoming match"
              description="Your next scheduled fixture will appear here as soon as the tournament schedule is ready."
              actionLabel="Open Fixtures"
              actionHref="/fixtures"
            />
          )}


          <div className="grid gap-5">
            {primaryMembership ? (
              <FcPanel className="p-5">
                <FcSectionHeading
                  eyebrow="My League"
                  title={
                    primaryMembership
                      .league
                      .name
                  }
                  action={
                    <FcStatusBadge
                      label={
                        primaryMembership.membershipType
                      }
                      tone="cyan"
                    />
                  }
                />

                <div className="mt-5 flex items-center gap-4">
                  <FcCrest
                    name={
                      primaryMembership
                        .league
                        .name
                    }
                  />

                  <div className="min-w-0">
                    <p className="font-mono text-xs text-sky-400">
                      {
                        primaryMembership
                          .league
                          .code
                      }
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {primaryMembership
                        .league
                        .region ||
                        'FC ARENA League'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.025] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Members
                    </p>
                    <p className="mt-1 font-black">
                      {
                        primaryMembership
                          .league
                          .members
                      }
                      /
                      {
                        primaryMembership
                          .league
                          .maxMembers
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.025] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Role
                    </p>
                    <p className="mt-1 font-black text-sky-300">
                      {primaryMembership.adminRole ||
                        'PLAYER'}
                    </p>
                  </div>
                </div>

                <Link
                  href={
                    `/leagues/${primaryMembership.league.id}`
                  }
                  className="mt-4 inline-flex text-sm font-black text-sky-300"
                >
                  Open League →
                </Link>
              </FcPanel>
            ) : (
              <FcEmptyState
                title="No active league"
                description="Join a league with a code or create your own competition community."
                actionLabel="Open Leagues"
                actionHref="/leagues"
              />
            )}


            {activeTournament ? (
              <FcPanel className="p-5">
                <FcSectionHeading
                  eyebrow="Active Tournament"
                  title={
                    activeTournament.name
                  }
                  action={
                    <FcStatusBadge
                      label={
                        activeTournament.status
                      }
                      tone="emerald"
                    />
                  }
                />

                <p className="mt-2 text-xs text-slate-600">
                  {
                    activeTournament.competitionFormat
                      ?.replaceAll(
                        '_',
                        ' ',
                      ) ||
                    activeTournament.format.replaceAll(
                      '_',
                      ' ',
                    )
                  }
                </p>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-slate-500">
                      Entry Progress
                    </span>

                    <span>
                      {
                        activeTournament.approvedEntries
                      }
                      /
                      {
                        activeTournament.maxEntries
                      }
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                      style={{
                        width:
                          `${Math.min(
                            100,
                            activeTournament.maxEntries > 0
                              ? (
                                  activeTournament.approvedEntries /
                                  activeTournament.maxEntries
                                ) *
                                  100
                              : 0,
                          )}%`,
                      }}
                    />
                  </div>
                </div>

                <Link
                  href={
                    `/tournaments/${activeTournament.id}`
                  }
                  className="mt-4 inline-flex text-sm font-black text-sky-300"
                >
                  View Tournament →
                </Link>
              </FcPanel>
            ) : null}
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Shortcuts"
            title="Quick Actions"
          />

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link
              href="/leagues"
              className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
            >
              <span className="text-xl">＋</span>
              <p className="mt-3 font-black">
                Join League
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Use a league code
              </p>
            </Link>

            <Link
              href={
                primaryMembership
                  ? `/leagues/${primaryMembership.league.id}/tournaments`
                  : '/leagues'
              }
              className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
            >
              <span className="text-xl">🏆</span>
              <p className="mt-3 font-black">
                {isLeagueAdmin
                  ? 'Create Tournament'
                  : 'Tournaments'}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Competition center
              </p>
            </Link>

            <Link
              href="/fixtures"
              className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
            >
              <span className="text-xl">⚽</span>
              <p className="mt-3 font-black">
                Fixtures
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Match schedule
              </p>
            </Link>

            <Link
              href="/matches"
              className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
            >
              <span className="text-xl">✓</span>
              <p className="mt-3 font-black">
                Submit Result
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Open match center
              </p>
            </Link>
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Latest"
            title="Recent Activity"
            action={
              <Link
                href="/career"
                className="text-xs font-black text-sky-300"
              >
                Full Career →
              </Link>
            }
          />

          {career.matchHistory.length >
          0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {career.matchHistory
                .slice(
                  0,
                  3,
                )
                .map(
                  (
                    match,
                  ) => (
                    <FcPanel
                      key={
                        match.id
                      }
                      className="p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <FcStatusBadge
                          label={
                            match.outcome
                          }
                          tone={
                            match.outcome ===
                            'W'
                              ? 'emerald'
                              : match.outcome ===
                                  'D'
                                ? 'amber'
                                : 'red'
                          }
                        />

                        <span className="text-[10px] text-slate-600">
                          {new Date(
                            match.confirmedAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-4 text-sm font-black">
                        {
                          match.home.name
                        }{' '}
                        <span className="text-sky-300">
                          {
                            match.home.score
                          }
                          -
                          {
                            match.away.score
                          }
                        </span>{' '}
                        {
                          match.away.name
                        }
                      </p>

                      <p className="mt-2 text-xs text-slate-600">
                        {
                          match.tournament.name
                        }
                        {' · '}
                        {
                          match.tournament
                            .league
                            .name
                        }
                      </p>
                    </FcPanel>
                  ),
                )}
            </div>
          ) : (
            <FcEmptyState
              title="No recent results"
              description="Verified match results will build your recent activity and career form here."
              actionLabel="Open Match Center"
              actionHref="/matches"
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
