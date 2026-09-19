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
  competitionLabel,
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
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
    code: string;
  };
}


interface Tournament {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  logoUrl?: string | null;
  mode: string;
  format: string;
  competitionFormat?: string;
  groupMode?: string;
  status: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  endAt?: string | null;
  fixturesGeneratedAt?: string | null;
}


type Filter =
  | 'ACTIVE'
  | 'UPCOMING'
  | 'COMPLETED';


function tournamentFilter(
  tournament: Tournament,
): Filter {
  if (
    [
      'COMPLETED',
      'CANCELLED',
    ].includes(
      tournament.status,
    )
  ) {
    return 'COMPLETED';
  }

  if (
    tournament.status ===
      'DRAFT' ||
    (
      tournament.startAt &&
      new Date(
        tournament.startAt,
      ).getTime() >
        Date.now() &&
      ![
        'ACTIVE',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
      ].includes(
        tournament.status,
      )
    )
  ) {
    return 'UPCOMING';
  }

  return 'ACTIVE';
}


function toneForStatus(
  status: string,
) {
  if (
    status ===
      'COMPLETED'
  ) {
    return 'emerald' as const;
  }

  if (
    status ===
      'CANCELLED'
  ) {
    return 'red' as const;
  }

  if (
    status.includes(
      'REGISTRATION',
    )
  ) {
    return 'cyan' as const;
  }

  if (
    status ===
      'DRAFT'
  ) {
    return 'amber' as const;
  }

  return 'emerald' as const;
}


export default function TournamentsPage() {
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
    filter,
    setFilter,
  ] =
    useState<Filter>(
      'ACTIVE',
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
          currentUser,
          leagueResponse,
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
          currentUser,
        );

        const leagues =
          leagueResponse
            .data
            .leagues;

        setMemberships(
          leagues,
        );

        const initial =
          leagues.find(
            (
              item,
            ) =>
              item.membershipType ===
              'PRIMARY',
          ) ??
          leagues[0];

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
    async function loadTournaments() {
      if (
        !selectedLeagueId
      ) {
        setTournaments(
          [],
        );

        return;
      }

      setLoading(
        true,
      );

      setError('');

      try {
        const response =
          await authenticatedRequest<{
            data: {
              tournaments:
                Tournament[];
            };
          }>(
            `/leagues/${selectedLeagueId}/tournaments`,
          );

        setTournaments(
          response
            .data
            .tournaments,
        );
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tournaments.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void loadTournaments();
  }, [
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


  const filtered =
    useMemo(
      () =>
        tournaments.filter(
          (
            tournament,
          ) =>
            tournamentFilter(
              tournament,
            ) ===
            filter,
        ),
      [
        tournaments,
        filter,
      ],
    );


  const counts =
    useMemo(
      () => ({
        ACTIVE:
          tournaments.filter(
            (
              tournament,
            ) =>
              tournamentFilter(
                tournament,
              ) ===
              'ACTIVE',
          ).length,

        UPCOMING:
          tournaments.filter(
            (
              tournament,
            ) =>
              tournamentFilter(
                tournament,
              ) ===
              'UPCOMING',
          ).length,

        COMPLETED:
          tournaments.filter(
            (
              tournament,
            ) =>
              tournamentFilter(
                tournament,
              ) ===
              'COMPLETED',
          ).length,
      }),
      [
        tournaments,
      ],
    );


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
        label="Loading Tournaments..."
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
      <div className="space-y-7">
        <FcPageHeader
          eyebrow="Competition Hub"
          title="Tournaments"
          subtitle="Create, follow and manage competitions inside your currently selected FC ARENA League."
          action={
            selectedMembership
              ?.adminRole ? (
              <Link
                href={
                  `/leagues/${selectedMembership.league.id}/tournaments`
                }
                className="inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] transition hover:bg-sky-300"
              >
                + Create Tournament
              </Link>
            ) : null
          }
        />


        {memberships.length >
        0 ? (
          <FcPanel className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Current League
                </p>

                <p className="mt-1 text-sm font-black text-slate-300">
                  Tournament data is scoped to this league.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {memberships.map(
                  (
                    membership,
                  ) => (
                    <button
                      key={
                        membership.league.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedLeagueId(
                          membership.league.id,
                        )
                      }
                      className={`rounded-xl border px-4 py-2.5 text-left text-sm font-black transition ${
                        selectedLeagueId ===
                        membership.league.id
                          ? 'border-sky-400/30 bg-sky-400/[0.08] text-sky-300'
                          : 'border-white/10 bg-white/[0.025] text-slate-500 hover:text-white'
                      }`}
                    >
                      {
                        membership.league.name
                      }
                      <span className="ml-2 text-[9px] text-slate-600">
                        {
                          membership.membershipType
                        }
                      </span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </FcPanel>
        ) : null}


        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        {!selectedMembership ? (
          <FcEmptyState
            title="Join a League first"
            description="Tournaments belong to a League. Join with a code or create a League to unlock the competition hub."
            actionLabel="Open Leagues"
            actionHref="/leagues"
          />
        ) : (
          <>
            <FcPanel className="overflow-hidden">
              <div className="flex flex-col gap-5 border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_60%)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-center gap-4">
                  <FcCrest
                    name={
                      selectedMembership
                        .league
                        .name
                    }
                    size="lg"
                  />

                  <div>
                    <p className="font-mono text-[10px] font-black tracking-wider text-sky-400">
                      {
                        selectedMembership
                          .league
                          .code
                      }
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {
                        selectedMembership
                          .league
                          .name
                      }
                    </h2>

                    <p className="mt-1 text-xs text-slate-600">
                      {
                        selectedMembership.adminRole
                          ? `${selectedMembership.adminRole} access`
                          : 'Player access'
                      }
                    </p>
                  </div>
                </div>

                <Link
                  href={
                    `/leagues/${selectedMembership.league.id}`
                  }
                  className="text-sm font-black text-sky-300"
                >
                  League Overview →
                </Link>
              </div>


              <div className="grid grid-cols-3 gap-2 p-3 sm:p-4">
                {([
                  'ACTIVE',
                  'UPCOMING',
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
                      className={`rounded-xl border px-3 py-3 text-xs font-black transition sm:text-sm ${
                        filter ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.09] text-sky-300'
                          : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-white'
                      }`}
                    >
                      {
                        value.charAt(
                          0,
                        ) +
                        value
                          .slice(
                            1,
                          )
                          .toLowerCase()
                      }
                      <span className="ml-1.5 text-[10px] text-slate-600">
                        {
                          counts[
                            value
                          ]
                        }
                      </span>
                    </button>
                  ),
                )}
              </div>
            </FcPanel>


            <section>
              <FcSectionHeading
                eyebrow={
                  selectedMembership
                    .league
                    .name
                }
                title={
                  `${filter.charAt(0)}${filter
                    .slice(1)
                    .toLowerCase()} Tournaments`
                }
              />

              {loading ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {[0, 1].map(
                    (
                      item,
                    ) => (
                      <div
                        key={
                          item
                        }
                        className="h-64 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.025]"
                      />
                    ),
                  )}
                </div>
              ) : filtered.length ===
                0 ? (
                <div className="mt-4">
                  <FcEmptyState
                    title={
                      `No ${filter.toLowerCase()} tournaments`
                    }
                    description={
                      selectedMembership.adminRole
                        ? 'Create a competition for this League or switch to another tournament status.'
                        : 'Nothing is available in this status yet.'
                    }
                    actionLabel={
                      selectedMembership.adminRole
                        ? 'Manage Tournaments'
                        : 'Open League'
                    }
                    actionHref={
                      selectedMembership.adminRole
                        ? `/leagues/${selectedMembership.league.id}/tournaments`
                        : `/leagues/${selectedMembership.league.id}`
                    }
                  />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {filtered.map(
                    (
                      tournament,
                    ) => {
                      const format =
                        tournament.competitionFormat ||
                        tournament.format;

                      const progress =
                        tournament.maxEntries >
                        0
                          ? Math.min(
                              100,
                              (
                                tournament.approvedEntries /
                                tournament.maxEntries
                              ) *
                                100,
                            )
                          : 0;

                      return (
                        <Link
                          key={
                            tournament.id
                          }
                          href={
                            `/tournaments/${tournament.id}`
                          }
                          className="group overflow-hidden rounded-[26px] border border-white/10 bg-[#08111b] transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/30"
                        >
                          <div className="relative min-h-28 border-b border-white/[0.07] bg-[radial-gradient(circle_at_85%_20%,rgba(14,165,233,0.18),transparent_28%),linear-gradient(120deg,rgba(14,165,233,0.06),transparent_60%)] p-5">
                            <div className="flex items-start justify-between gap-4">
                              <FcCrest
                                name={
                                  tournament.name
                                }
                                imageUrl={
                                  tournament.logoUrl
                                }
                                size="lg"
                              />

                              <FcStatusBadge
                                label={
                                  tournament.status
                                }
                                tone={
                                  toneForStatus(
                                    tournament.status,
                                  )
                                }
                              />
                            </div>

                            <h3 className="mt-4 font-['Rajdhani','Space_Grotesk',sans-serif] text-2xl font-black uppercase tracking-[-0.02em]">
                              {
                                tournament.name
                              }
                            </h3>

                            <p className="mt-1 font-mono text-[10px] text-slate-600">
                              {
                                tournament.code
                              }
                            </p>
                          </div>


                          <div className="p-5">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                                  Format
                                </p>
                                <p className="mt-1 truncate text-xs font-black">
                                  {
                                    competitionLabel(
                                      format,
                                    )
                                  }
                                </p>
                              </div>

                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                                  Teams
                                </p>
                                <p className="mt-1 text-xs font-black">
                                  {
                                    tournament.approvedEntries
                                  }
                                  /
                                  {
                                    tournament.maxEntries
                                  }
                                </p>
                              </div>

                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                                  Stage
                                </p>
                                <p className="mt-1 truncate text-xs font-black text-sky-300">
                                  {
                                    competitionLabel(
                                      tournament.status,
                                    )
                                  }
                                </p>
                              </div>
                            </div>


                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-600">
                                <span>
                                  Registration
                                </span>
                                <span>
                                  {
                                    Math.round(
                                      progress,
                                    )
                                  }
                                  %
                                </span>
                              </div>

                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                                  style={{
                                    width:
                                      `${progress}%`,
                                  }}
                                />
                              </div>
                            </div>


                            <div className="mt-5 flex items-center justify-between gap-4">
                              <p className="text-xs text-slate-600">
                                {tournament.startAt
                                  ? new Date(
                                      tournament.startAt,
                                    ).toLocaleDateString()
                                  : 'Start date TBD'}
                              </p>

                              <span className="text-sm font-black text-sky-300 transition group-hover:translate-x-0.5">
                                View Details →
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    },
                  )}
                </div>
              )}
            </section>


            <FcPanel className="p-5 sm:p-6">
              <FcSectionHeading
                eyebrow="Formats"
                title="Supported Competition Structures"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    'League / Round Robin',
                    'Every team meets every opponent.',
                  ],
                  [
                    'Double Round Robin',
                    'Home and away reverse legs.',
                  ],
                  [
                    'Knockout',
                    'Single-elimination bracket progression.',
                  ],
                  [
                    'Group + Knockout',
                    'Groups, qualification and playoff bracket.',
                  ],
                ].map(
                  ([
                    title,
                    description,
                  ]) => (
                    <div
                      key={
                        title
                      }
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                    >
                      <p className="font-black">
                        {
                          title
                        }
                      </p>

                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        {
                          description
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          </>
        )}
      </div>
    </AppShell>
  );
}
