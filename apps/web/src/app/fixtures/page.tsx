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
  InlineResultPanel,
} from '@/components/fixtures/inline-result-panel';

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
  };
}


interface Tournament {
  id: string;
  name: string;
  status?: string;
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
  fixtureCode: string;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  status: string;
  scheduledAt: string | null;
  venue?: string | null;

  group?: {
    id: string;
    name: string;
  } | null;

  home: Entry | null;
  away: Entry | null;

  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;
}


interface FixtureItem
  extends Fixture {
  tournamentId: string;
  tournamentName: string;
  leagueId: string;
  leagueName: string;
}


type Filter =
  | 'ALL'
  | 'UPCOMING'
  | 'LIVE'
  | 'COMPLETED';


function entryName(
  entry: Entry | null,
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


function fixtureFilter(
  fixture: FixtureItem,
): Exclude<
  Filter,
  'ALL'
> {
  const status =
    fixture.match
      ?.status ||
    fixture.status;

  if (
    fixture.match?.status ===
      'COMPLETED' &&
    fixture.status ===
      'COMPLETED'
  ) {
    return 'COMPLETED';
  }

  if (
    status ===
      'LIVE' ||
    status ===
      'IN_PROGRESS' ||
    fixture.status ===
      'LIVE'
  ) {
    return 'LIVE';
  }

  return 'UPCOMING';
}


function dateGroup(
  value:
    string | null,
) {
  if (!value) {
    return 'Unscheduled';
  }

  const date =
    new Date(
      value,
    );

  const today =
    new Date();

  const startToday =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

  const startTarget =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

  const diff =
    Math.round(
      (
        startTarget.getTime() -
        startToday.getTime()
      ) /
        86_400_000,
    );

  if (
    diff ===
    0
  ) {
    return 'Today';
  }

  if (
    diff ===
    1
  ) {
    return 'Tomorrow';
  }

  if (
    diff >=
      2 &&
    diff <=
      7
  ) {
    return 'This Week';
  }

  if (
    diff >
    7
  ) {
    return 'Later';
  }

  return 'Earlier';
}


function fixtureStage(
  fixture:
    FixtureItem,
) {
  if (
    fixture.group
  ) {
    return 'GROUP_STAGE';
  }

  const name =
    fixture.roundName
      .toUpperCase();

  if (
    name.includes(
      'ROUND OF',
    ) ||
    name.includes(
      'QUARTER',
    ) ||
    name.includes(
      'SEMI',
    ) ||
    name.includes(
      'FINAL',
    )
  ) {
    return 'KNOCKOUT';
  }

  return 'LEAGUE';
}


function statusTone(
  fixture:
    FixtureItem,
) {
  const category =
    fixtureFilter(
      fixture,
    );

  if (
    category ===
    'COMPLETED'
  ) {
    return 'emerald' as const;
  }

  if (
    category ===
    'LIVE'
  ) {
    return 'red' as const;
  }

  if (
    fixture.status ===
    'POSTPONED'
  ) {
    return 'amber' as const;
  }

  return 'cyan' as const;
}


export default function FixturesPage() {
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
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    selectedLeagueId,
    setSelectedLeagueId,
  ] =
    useState('');

  const [
    tournaments,
    setTournaments,
  ] =
    useState<Tournament[]>(
      [],
    );

  const [
    selectedTournamentId,
    setSelectedTournamentId,
  ] =
    useState(
      'ALL',
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<FixtureItem[]>(
      [],
    );

  const [
    filter,
    setFilter,
  ] =
    useState<Filter>(
      'ALL',
    );


  const [
    selectedGroupId,
    setSelectedGroupId,
  ] =
    useState(
      'ALL',
    );

  const [
    selectedMatchday,
    setSelectedMatchday,
  ] =
    useState(
      'ALL',
    );

  const [
    selectedStage,
    setSelectedStage,
  ] =
    useState(
      'ALL',
    );

  const [
    selectedTeam,
    setSelectedTeam,
  ] =
    useState(
      'ALL',
    );

  const [
    expandedResultMatchId,
    setExpandedResultMatchId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          leagues,
        ] =
          await Promise.all([
            getCurrentUser(),

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
          current,
        );

        const items =
          leagues.data.leagues;

        setMemberships(
          items,
        );

        const initial =
          items.find(
            (
              item,
            ) =>
              item.membershipType ===
              'PRIMARY',
          ) ??
          items[0];

        if (
          initial
        ) {
          setSelectedLeagueId(
            initial.league.id,
          );
        }
      } catch {
        router.replace(
          '/login',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void load();
  }, [
    router,
  ]);


  useEffect(() => {
    async function loadLeagueFixtures() {
      if (
        !selectedLeagueId
      ) {
        setTournaments(
          [],
        );

        setFixtures(
          [],
        );

        return;
      }

      setLoading(
        true,
      );

      setError('');

      try {
        const tournamentResponse =
          await authenticatedRequest<{
            data: {
              tournaments:
                Tournament[];
            };
          }>(
            `/leagues/${selectedLeagueId}/tournaments`,
          );

        const currentMembership =
          memberships.find(
            (
              item,
            ) =>
              item.league.id ===
              selectedLeagueId,
          );

        const competitionList =
          tournamentResponse
            .data
            .tournaments;

        setTournaments(
          competitionList,
        );

        setSelectedTournamentId(
          'ALL',
        );

        setSelectedGroupId(
          'ALL',
        );

        setSelectedMatchday(
          'ALL',
        );

        setSelectedStage(
          'ALL',
        );

        setSelectedTeam(
          'ALL',
        );

        setExpandedResultMatchId(
          null,
        );

        const groups =
          await Promise.all(
            competitionList.map(
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

                        leagueId:
                          selectedLeagueId,

                        leagueName:
                          currentMembership
                            ?.league
                            .name ||
                          'League',
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
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load fixtures.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void loadLeagueFixtures();
  }, [
    memberships,
    selectedLeagueId,
  ]);


  const selectedMembership =
    useMemo(
      () =>
        memberships.find(
          (
            item,
          ) =>
            item.league.id ===
            selectedLeagueId,
        ) ??
        null,
      [
        memberships,
        selectedLeagueId,
      ],
    );


  const visibleFixtures =
    useMemo(
      () => {
        let values =
          fixtures;

        if (
          selectedTournamentId !==
          'ALL'
        ) {
          values =
            values.filter(
              (
                fixture,
              ) =>
                fixture.tournamentId ===
                selectedTournamentId,
            );
        }

        if (
          filter !==
          'ALL'
        ) {
          values =
            values.filter(
              (
                fixture,
              ) =>
                fixtureFilter(
                  fixture,
                ) ===
                filter,
            );
        }

        if (
          selectedGroupId !==
          'ALL'
        ) {
          values =
            values.filter(
              (
                fixture,
              ) =>
                fixture.group
                  ?.id ===
                selectedGroupId,
            );
        }

        if (
          selectedMatchday !==
          'ALL'
        ) {
          values =
            values.filter(
              (
                fixture,
              ) =>
                String(
                  fixture.matchday ??
                  fixture.roundNumber,
                ) ===
                selectedMatchday,
            );
        }

        if (
          selectedStage !==
          'ALL'
        ) {
          values =
            values.filter(
              (
                fixture,
              ) =>
                fixtureStage(
                  fixture,
                ) ===
                selectedStage,
            );
        }

        if (
          selectedTeam !==
          'ALL'
        ) {
          const normalizedTeam =
            selectedTeam
              .trim()
              .toLocaleLowerCase();

          values =
            values.filter(
              (
                fixture,
              ) => {
                const home =
                  entryName(
                    fixture.home,
                  )
                    .trim()
                    .toLocaleLowerCase();

                const away =
                  entryName(
                    fixture.away,
                  )
                    .trim()
                    .toLocaleLowerCase();

                return (
                  home ===
                    normalizedTeam ||
                  away ===
                    normalizedTeam
                );
              },
            );
        }

        return [
          ...values,
        ].sort(
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
        );
      },
      [
        fixtures,
        selectedTournamentId,
        filter,
        selectedGroupId,
        selectedMatchday,
        selectedStage,
        selectedTeam,
      ],
    );


  const availableGroups =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const fixture
          of fixtures
        ) {
          if (
            selectedTournamentId !==
              'ALL' &&
            fixture.tournamentId !==
              selectedTournamentId
          ) {
            continue;
          }

          if (
            fixture.group
          ) {
            map.set(
              fixture.group.id,
              fixture.group.name,
            );
          }
        }

        return Array.from(
          map.entries(),
        );
      },
      [
        fixtures,
        selectedTournamentId,
      ],
    );


  const availableMatchdays =
    useMemo(
      () =>
        Array.from(
          new Set(
            fixtures
              .filter(
                (
                  fixture,
                ) =>
                  selectedTournamentId ===
                    'ALL' ||
                  fixture.tournamentId ===
                    selectedTournamentId,
              )
              .map(
                (
                  fixture,
                ) =>
                  fixture.matchday ??
                  fixture.roundNumber,
              )
              .filter(
                (
                  value,
                ): value is number =>
                  typeof value ===
                  'number',
              ),
          ),
        ).sort(
          (
            a,
            b,
          ) =>
            a -
            b,
        ),
      [
        fixtures,
        selectedTournamentId,
      ],
    );


  const availableTeams =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const fixture
          of fixtures
        ) {
          if (
            selectedTournamentId !==
              'ALL' &&
            fixture.tournamentId !==
              selectedTournamentId
          ) {
            continue;
          }

          for (
            const entry
            of [
              fixture.home,
              fixture.away,
            ]
          ) {
            if (
              !entry
            ) {
              continue;
            }

            const name =
              entryName(
                entry,
              ).trim();

            if (
              !name ||
              name ===
                'TBD'
            ) {
              continue;
            }

            map.set(
              name.toLocaleLowerCase(),
              name,
            );
          }
        }

        return Array.from(
          map.values(),
        ).sort(
          (
            first,
            second,
          ) =>
            first.localeCompare(
              second,
            ),
        );
      },
      [
        fixtures,
        selectedTournamentId,
      ],
    );


  async function refreshTournamentFixtures(
    tournamentId: string,
    tournamentName: string,
  ) {
    const response =
      await authenticatedRequest<{
        data: {
          fixtures:
            Fixture[];
        };
      }>(
        `/tournaments/${tournamentId}/fixtures`,
      );

    setFixtures(
      (
        current,
      ) => [
        ...current.filter(
          (
            fixture,
          ) =>
            fixture.tournamentId !==
            tournamentId,
        ),

        ...response.data.fixtures.map(
          (
            fixture,
          ) => ({
            ...fixture,

            tournamentId,
            tournamentName,

            leagueId:
              selectedLeagueId,

            leagueName:
              selectedMembership
                ?.league
                .name ||
              'League',
          }),
        ),
      ],
    );
  }


  useEffect(() => {
    if (
      !selectedLeagueId ||
      tournaments.length ===
        0
    ) {
      return;
    }

    let cancelled =
      false;

    async function syncOpponentFixtureUpdates() {
      if (
        document.visibilityState ===
        'hidden'
      ) {
        return;
      }

      const currentMembership =
        memberships.find(
          (
            item,
          ) =>
            item.league.id ===
            selectedLeagueId,
        );

      const refreshed =
        await Promise.all(
          tournaments.map(
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

                return {
                  tournamentId:
                    tournament.id,

                  fixtures:
                    response.data.fixtures.map(
                      (
                        fixture,
                      ) => ({
                        ...fixture,

                        tournamentId:
                          tournament.id,

                        tournamentName:
                          tournament.name,

                        leagueId:
                          selectedLeagueId,

                        leagueName:
                          currentMembership
                            ?.league
                            .name ||
                          'League',
                      }),
                    ),
                };
              } catch {
                return null;
              }
            },
          ),
        );

      if (
        cancelled
      ) {
        return;
      }

      setFixtures(
        (
          current,
        ) => {
          let next = [
            ...current,
          ];

          for (
            const result
            of refreshed
          ) {
            if (!result) {
              continue;
            }

            next = [
              ...next.filter(
                (
                  fixture,
                ) =>
                  fixture.tournamentId !==
                  result.tournamentId,
              ),
              ...result.fixtures,
            ];
          }

          return next;
        },
      );
    }

    const interval =
      window.setInterval(
        () => {
          void syncOpponentFixtureUpdates();
        },
        15_000,
      );

    const onFocus =
      () => {
        void syncOpponentFixtureUpdates();
      };

    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void syncOpponentFixtureUpdates();
        }
      };

    window.addEventListener(
      'focus',
      onFocus,
    );

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        interval,
      );

      window.removeEventListener(
        'focus',
        onFocus,
      );

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
    };
  }, [
    memberships,
    selectedLeagueId,
    tournaments,
  ]);


  const grouped =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            FixtureItem[]
          >();

        for (
          const fixture
          of visibleFixtures
        ) {
          const key =
            dateGroup(
              fixture.scheduledAt,
            );

          const list =
            groups.get(
              key,
            ) ??
            [];

          list.push(
            fixture,
          );

          groups.set(
            key,
            list,
          );
        }

        const order = [
          'Today',
          'Tomorrow',
          'This Week',
          'Later',
          'Unscheduled',
          'Earlier',
        ];

        return order
          .filter(
            (
              key,
            ) =>
              groups.has(
                key,
              ),
          )
          .map(
            (
              key,
            ) => [
              key,
              groups.get(
                key,
              ) ?? [],
            ] as const,
          );
      },
      [
        visibleFixtures,
      ],
    );


  const upcomingCount =
    fixtures.filter(
      (
        fixture,
      ) =>
        fixtureFilter(
          fixture,
        ) ===
        'UPCOMING',
    ).length;

  const liveCount =
    fixtures.filter(
      (
        fixture,
      ) =>
        fixtureFilter(
          fixture,
        ) ===
        'LIVE',
    ).length;

  const completedCount =
    fixtures.filter(
      (
        fixture,
      ) =>
        fixtureFilter(
          fixture,
        ) ===
        'COMPLETED',
    ).length;

  const todayCount =
    fixtures.filter(
      (
        fixture,
      ) =>
        dateGroup(
          fixture.scheduledAt,
        ) ===
        'Today',
    ).length;


  if (
    !user ||
    (
      loading &&
      memberships.length ===
        0
    )
  ) {
    return (
      <FcLoadingScreen
        label="Loading Fixtures..."
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
        <FcPageHeader
          title="Fixtures"
          subtitle="Every match in one place, with simple filters for League, Tournament and status."
          action={
            selectedMembership
              ?.adminRole ? (
              <div className="flex gap-2">
                <Link
                  href="/fixtures/manage"
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                >
                  Manage
                </Link>

                <Link
                  href="/fixtures/generate"
                  className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                >
                  + Create Fixtures
                </Link>
              </div>
            ) : null
          }
        />


        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        {memberships.length ===
        0 ? (
          <FcEmptyState
            title="No League fixtures yet"
            description="Join or create a League first. Tournament fixtures from that League will automatically appear here."
            actionLabel="Open Leagues"
            actionHref="/leagues"
          />
        ) : (
          <>
            <FcPanel className="p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    League
                  </span>

                  <select
                    value={
                      selectedLeagueId
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setSelectedLeagueId(
                          event.target.value,
                        )
                    }
                    className="rounded-xl border border-white/10 bg-[#07101a] px-4 py-3 text-sm font-black outline-none"
                  >
                    {memberships.map(
                      (
                        membership,
                      ) => (
                        <option
                          key={
                            membership.league.id
                          }
                          value={
                            membership.league.id
                          }
                        >
                          {
                            membership.league.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>


                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    Tournament
                  </span>

                  <select
                    value={
                      selectedTournamentId
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setSelectedTournamentId(
                          event.target.value,
                        );

                        setSelectedGroupId(
                          'ALL',
                        );

                        setSelectedMatchday(
                          'ALL',
                        );

                        setSelectedStage(
                          'ALL',
                        );

                        setSelectedTeam(
                          'ALL',
                        );

                        setExpandedResultMatchId(
                          null,
                        );
                      }
                    }
                    className="rounded-xl border border-white/10 bg-[#07101a] px-4 py-3 text-sm font-black outline-none"
                  >
                    <option value="ALL">
                      All Tournaments
                    </option>

                    {tournaments.map(
                      (
                        tournament,
                      ) => (
                        <option
                          key={
                            tournament.id
                          }
                          value={
                            tournament.id
                          }
                        >
                          {
                            tournament.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </FcPanel>


            <FcPanel className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    Group
                  </span>

                  <select
                    value={
                      selectedGroupId
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setSelectedGroupId(
                          event.target.value,
                        )
                    }
                    className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-sm"
                  >
                    <option value="ALL">
                      All Groups
                    </option>

                    {availableGroups.map(
                      ([
                        id,
                        name,
                      ]) => (
                        <option
                          key={
                            id
                          }
                          value={
                            id
                          }
                        >
                          {
                            name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>


                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    Matchday
                  </span>

                  <select
                    value={
                      selectedMatchday
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setSelectedMatchday(
                          event.target.value,
                        )
                    }
                    className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-sm"
                  >
                    <option value="ALL">
                      All Matchdays
                    </option>

                    {availableMatchdays.map(
                      (
                        matchday,
                      ) => (
                        <option
                          key={
                            matchday
                          }
                          value={
                            matchday
                          }
                        >
                          Matchday {
                            matchday
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>


                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    Stage
                  </span>

                  <select
                    value={
                      selectedStage
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setSelectedStage(
                          event.target.value,
                        )
                    }
                    className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-sm"
                  >
                    <option value="ALL">
                      All Stages
                    </option>

                    <option value="LEAGUE">
                      League / Round Robin
                    </option>

                    <option value="GROUP_STAGE">
                      Group Stage
                    </option>

                    <option value="KNOCKOUT">
                      Knockout
                    </option>
                  </select>
                </label>


                <label className="grid gap-2">
                  <span className="text-xs font-medium text-[#A7B0BE]">
                    Team
                  </span>

                  <select
                    value={
                      selectedTeam
                    }
                    onChange={
                      (
                        event,
                      ) => {
                        setSelectedTeam(
                          event.target.value,
                        );

                        setExpandedResultMatchId(
                          null,
                        );
                      }
                    }
                    className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-3 text-sm"
                  >
                    <option value="ALL">
                      All Teams
                    </option>

                    {availableTeams.map(
                      (
                        team,
                      ) => (
                        <option
                          key={
                            team
                          }
                          value={
                            team
                          }
                        >
                          {
                            team
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </FcPanel>


            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <FcStatCard
                label="Upcoming"
                value={
                  upcomingCount
                }
                detail="Open schedule"
              />

              <FcStatCard
                label="Today"
                value={
                  todayCount
                }
                detail="Scheduled today"
                tone="amber"
              />

              <FcStatCard
                label="Live"
                value={
                  liveCount
                }
                detail="In progress"
                tone={
                  liveCount >
                  0
                    ? 'red'
                    : 'slate'
                }
              />

              <FcStatCard
                label="Completed"
                value={
                  completedCount
                }
                detail="Finished matches"
                tone="emerald"
              />
            </section>


            <FcPanel className="p-3">
              <div className="grid grid-cols-4 gap-2">
                {([
                  'ALL',
                  'UPCOMING',
                  'LIVE',
                  'COMPLETED',
                ] as Filter[]).map(
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
                      className={`rounded-xl border px-2 py-3 text-[10px] font-black transition sm:text-xs ${
                        filter ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.09] text-sky-300'
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


            <section>
              <FcSectionHeading
                eyebrow={
                  selectedMembership
                    ?.league
                    .name
                }
                title="Match Schedule"
                action={
                  <span className="text-xs font-black text-slate-600">
                    {
                      visibleFixtures.length
                    }{' '}
                    matches
                  </span>
                }
              />

              {loading ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {[0, 1, 2, 3].map(
                    (
                      value,
                    ) => (
                      <div
                        key={
                          value
                        }
                        className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025]"
                      />
                    ),
                  )}
                </div>
              ) : visibleFixtures.length ===
                0 ? (
                <div className="mt-4">
                  <FcEmptyState
                    title="No matching fixtures"
                    description="Try another status, League or Tournament. Admins can generate fixtures through the Tournament workflow."
                    actionLabel="Open Tournaments"
                    actionHref="/tournaments"
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-7">
                  {grouped.map(
                    ([
                      label,
                      items,
                    ]) => (
                      <section
                        key={
                          label
                        }
                      >
                        <div className="flex items-center gap-3">
                          <h3 className="font-['Rajdhani','Space_Grotesk',sans-serif] text-xl font-black uppercase tracking-[0.03em]">
                            {
                              label
                            }
                          </h3>

                          <span className="h-px flex-1 bg-white/[0.07]" />

                          <span className="text-[10px] font-black text-slate-600">
                            {
                              items.length
                            }
                          </span>
                        </div>


                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          {items.map(
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

                              const href =
                                fixture.match
                                  ?.id
                                  ? `/matches/${fixture.match.id}`
                                  : `/tournaments/${fixture.tournamentId}/fixtures`;

                              const completed =
                                fixtureFilter(
                                  fixture,
                                ) ===
                                'COMPLETED';

                              return (
                                <article
                                  key={
                                    fixture.id
                                  }
                                  className="group rounded-2xl border border-[#253140] bg-[#121821] p-4 transition duration-200 hover:border-[#334155] hover:bg-[#151C26] sm:p-5"
                                >
                                  <Link
                                    href={
                                      href
                                    }
                                    className="block"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-medium text-[#38BDF8]">
                                          {
                                            fixture.tournamentName
                                          }
                                        </p>

                                        <p className="mt-1 text-xs text-slate-600">
                                          {
                                            fixture.roundName
                                          }
                                          {fixture.group
                                            ? ` · ${fixture.group.name}`
                                            : ''}
                                        </p>
                                      </div>

                                      <FcStatusBadge
                                        label={
                                          fixture.match
                                            ?.status ||
                                          fixture.status
                                        }
                                        tone={
                                          statusTone(
                                            fixture,
                                          )
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

                                      <span className="rounded-lg border border-sky-400/15 bg-sky-400/[0.05] px-3 py-2 text-[10px] font-black text-sky-300">
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
                                  </Link>


                                  <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-end sm:justify-between">
                                    <div>
                                      <p className="text-xs font-black text-slate-300">
                                        {fixture.scheduledAt
                                          ? new Date(
                                              fixture.scheduledAt,
                                            ).toLocaleString()
                                          : 'Schedule pending'}
                                      </p>

                                      <p className="mt-1 text-[10px] text-slate-600">
                                        {fixture.venue ||
                                          fixture.fixtureCode}
                                      </p>
                                    </div>


                                    <div className="flex flex-wrap gap-2">
                                      <Link
                                        href={
                                          href
                                        }
                                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[#284154] bg-[#14212D] px-3.5 text-xs font-semibold text-[#F8FAFC] transition hover:border-[#38BDF8]/35"
                                      >
                                        View Match
                                      </Link>

                                      {fixture.match
                                        ?.id ? (
                                        <button
                                          type="button"
                                          onClick={
                                            () =>
                                              setExpandedResultMatchId(
                                                (
                                                  current,
                                                ) =>
                                                  current ===
                                                  fixture.match
                                                    ?.id
                                                    ? null
                                                    : fixture.match
                                                        ?.id ??
                                                      null,
                                              )
                                          }
                                          className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-3.5 text-xs font-semibold transition ${
                                            completed
                                              ? 'border border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300 hover:bg-emerald-400/[0.10]'
                                              : 'bg-[#38BDF8] text-[#071018] hover:bg-[#0EA5E9]'
                                          }`}
                                        >
                                          {expandedResultMatchId ===
                                          fixture.match
                                            .id
                                            ? 'Close Result'
                                            : completed
                                              ? 'View Result'
                                              : 'Update Result'}
                                        </button>
                                      ) : (
                                        <span className="inline-flex min-h-10 items-center rounded-[10px] border border-white/[0.06] px-3.5 text-xs font-medium text-[#536273]">
                                          Match not ready
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {fixture.match
                                    ?.id &&
                                  expandedResultMatchId ===
                                    fixture.match
                                      .id ? (
                                    <InlineResultPanel
                                      matchId={
                                        fixture.match
                                          .id
                                      }
                                      homeName={
                                        home
                                      }
                                      awayName={
                                        away
                                      }
                                      completed={
                                        completed
                                      }
                                      matchHref={
                                        href
                                      }
                                      onSaved={
                                        () =>
                                          refreshTournamentFixtures(
                                            fixture.tournamentId,
                                            fixture.tournamentName,
                                          )
                                      }
                                    />
                                  ) : null}
                                </article>
                              );
                            },
                          )}
                        </div>
                      </section>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
