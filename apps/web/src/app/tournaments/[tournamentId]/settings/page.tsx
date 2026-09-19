'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
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
  BackHeader,
} from '@/components/app/back-header';

import {
  competitionLabel,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


interface Tournament {
  id: string;
  name: string;
  status: string;
  isLeagueAdmin: boolean;
  competitionFormat?: string;
  format: string;
  groupMode?: string;
  legType?: string;
  fixtureMode?: string;
  visibility?: string;
  registrationMode?: string;
  maxEntries: number;
  dailyMatchLimit: number;
  matchesPerParticipantPerDay: number;
  matchDurationMinutes: number;
}


interface Registration {
  id: string;
  entryName: string | null;
  status: string;

  registeredBy: {
    fullName: string;
  };

  members: Array<{
    user: {
      id: string;
      fullName: string;

      player: {
        playerCode: string;
        identity: {
          inGameName: string;
        } | null;
      } | null;
    };
  }>;
}


export default function TournamentSettingsPage() {
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
    registrations,
    setRegistrations,
  ] =
    useState<Registration[]>(
      [],
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');


  async function loadTournament() {
    const response =
      await authenticatedRequest<any>(
        `/tournaments/${tournamentId}`,
      );

    const value:
      Tournament =
      response
        .data
        .tournament;

    setTournament(
      value,
    );

    if (
      value.isLeagueAdmin
    ) {
      const registrationsResponse =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/registrations`,
        );

      setRegistrations(
        registrationsResponse
          .data
          .registrations,
      );
    }

    return value;
  }


  useEffect(() => {
    void (async () => {
      try {
        setUser(
          await getCurrentUser(),
        );

        await loadTournament();
      } catch {
        router.replace(
          `/tournaments/${tournamentId}`,
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);


  async function changeRegistration(
    action:
      | 'open'
      | 'close',
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          action ===
          'open'
            ? `/tournaments/${tournamentId}/open-registration`
            : `/tournaments/${tournamentId}/close-registration`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update registration.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function review(
    registrationId:
      string,

    action:
      | 'approve'
      | 'reject',
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/${action}`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review registration.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function updateScheduling(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/scheduling-settings`,
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                dailyMatchLimit:
                  Number(
                    data.get(
                      'dailyMatchLimit',
                    ),
                  ),

                matchesPerParticipantPerDay:
                  Number(
                    data.get(
                      'matchesPerParticipantPerDay',
                    ),
                  ),

                matchDurationMinutes:
                  Number(
                    data.get(
                      'matchDurationMinutes',
                    ),
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update scheduling settings.',
      );
    } finally {
      setBusy(
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
        label="Loading Tournament Settings..."
      />
    );
  }


  const pending =
    registrations.filter(
      (
        registration,
      ) =>
        registration.status ===
        'PENDING',
    );

  const rows = [
    [
      'Format',
      tournament.competitionFormat ||
      tournament.format,
    ],
    [
      'Group Mode',
      tournament.groupMode,
    ],
    [
      'Leg Type',
      tournament.legType,
    ],
    [
      'Fixture Mode',
      tournament.fixtureMode,
    ],
    [
      'Visibility',
      tournament.visibility,
    ],
    [
      'Registration',
      tournament.registrationMode,
    ],
    [
      'Maximum Entries',
      tournament.maxEntries,
    ],
  ];


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
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Settings"
          subtitle={
            tournament.isLeagueAdmin
              ? 'Tournament administration, registration control and scheduling rules.'
              : 'Tournament configuration.'
          }
          action={
            <FcStatusBadge
              label={
                tournament.status
              }
              tone={
                tournament.status ===
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


        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Configuration
          </p>

          <div className="mt-4 divide-y divide-white/[0.06]">
            {rows.map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    String(
                      label,
                    )
                  }
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <p className="text-sm text-slate-500">
                    {
                      label
                    }
                  </p>

                  <p className="text-right text-sm font-black">
                    {
                      competitionLabel(
                        String(
                          value ??
                          '—',
                        ),
                      )
                    }
                  </p>
                </div>
              ),
            )}
          </div>

          {tournament.status ===
            'DRAFT' &&
          tournament.isLeagueAdmin ? (
            <Link
              href={
                `/tournaments/${tournamentId}/wizard/setup`
              }
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
            >
              Continue Setup Wizard
            </Link>
          ) : null}
        </FcPanel>


        {tournament.isLeagueAdmin ? (
          <>
            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Registration Control
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <FcStatusBadge
                  label={
                    tournament.status
                  }
                  tone={
                    tournament.status ===
                    'REGISTRATION_OPEN'
                      ? 'emerald'
                      : 'amber'
                  }
                />

                {tournament.status ===
                  'REGISTRATION_OPEN' ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void changeRegistration(
                        'close',
                      )
                    }
                    className="rounded-xl border border-amber-400/20 px-4 py-3 text-sm font-black text-amber-300 disabled:opacity-40"
                  >
                    Close Registration
                  </button>
                ) : tournament.status ===
                    'DRAFT' ||
                  tournament.status ===
                    'REGISTRATION_CLOSED' ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void changeRegistration(
                        'open',
                      )
                    }
                    className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    Open Registration
                  </button>
                ) : null}
              </div>
            </FcPanel>


            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Scheduling Rules
              </p>

              <form
                onSubmit={
                  updateScheduling
                }
                className="mt-4 grid gap-4 lg:grid-cols-3"
              >
                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Daily Match Limit
                  </span>

                  <input
                    name="dailyMatchLimit"
                    type="number"
                    min="1"
                    defaultValue={
                      tournament.dailyMatchLimit
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Matches Per Participant / Day
                  </span>

                  <input
                    name="matchesPerParticipantPerDay"
                    type="number"
                    min="1"
                    defaultValue={
                      tournament.matchesPerParticipantPerDay
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Match Duration Minutes
                  </span>

                  <input
                    name="matchDurationMinutes"
                    type="number"
                    min="5"
                    defaultValue={
                      tournament.matchDurationMinutes
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <div className="lg:col-span-3">
                  <button
                    disabled={
                      busy
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    Save Scheduling Rules
                  </button>
                </div>
              </form>
            </FcPanel>


            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                    Admin Review
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Pending Registrations
                  </h2>
                </div>

                <FcStatusBadge
                  label={
                    `${pending.length} Pending`
                  }
                  tone="amber"
                />
              </div>

              <div className="grid gap-3">
                {pending.map(
                  (
                    registration,
                  ) => (
                    <FcPanel
                      key={
                        registration.id
                      }
                      className="p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">
                            {registration.entryName ||
                              registration.members
                                .map(
                                  (
                                    member,
                                  ) =>
                                    member
                                      .user
                                      .player
                                      ?.identity
                                      ?.inGameName ||
                                    member
                                      .user
                                      .fullName,
                                )
                                .join(
                                  ' + ',
                                )}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Registered by{' '}
                            {
                              registration
                                .registeredBy
                                .fullName
                            }
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void review(
                                registration.id,
                                'approve',
                              )
                            }
                            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#031019] disabled:opacity-40"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void review(
                                registration.id,
                                'reject',
                              )
                            }
                            className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </FcPanel>
                  ),
                )}

                {pending.length ===
                0 ? (
                  <FcPanel className="border-dashed p-8 text-center text-sm text-slate-500">
                    No pending Tournament registrations.
                  </FcPanel>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <FcPanel className="p-5">
            <p className="text-sm leading-6 text-slate-500">
              Only authorized League admins can change Tournament registration and scheduling settings.
            </p>
          </FcPanel>
        )}
      </div>
    </AppShell>
  );
}
