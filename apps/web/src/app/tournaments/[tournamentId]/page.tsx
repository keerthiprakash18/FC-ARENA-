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
  competitionLabel,
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface Tournament {
  id: string;
  leagueId: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  description: string | null;
  mode: string;
  format: string;
  competitionFormat?: string;
  groupMode?: string;
  status: string;
  visibility: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  endAt?: string | null;
  isLeagueAdmin: boolean;

  league: {
    id: string;
    name: string;
    code: string;
  };
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


interface Group {
  id: string;
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


export default function TournamentOverviewPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId:
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
    tournament,
    setTournament,
  ] =
    useState<Tournament | null>(
      null,
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<Fixture[]>(
      [],
    );

  const [
    groups,
    setGroups,
  ] =
    useState<Group[]>(
      [],
    );


  const [
    deletingTournament,
    setDeletingTournament,
  ] =
    useState(false);

  const [
    deleteError,
    setDeleteError,
  ] =
    useState('');


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          tournamentResponse,
          fixtureResponse,
          groupResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/fixtures`,
            ).catch(
              () => ({
                data: {
                  fixtures: [],
                },
              }),
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/groups`,
            ).catch(
              () => ({
                data: {
                  groups: [],
                },
              }),
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          tournamentResponse
            .data
            .tournament,
        );

        setFixtures(
          fixtureResponse
            .data
            .fixtures,
        );

        setGroups(
          groupResponse
            .data
            .groups,
        );
      } catch {
        router.replace(
          '/tournaments',
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);


  const nextFixture =
    useMemo(
      () =>
        [
          ...fixtures,
        ]
          .filter(
            (
              fixture,
            ) => {
              const status =
                fixture.match
                  ?.status ||
                fixture.status;

              return ![
                'COMPLETED',
                'CANCELLED',
              ].includes(
                status,
              );
            },
          )
          .sort(
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
        null,
      [
        fixtures,
      ],
    );


  async function deleteTournament() {
    if (
      !tournament ||
      !tournament.isLeagueAdmin ||
      deletingTournament
    ) {
      return;
    }

    const confirmation =
      window.prompt(
        `Delete "${tournament.name}" permanently? This removes all teams, groups, fixtures, matches, standings and Tournament stats. Type the Tournament name exactly to continue.`,
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
      setDeleteError(
        'Tournament name confirmation does not match.',
      );

      return;
    }

    setDeletingTournament(
      true,
    );

    setDeleteError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}`,
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

      router.replace(
        '/tournaments',
      );

      router.refresh();
    } catch (
      err
    ) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Unable to delete Tournament.',
      );
    } finally {
      setDeletingTournament(
        false,
      );
    }
  }


  if (
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen
        label="Loading Tournament Overview..."
      />
    );
  }


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
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref="/tournaments"
          backLabel="Tournaments"
          eyebrow={
            tournament.league.name
          }
          title={
            tournament.name
          }
          subtitle={
            tournament.description ||
            'Tournament overview'
          }
          action={
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
          }
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        {deleteError ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              deleteError
            }
          </div>
        ) : null}


        <FcPanel className="overflow-hidden">
          <div className="bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_65%)] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <FcCrest
                  name={
                    tournament.name
                  }
                  imageUrl={
                    tournament.logoUrl
                  }
                  size="lg"
                />

                <div>
                  <p className="font-mono text-xs font-black text-sky-400">
                    {
                      tournament.code
                    }
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <FcStatusBadge
                      label={
                        competitionLabel(
                          tournament.competitionFormat ||
                          tournament.format,
                        )
                      }
                      tone="cyan"
                    />

                    <FcStatusBadge
                      label={
                        tournament.mode
                      }
                      tone="slate"
                    />
                  </div>
                </div>
              </div>


              <div className="flex flex-wrap gap-2">
                {tournament.status ===
                  'DRAFT' &&
                tournament.isLeagueAdmin ? (
                  <Link
                    href={
                      `/tournaments/${tournamentId}/wizard/setup`
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019]"
                  >
                    Continue Setup
                  </Link>
                ) : null}

                {tournament.visibility ===
                'PUBLIC' ? (
                  <Link
                    href={'/public/tournaments/' + tournament.code}
                    target="_blank"
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.04] px-5 py-3 text-sm font-black text-emerald-300"
                  >
                    Public Page ↗
                  </Link>
                ) : null}

                <Link
                  href={
                    `/tournaments/${tournamentId}/teams`
                  }
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300"
                >
                  Manage Teams
                </Link>

                <Link
                  href={
                    `/tournaments/${tournamentId}/registration`
                  }
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300"
                >
                  Registration
                </Link>

                {tournament.isLeagueAdmin ? (
                  <button
                    type="button"
                    disabled={
                      deletingTournament
                    }
                    onClick={() =>
                      void deleteTournament()
                    }
                    className="rounded-xl border border-red-400/30 bg-red-400/[0.04] px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                  >
                    {deletingTournament
                      ? 'Deleting...'
                      : 'Delete Tournament'}
                  </button>
                ) : null}
              </div>
            </div>


            <div className="mt-6">
              <div className="flex justify-between text-xs font-black text-slate-500">
                <span>
                  Entry Progress
                </span>

                <span>
                  {
                    tournament.approvedEntries
                  }
                  /
                  {
                    tournament.maxEntries
                  }
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
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
        </FcPanel>


        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Teams"
            value={
              tournament.approvedEntries
            }
            detail={
              `Max ${tournament.maxEntries}`
            }
          />

          <FcStatCard
            label="Groups"
            value={
              groups.length
            }
            detail={
              tournament.groupMode
                ? competitionLabel(
                    tournament.groupMode,
                  )
                : 'Single table'
            }
            tone="amber"
          />

          <FcStatCard
            label="Fixtures"
            value={
              fixtures.length
            }
            detail="Tournament schedule"
            tone="emerald"
          />

          <FcStatCard
            label="Stage"
            value={
              competitionLabel(
                tournament.status,
              )
            }
            detail="Current state"
            tone="slate"
          />
        </section>


        {nextFixture ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Next Match
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {
                    nextFixture.roundName
                  }
                </h2>
              </div>

              <FcStatusBadge
                label={
                  nextFixture.match
                    ?.status ||
                  nextFixture.status
                }
                tone="cyan"
              />
            </div>

            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <p className="truncate text-right font-black">
                {
                  entryName(
                    nextFixture.home,
                  )
                }
              </p>

              <span className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2 text-xs font-black text-sky-300">
                VS
              </span>

              <p className="truncate font-black">
                {
                  entryName(
                    nextFixture.away,
                  )
                }
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
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
                    : `/tournaments/${tournamentId}/fixtures`
                }
                className="rounded-xl bg-sky-400 px-4 py-3 text-center text-sm font-black text-[#031019]"
              >
                View Match
              </Link>
            </div>
          </FcPanel>
        ) : (
          <FcEmptyState
            title="No upcoming match"
            description="Open Fixtures to review the Tournament schedule or generate matches when permitted."
            actionLabel="Open Fixtures"
            actionHref={
              `/tournaments/${tournamentId}/fixtures`
            }
          />
        )}


        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            [
              'Teams',
              'Tournament entries and team management',
              `/tournaments/${tournamentId}/teams`,
            ],
            [
              'Groups',
              'Group structure and assignments',
              `/tournaments/${tournamentId}/groups`,
            ],
            [
              'Standings',
              'Live tables from confirmed results',
              `/tournaments/${tournamentId}/standings`,
            ],
            [
              'Bracket',
              'Knockout qualification and progression',
              `/tournaments/${tournamentId}/playoffs`,
            ],
          ].map(
            ([
              title,
              description,
              href,
            ]) => (
              <Link
                key={
                  title
                }
                href={
                  href
                }
                className="rounded-2xl border border-white/10 bg-[#08111b] p-4 transition hover:border-sky-400/30"
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

                <span className="mt-3 inline-flex text-xs font-black text-sky-300">
                  Open →
                </span>
              </Link>
            ),
          )}
        </section>
      </div>
    </AppShell>
  );
}
