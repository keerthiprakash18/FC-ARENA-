'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import type {
  FormEvent,
} from 'react';
import {
  useEffect,
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


type TournamentMode =
  | 'SOLO'
  | 'DUO'
  | 'TEAM';

type CompetitionFormat =
  | 'LEAGUE_ROUND_ROBIN'
  | 'DOUBLE_ROUND_ROBIN'
  | 'SINGLE_ELIMINATION'
  | 'GROUP_STAGE_KNOCKOUT';


interface LeagueInfo {
  id: string;
  name: string;
  code: string;

  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
}


interface Tournament {
  id: string;
  name: string;
  code: string;
  description: string | null;
  logoUrl?: string | null;
  mode: TournamentMode;
  format: string;
  competitionFormat?: string;
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
}


export default function LeagueTournamentsPage() {
  const params =
    useParams<{
      leagueId:
        string;
    }>();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const leagueId =
    params.leagueId;

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
    useState<LeagueInfo | null>(
      null,
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<Tournament[]>(
      [],
    );

  const [
    mode,
    setMode,
  ] =
    useState<TournamentMode>(
      'SOLO',
    );


  const [
    competitionFormat,
    setCompetitionFormat,
  ] =
    useState<CompetitionFormat>(
      'LEAGUE_ROUND_ROBIN',
    );

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

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


  async function loadTournaments() {
    const result =
      await authenticatedRequest<{
        success: true;

        data: {
          tournaments:
            Tournament[];
        };

        error: null;
      }>(
        `/leagues/${leagueId}/tournaments`,
      );

    setTournaments(
      result.data.tournaments,
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(
          currentUser,
        );

        const leagueResult =
          await authenticatedRequest<{
            success: true;

            data: {
              league:
                LeagueInfo;
            };

            error: null;
          }>(
            `/leagues/${leagueId}`,
          );

        setLeague(
          leagueResult
            .data
            .league,
        );

        await loadTournaments();
      } catch {
        router.replace(
          '/leagues',
        );
      }
    }

    void load();
  }, [
    leagueId,
    router,
  ]);


  useEffect(() => {
    const requestedFormat =
      searchParams.get(
        'format',
      );

    if (
      requestedFormat ===
        'LEAGUE_ROUND_ROBIN' ||
      requestedFormat ===
        'DOUBLE_ROUND_ROBIN' ||
      requestedFormat ===
        'SINGLE_ELIMINATION' ||
      requestedFormat ===
        'GROUP_STAGE_KNOCKOUT'
    ) {
      setCompetitionFormat(
        requestedFormat,
      );
    }

    if (
      searchParams.get(
        'create',
      ) ===
      '1'
    ) {
      setShowCreate(
        true,
      );
    }
  }, [
    searchParams,
  ]);


  async function createTournament(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(
      true,
    );

    setError(
      '',
    );

    const form =
      new FormData(
        event.currentTarget,
      );

    try {
      const result =
        await authenticatedRequest<{
          success: true;

          data: {
            message:
              string;

            tournament: {
              id: string;
              code: string;
            };
          };

          error: null;
        }>(
          `/leagues/${leagueId}/tournaments`,
          {
            method:
              'POST',

            body:
              JSON.stringify({
                name:
                  String(
                    form.get(
                      'name',
                    ) ??
                    '',
                  ),

                mode,

                competitionFormat,

                groupMode:
                  competitionFormat ===
                  'GROUP_STAGE_KNOCKOUT'
                    ? 'MULTIPLE_GROUPS'
                    : 'SINGLE_GROUP',

                legType:
                  competitionFormat ===
                  'DOUBLE_ROUND_ROBIN'
                    ? 'HOME_AWAY'
                    : 'SINGLE_LEG',

                fixtureMode:
                  'AUTOMATIC',

                maxEntries:
                  Number(
                    form.get(
                      'maxEntries',
                    ),
                  ),

                ...(mode ===
                'TEAM'
                  ? {
                      teamSize:
                        Number(
                          form.get(
                            'teamSize',
                          ),
                        ),
                    }
                  : {}),
              }),
          },
        );

      router.push(
        `/tournaments/${result.data.tournament.id}/wizard/setup`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create Tournament.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function deleteTournament(
    tournament:
      Tournament,
  ) {
    if (
      !isAdmin
    ) {
      return;
    }

    const confirmation =
      window.prompt(
        `Delete "${tournament.name}" permanently? This removes all Tournament teams, groups, fixtures, matches, standings and stats. Type the Tournament name exactly to continue.`,
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

      await loadTournaments();
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


  const isAdmin =
    Boolean(
      league?.adminRole,
    );


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading League Tournaments..."
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
        <Link
          href={
            `/leagues/${leagueId}`
          }
          className="inline-flex text-sm font-black text-slate-500 transition hover:text-sky-300"
        >
          ← Back to League
        </Link>


        <FcPageHeader
          eyebrow={
            league.name
          }
          title="Tournaments"
          subtitle="Tournament creation now starts with a lightweight draft, then continues through the full step-by-step FC ARENA wizard."
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={() =>
                  setShowCreate(
                    (
                      value,
                    ) =>
                      !value,
                  )
                }
                className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019]"
              >
                + New Tournament
              </button>
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


        {(showCreate || (isAdmin && tournaments.length === 0)) &&
        isAdmin ? (
          <FcPanel className="overflow-hidden">
            <div className="border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_60%)] p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
                Start Draft
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Create Tournament
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Choose the competition structure, create the draft, then continue through Teams, Groups when required, Fixture Settings, Preview, Qualification and Review.
              </p>
            </div>


            <form
              onSubmit={
                createTournament
              }
              className="grid gap-5 p-5 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Tournament Name
                  </span>

                  <input
                    name="name"
                    required
                    minLength={
                      3
                    }
                    placeholder="Indian State Championship"
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                  />
                </label>


                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Number of Entries
                  </span>

                  <input
                    name="maxEntries"
                    type="number"
                    min="2"
                    max="128"
                    defaultValue="16"
                    required
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                  />
                </label>
              </div>


              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Competition Format
                  </p>

                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.05] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                    Ready
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {([
                    [
                      'LEAGUE_ROUND_ROBIN',
                      'League / Round Robin',
                      'Every team meets every opponent once.',
                    ],
                    [
                      'DOUBLE_ROUND_ROBIN',
                      'Double Round Robin',
                      'Home and away reverse legs.',
                    ],
                    [
                      'SINGLE_ELIMINATION',
                      'Knockout',
                      'Single-elimination bracket.',
                    ],
                    [
                      'GROUP_STAGE_KNOCKOUT',
                      'Group + Knockout',
                      'Groups, qualifiers and playoffs.',
                    ],
                  ] as Array<
                    [
                      CompetitionFormat,
                      string,
                      string,
                    ]
                  >).map(
                    ([
                      value,
                      label,
                      description,
                    ]) => (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          setCompetitionFormat(
                            value,
                          )
                        }
                        className={`rounded-2xl border p-4 text-left transition duration-200 ${
                          competitionFormat ===
                          value
                            ? 'border-sky-400/35 bg-sky-400/[0.08]'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                        }`}
                      >
                        <p className="font-black">
                          {
                            label
                          }
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {
                            description
                          }
                        </p>
                      </button>
                    ),
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-600">
                  Selected Competition Format: <span className="font-semibold text-sky-300">{competitionLabel(competitionFormat)}</span>. You can still fine-tune it on the next Setup screen.
                </p>
              </div>


              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
                  Participation Type
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    'SOLO',
                    'DUO',
                    'TEAM',
                  ] as TournamentMode[]).map(
                    (
                      value,
                    ) => (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          setMode(
                            value,
                          )
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          mode ===
                          value
                            ? 'border-sky-400/30 bg-sky-400/[0.08]'
                            : 'border-white/10 bg-white/[0.02]'
                        }`}
                      >
                        <p className="font-black">
                          {
                            value
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {value ===
                          'SOLO'
                            ? 'One player per entry'
                            : value ===
                                'DUO'
                              ? 'Two players per entry'
                              : 'Custom team size'}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>


              {mode ===
              'TEAM' ? (
                <label className="grid max-w-sm gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Players Per Team
                  </span>

                  <input
                    name="teamSize"
                    type="number"
                    min="3"
                    max="11"
                    defaultValue="4"
                    required
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                  />
                </label>
              ) : null}


              <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-600">
                  Next: Setup → Teams → Groups when required → Fixture Settings → Preview → Qualification when required → Review.
                </p>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(
                        false,
                      )
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={
                      busy
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-50"
                  >
                    {busy
                      ? 'Creating...'
                      : 'Create Draft & Continue →'}
                  </button>
                </div>
              </div>
            </form>
          </FcPanel>
        ) : null}


        <section>
          <FcSectionHeading
            eyebrow="Competition List"
            title="League Tournaments"
            action={
              <span className="text-xs font-black text-slate-600">
                {
                  tournaments.length
                }{' '}
                tournament
                {tournaments.length ===
                1
                  ? ''
                  : 's'}
              </span>
            }
          />


          {tournaments.length ===
          0 ? (
            <div className="mt-4">
              <FcEmptyState
                title="No tournaments created yet"
                description={
                  isAdmin
                    ? 'Start a Tournament draft and configure the complete competition through the wizard.'
                    : 'League admins have not published any Tournament yet.'
                }
                actionLabel={
                  isAdmin
                    ? undefined
                    : 'Back to League'
                }
                actionHref={
                  isAdmin
                    ? undefined
                    : `/leagues/${leagueId}`
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {tournaments.map(
                (
                  tournament,
                ) => (
                  <FcPanel
                    key={
                      tournament.id
                    }
                    className="overflow-hidden transition hover:border-sky-400/25"
                  >
                    <div className="border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(14,165,233,0.06),transparent_60%)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <FcCrest
                            name={
                              tournament.name
                            }
                            imageUrl={
                              tournament.logoUrl
                            }
                          />

                          <div>
                            <p className="font-mono text-[10px] text-sky-400">
                              {
                                tournament.code
                              }
                            </p>

                            <h3 className="mt-1 text-xl font-black">
                              {
                                tournament.name
                              }
                            </h3>
                          </div>
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
                    </div>


                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-white/[0.025] p-3">
                          <p className="text-[9px] uppercase tracking-wider text-slate-600">
                            Format
                          </p>

                          <p className="mt-1 truncate text-xs font-black">
                            {
                              competitionLabel(
                                tournament.competitionFormat ||
                                tournament.format,
                              )
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-white/[0.025] p-3">
                          <p className="text-[9px] uppercase tracking-wider text-slate-600">
                            Entries
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
                          <p className="text-[9px] uppercase tracking-wider text-slate-600">
                            Start
                          </p>

                          <p className="mt-1 text-xs font-black">
                            {tournament.startAt
                              ? new Date(
                                  tournament.startAt,
                                ).toLocaleDateString()
                              : 'TBD'}
                          </p>
                        </div>
                      </div>


                      <div className="mt-5 flex flex-wrap gap-2">
                        {tournament.status ===
                          'DRAFT' &&
                        isAdmin ? (
                          <Link
                            href={
                              `/tournaments/${tournament.id}/wizard/setup`
                            }
                            className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                          >
                            Continue Setup
                          </Link>
                        ) : (
                          <Link
                            href={
                              `/tournaments/${tournament.id}`
                            }
                            className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                          >
                            View Tournament
                          </Link>
                        )}

                        <Link
                          href={
                            `/tournaments/${tournament.id}/teams`
                          }
                          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                        >
                          Manage Teams
                        </Link>

                        <Link
                          href={
                            `/tournaments/${tournament.id}/fixtures`
                          }
                          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                        >
                          Fixtures
                        </Link>

                        {isAdmin ? (
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
                            className="rounded-xl border border-red-400/30 bg-red-400/[0.04] px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                          >
                            {deletingTournamentId ===
                            tournament.id
                              ? 'Deleting...'
                              : 'Delete Tournament'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </FcPanel>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
