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

type CompetitionFormat =
  | 'LEAGUE_ROUND_ROBIN'
  | 'DOUBLE_ROUND_ROBIN'
  | 'SINGLE_ELIMINATION'
  | 'GROUP_STAGE_KNOCKOUT';


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
    formatFilter,
    setFormatFilter,
  ] =
    useState<
      CompetitionFormat | null
    >(
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


  const [
    deletingTournamentId,
    setDeletingTournamentId,
  ] =
    useState<string | null>(
      null,
    );


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
          ) => {
            if (
              tournamentFilter(
                tournament,
              ) !==
              filter
            ) {
              return false;
            }

            if (
              !formatFilter
            ) {
              return true;
            }

            const format =
              tournament.competitionFormat ||
              tournament.format;

            return (
              format ===
              formatFilter
            );
          },
        ),
      [
        tournaments,
        filter,
        formatFilter,
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


  async function deleteTournament(
    tournament:
      Tournament,
  ) {
    if (
      !selectedMembership
        ?.adminRole
    ) {
      return;
    }

    const confirmation =
      window.prompt(
        `Delete "${tournament.name}" permanently? This removes its teams, groups, fixtures, matches, standings and stats. Type the Tournament name exactly to continue.`,
      );

    if (
      confirmation ===
      null
    ) {
      return;
    }

    if (
      confirmation.trim() !==
      tournament.name.trim()
    ) {
      setError(
        'Tournament name confirmation does not match.',
      );

      return;
    }

    setDeletingTournamentId(
      tournament.id,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournament.id}`,
        {
          method:
            'DELETE',

          body:
            JSON.stringify({
              confirmName:
                confirmation,
            }),
        },
      );

      setTournaments(
        (
          current,
        ) =>
          current.filter(
            (
              item,
            ) =>
              item.id !==
              tournament.id,
          ),
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete Tournament.',
      );
    } finally {
      setDeletingTournamentId(
        null,
      );
    }
  }


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
      <div className="space-y-6">
        <FcPageHeader
          title="Tournaments"
          subtitle="Create, follow and manage competitions in your selected League."
          action={
            selectedMembership
              ?.adminRole ? (
              <Link
                href={
                  `/leagues/${selectedMembership.league.id}/tournaments`
                }
                className="inline-flex min-h-11 items-center rounded-[10px] bg-[#38BDF8] px-4 text-sm font-semibold text-[#071018] transition hover:bg-[#0EA5E9]"
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
              <div className="flex flex-col gap-5 border-b border-[#253140] bg-[#151C26] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
                  formatFilter
                    ? `${competitionLabel(formatFilter)} · ${filter.charAt(0)}${filter
                        .slice(1)
                        .toLowerCase()}`
                    : `${filter.charAt(0)}${filter
                        .slice(1)
                        .toLowerCase()} Tournaments`
                }
                action={
                  formatFilter ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFormatFilter(
                          null,
                        )
                      }
                      className="rounded-[10px] border border-[#203141] bg-[#101923] px-3 py-2 text-xs font-semibold text-[#A7B0BE] transition hover:border-[#2D4356] hover:text-[#F8FAFC]"
                    >
                      Clear Format
                    </button>
                  ) : null
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
                        <article
                          key={
                            tournament.id
                          }
                          className="group overflow-hidden rounded-2xl border border-[#253140] bg-[#121821] transition duration-200 hover:border-[#334155] hover:bg-[#151C26]"
                        >
                          <Link
                            href={
                              `/tournaments/${tournament.id}`
                            }
                            className="block"
                          >
                            <div className="relative min-h-28 border-b border-[#253140] bg-[#151C26] p-5">
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

                              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#F8FAFC]">
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


                            <div className="p-5 pb-3">
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
                            </div>
                          </Link>


                          <div className="flex flex-col gap-2 border-t border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-600">
                              {tournament.startAt
                                ? new Date(
                                    tournament.startAt,
                                  ).toLocaleDateString()
                                : 'Start date TBD'}
                            </p>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={
                                  `/tournaments/${tournament.id}`
                                }
                                className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[#203141] px-4 text-sm font-semibold text-[#A7B0BE] transition hover:bg-[#151C26]"
                              >
                                View Details
                              </Link>

                              {selectedMembership
                                ?.adminRole ? (
                                <button
                                  type="button"
                                  disabled={
                                    deletingTournamentId ===
                                    tournament.id
                                  }
                                  onClick={() =>
                                    void deleteTournament(
                                      tournament,
                                    )
                                  }
                                  className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/30 bg-red-400/[0.04] px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                                >
                                  {deletingTournamentId ===
                                  tournament.id
                                    ? 'Deleting...'
                                    : 'Delete Tournament'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
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
                action={
                  formatFilter ? (
                    <span className="rounded-full border border-[#19B7FF]/20 bg-[#19B7FF]/[0.06] px-3 py-1.5 text-xs font-semibold text-[#19B7FF]">
                      Filter Active
                    </span>
                  ) : null
                }
              />

              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6F7B8A]">
                These are real FC ARENA tournament modes. Filter the current list by structure, or start a new tournament with the selected format already configured.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {([
                  {
                    value:
                      'LEAGUE_ROUND_ROBIN',
                    title:
                      'League / Round Robin',
                    description:
                      'Every team meets every opponent once.',
                    icon:
                      '↻',
                    meta:
                      'Single leg · Auto fixtures',
                  },
                  {
                    value:
                      'DOUBLE_ROUND_ROBIN',
                    title:
                      'Double Round Robin',
                    description:
                      'Every pairing is played home and away.',
                    icon:
                      '⇄',
                    meta:
                      'Home & away · 2 legs',
                  },
                  {
                    value:
                      'SINGLE_ELIMINATION',
                    title:
                      'Knockout',
                    description:
                      'Single-elimination bracket with automatic progression.',
                    icon:
                      '◇',
                    meta:
                      'Bracket · Winner advances',
                  },
                  {
                    value:
                      'GROUP_STAGE_KNOCKOUT',
                    title:
                      'Group + Knockout',
                    description:
                      'Group stage, qualification rules and playoff bracket.',
                    icon:
                      '▦',
                    meta:
                      'Groups · Qualifiers · Playoffs',
                  },
                ] as Array<{
                  value:
                    CompetitionFormat;
                  title:
                    string;
                  description:
                    string;
                  icon:
                    string;
                  meta:
                    string;
                }>).map(
                  (
                    item,
                  ) => {
                    const selected =
                      formatFilter ===
                      item.value;

                    return (
                      <article
                        key={
                          item.value
                        }
                        className={`group flex min-h-[230px] flex-col rounded-2xl border p-4 transition duration-200 ${
                          selected
                            ? 'border-[#19B7FF]/35 bg-[#19B7FF]/[0.055] shadow-[0_10px_28px_rgba(25,183,255,0.06)]'
                            : 'border-[#203141] bg-[#101923] hover:-translate-y-0.5 hover:border-[#2D4356] hover:bg-[#121D28]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className={`grid h-11 w-11 place-items-center rounded-xl border text-lg ${
                            selected
                              ? 'border-[#19B7FF]/25 bg-[#19B7FF]/[0.08] text-[#19B7FF]'
                              : 'border-[#203141] bg-[#14212D] text-[#A7B0BE]'
                          }`}>
                            {
                              item.icon
                            }
                          </span>

                          <FcStatusBadge
                            label="Ready"
                            tone="emerald"
                          />
                        </div>

                        <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">
                          {
                            item.title
                          }
                        </h3>

                        <p className="mt-2 text-xs leading-5 text-[#6F7B8A]">
                          {
                            item.description
                          }
                        </p>

                        <p className="mt-3 text-[11px] font-medium text-[#8290A0]">
                          {
                            item.meta
                          }
                        </p>

                        <div className="mt-auto grid gap-2 pt-5">
                          <button
                            type="button"
                            onClick={() => {
                              setFormatFilter(
                                selected
                                  ? null
                                  : item.value,
                              );

                              window.scrollTo({
                                top:
                                  420,
                                behavior:
                                  'smooth',
                              });
                            }}
                            className={`min-h-10 rounded-[10px] border px-3 text-sm font-semibold transition ${
                              selected
                                ? 'border-[#19B7FF]/30 bg-[#19B7FF]/[0.08] text-[#19B7FF]'
                                : 'border-[#203141] bg-[#0B1118] text-[#A7B0BE] hover:border-[#2D4356] hover:text-[#F8FAFC]'
                            }`}
                          >
                            {selected
                              ? 'Showing This Format'
                              : 'Show Tournaments'}
                          </button>

                          {selectedMembership.adminRole ? (
                            <Link
                              href={
                                `/leagues/${selectedMembership.league.id}/tournaments?create=1&format=${item.value}`
                              }
                              className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-[#19B7FF] px-3 text-sm font-semibold text-[#071019] transition hover:bg-[#21C3FF]"
                            >
                              Create with this Format →
                            </Link>
                          ) : (
                            <Link
                              href={
                                `/leagues/${selectedMembership.league.id}/tournaments`
                              }
                              className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-[#203141] px-3 text-sm font-medium text-[#A7B0BE] transition hover:bg-[#151C26] hover:text-[#F8FAFC]"
                            >
                              Open League Tournaments →
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </FcPanel>
          </>
        )}
      </div>
    </AppShell>
  );
}
