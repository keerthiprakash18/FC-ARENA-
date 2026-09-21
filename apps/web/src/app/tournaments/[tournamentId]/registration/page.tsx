'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';
import type {
  FormEvent,
} from 'react';
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
  FcLoadingScreen,
  FcPanel,
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
  name: string;
  code: string;
  mode: string;
  status: string;
  registrationMode: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  isLeagueAdmin: boolean;
}


interface RegistrationMember {
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
}


interface Registration {
  id: string;
  entryName: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;

  registeredBy?: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;

      identity: {
        inGameName: string;
      } | null;
    } | null;
  };

  members: RegistrationMember[];
}


interface TournamentResponse {
  data: {
    tournament: Tournament;
  };
}


interface MyRegistrationResponse {
  data: {
    registration: Registration | null;
  };
}


interface RegistrationsResponse {
  data: {
    registrations: Registration[];
  };
}


interface MutationResponse {
  data: {
    message: string;
  };
}


function statusTone(
  status: string,
):
  | 'emerald'
  | 'amber'
  | 'red'
  | 'slate'
  | 'cyan' {
  if (
    status ===
    'APPROVED'
  ) {
    return 'emerald';
  }

  if (
    status ===
    'PENDING'
  ) {
    return 'amber';
  }

  if (
    status ===
    'REJECTED'
  ) {
    return 'red';
  }

  return 'slate';
}


function memberGameName(
  registration:
    Registration,
) {
  return (
    registration
      .members[0]
      ?.user
      .player
      ?.identity
      ?.inGameName ||
    registration
      .registeredBy
      ?.player
      ?.identity
      ?.inGameName ||
    registration
      .members[0]
      ?.user
      .fullName ||
    registration
      .registeredBy
      ?.fullName ||
    'Unknown Player'
  );
}


function memberPlayerCode(
  registration:
    Registration,
) {
  return (
    registration
      .members[0]
      ?.user
      .player
      ?.playerCode ||
    registration
      .registeredBy
      ?.player
      ?.playerCode ||
    '—'
  );
}


export default function TournamentRegistrationPage() {
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
    playerCodes,
    setPlayerCodes,
  ] =
    useState('');

  const [
    gameName,
    setGameName,
  ] =
    useState('');

  const [
    myRegistration,
    setMyRegistration,
  ] =
    useState<Registration | null>(
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
    reviewBusy,
    setReviewBusy,
  ] =
    useState<string | null>(
      null,
    );

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


  async function refreshTournament() {
    const response =
      await authenticatedRequest<TournamentResponse>(
        `/tournaments/${tournamentId}`,
      );

    setTournament(
      response
        .data
        .tournament,
    );

    return response
      .data
      .tournament;
  }


  async function refreshRegistrationState(
    nextTournament:
      Tournament,
  ) {
    if (
      nextTournament
        .isLeagueAdmin
    ) {
      const response =
        await authenticatedRequest<RegistrationsResponse>(
          `/tournaments/${tournamentId}/registrations`,
        );

      setRegistrations(
        response
          .data
          .registrations,
      );

      return;
    }

    const response =
      await authenticatedRequest<MyRegistrationResponse>(
        `/tournaments/${tournamentId}/my-registration`,
      );

    setMyRegistration(
      response
        .data
        .registration,
    );
  }


  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        const response =
          await authenticatedRequest<TournamentResponse>(
            `/tournaments/${tournamentId}`,
          );

        const tournamentData =
          response
            .data
            .tournament;

        setUser(
          current,
        );

        setTournament(
          tournamentData,
        );

        setPlayerCodes(
          current.player
            ?.playerCode ??
            '',
        );

        setGameName(
          current.player
            ?.identity
            ?.inGameName ??
            '',
        );

        await refreshRegistrationState(
          tournamentData,
        );
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


  const pendingRegistrations =
    useMemo(
      () =>
        registrations.filter(
          (
            registration,
          ) =>
            registration.status ===
            'PENDING',
        ),
      [
        registrations,
      ],
    );


  const approvedRegistrations =
    useMemo(
      () =>
        registrations.filter(
          (
            registration,
          ) =>
            registration.status ===
            'APPROVED',
        ),
      [
        registrations,
      ],
    );


  async function submitRegistration(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !tournament
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    const data =
      new FormData(
        event.currentTarget,
      );

    const entryName =
      String(
        data.get(
          'entryName',
        ) ??
        '',
      ).trim();

    const codes =
      playerCodes
        .split(
          /[\n,]+/,
        )
        .map(
          (
            value,
          ) =>
            value
              .trim()
              .toUpperCase(),
        )
        .filter(
          Boolean,
        );

    try {
      const individualEntry =
        tournament.teamSize ===
        1;

      const response =
        await authenticatedRequest<MutationResponse>(
          `/tournaments/${tournamentId}/register`,
          {
            method:
              'POST',

            body:
              JSON.stringify(
                individualEntry
                  ? {
                      entryName,
                      inGameName:
                        gameName
                          .trim(),
                    }
                  : {
                      entryName,
                      playerCodes:
                        codes,
                    },
              ),
          },
        );

      setMessage(
        response
          .data
          .message,
      );

      const updatedTournament =
        await refreshTournament();

      await refreshRegistrationState(
        updatedTournament,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function reviewRegistration(
    registrationId:
      string,

    action:
      'approve'
      | 'reject',
  ) {
    if (
      !tournament
        ?.isLeagueAdmin
    ) {
      return;
    }

    setReviewBusy(
      `${registrationId}:${action}`,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<MutationResponse>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/${action}`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response
          .data
          .message,
      );

      const updatedTournament =
        await refreshTournament();

      await refreshRegistrationState(
        updatedTournament,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review registration.',
      );
    } finally {
      setReviewBusy(
        null,
      );
    }
  }


  async function changeRegistration(
    action:
      'open'
      | 'close',
  ) {
    if (
      !tournament
        ?.isLeagueAdmin
    ) {
      return;
    }

    setBusy(
      true,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<MutationResponse>(
          `/tournaments/${tournamentId}/${action}-registration`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response
          .data
          .message,
      );

      const updatedTournament =
        await refreshTournament();

      await refreshRegistrationState(
        updatedTournament,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} registration.`,
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
        label="Loading Registration..."
      />
    );
  }


  const registrationOpen =
    tournament.status ===
    'REGISTRATION_OPEN';

  const isIndividualEntry =
    tournament.teamSize ===
    1;

  const hasActiveRegistration =
    myRegistration?.status ===
      'PENDING' ||
    myRegistration?.status ===
      'APPROVED';

  const canSelfRegister =
    registrationOpen &&
    tournament
      .registrationMode !==
      'ADMIN_ONLY' &&
    !tournament
      .isLeagueAdmin &&
    !hasActiveRegistration;


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
          title="Registration"
          subtitle={
            tournament
              .isLeagueAdmin
              ? 'Review player applications and approve only verified Tournament entries.'
              : 'Join this Tournament with your FC ARENA identity and wait for admin approval.'
          }
          action={
            <FcStatusBadge
              label={
                registrationOpen
                  ? 'Registration Open'
                  : 'Registration Closed'
              }
              tone={
                registrationOpen
                  ? 'emerald'
                  : 'amber'
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
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Participation
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.mode
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Players Per Entry
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.teamSize
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Approval
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.registrationMode ===
                  'APPROVAL'
                    ? 'Admin Review'
                    : tournament.registrationMode ===
                        'OPEN'
                      ? 'Automatic'
                      : 'Admin Only'
                }
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.025] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">
                Approved Entries
              </p>
              <p className="mt-2 font-black">
                {
                  tournament.approvedEntries
                }
                /
                {
                  tournament.maxEntries
                }
              </p>
            </div>
          </div>
        </FcPanel>


        {tournament
          .isLeagueAdmin ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Registration Control
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Player Self-Registration
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Open registration so League players can join from their own account. Close it when entries are ready, resolve any pending applications, then continue Tournament setup.
                </p>
              </div>


              <div className="flex flex-wrap gap-2">
                {tournament.status ===
                  'DRAFT' &&
                tournament.registrationMode !==
                  'ADMIN_ONLY' ? (
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
                    className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-[#03150f] disabled:opacity-40"
                  >
                    {busy
                      ? 'Opening...'
                      : 'Open Registration'}
                  </button>
                ) : null}


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
                    className="rounded-xl border border-amber-400/25 bg-amber-400/[0.04] px-5 py-3 text-sm font-black text-amber-300 disabled:opacity-40"
                  >
                    {busy
                      ? 'Closing...'
                      : 'Close Registration'}
                  </button>
                ) : null}


                {tournament.status ===
                  'REGISTRATION_CLOSED' &&
                pendingRegistrations.length ===
                  0 &&
                approvedRegistrations.length >=
                  2 ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/tournaments/${tournamentId}/wizard/teams`,
                      )
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019]"
                  >
                    Continue Tournament Setup
                  </button>
                ) : null}
              </div>
            </div>


            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Status
                </p>

                <p className="mt-2 font-black">
                  {
                    tournament.status
                      .replaceAll(
                        '_',
                        ' ',
                      )
                  }
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Approved
                </p>

                <p className="mt-2 text-xl font-black text-emerald-300">
                  {
                    approvedRegistrations.length
                  }
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Pending
                </p>

                <p className="mt-2 text-xl font-black text-amber-300">
                  {
                    pendingRegistrations.length
                  }
                </p>
              </div>
            </div>


            {tournament.status ===
              'REGISTRATION_CLOSED' &&
            pendingRegistrations.length >
              0 ? (
              <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-300">
                Registration is closed, but {pendingRegistrations.length} application(s) still need a decision. Approve or reject them below before continuing.
              </p>
            ) : null}
          </FcPanel>
        ) : null}


        {tournament
          .isLeagueAdmin ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Admin Approval Queue
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Pending Registrations
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Approving an entry makes it eligible for groups, fixture generation, standings and Tournament statistics.
                </p>
              </div>

              <FcStatusBadge
                label={
                  `${pendingRegistrations.length} Pending`
                }
                tone={
                  pendingRegistrations.length >
                  0
                    ? 'amber'
                    : 'emerald'
                }
              />
            </div>


            <div className="mt-5 grid gap-3">
              {registrations.length ===
              0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm text-slate-500">
                  No player has submitted a Tournament registration yet.
                </div>
              ) : (
                registrations.map(
                  (
                    registration,
                  ) => (
                    <div
                      key={
                        registration.id
                      }
                      className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-black">
                              {
                                memberGameName(
                                  registration,
                                )
                              }
                            </p>

                            <FcStatusBadge
                              label={
                                registration.status
                              }
                              tone={
                                statusTone(
                                  registration.status,
                                )
                              }
                            />
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                            <p>
                              <span className="text-slate-600">
                                Player ID:
                              </span>{' '}
                              <span className="font-mono font-black text-slate-300">
                                {
                                  memberPlayerCode(
                                    registration,
                                  )
                                }
                              </span>
                            </p>

                            <p>
                              <span className="text-slate-600">
                                Team Name:
                              </span>{' '}
                              <span className="font-black text-slate-300">
                                {
                                  registration.entryName ||
                                  'Not provided'
                                }
                              </span>
                            </p>

                            <p>
                              <span className="text-slate-600">
                                Submitted:
                              </span>{' '}
                              {
                                new Date(
                                  registration.createdAt,
                                ).toLocaleString()
                              }
                            </p>
                          </div>

                          {registration
                            .members.length >
                          1 ? (
                            <p className="mt-3 text-xs text-slate-500">
                              Roster:{' '}
                              {
                                registration
                                  .members
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
                                    ', ',
                                  )
                              }
                            </p>
                          ) : null}
                        </div>


                        {registration.status ===
                        'PENDING' ? (
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={
                                reviewBusy !==
                                null
                              }
                              onClick={() =>
                                void reviewRegistration(
                                  registration.id,
                                  'approve',
                                )
                              }
                              className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-[#03150f] disabled:opacity-40"
                            >
                              {reviewBusy ===
                              `${registration.id}:approve`
                                ? 'Approving...'
                                : 'Approve'}
                            </button>

                            <button
                              type="button"
                              disabled={
                                reviewBusy !==
                                null
                              }
                              onClick={() =>
                                void reviewRegistration(
                                  registration.id,
                                  'reject',
                                )
                              }
                              className="rounded-xl border border-red-400/25 bg-red-400/[0.05] px-4 py-3 text-sm font-black text-red-300 disabled:opacity-40"
                            >
                              {reviewBusy ===
                              `${registration.id}:reject`
                                ? 'Rejecting...'
                                : 'Reject'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </FcPanel>
        ) : null}


        {!tournament
          .isLeagueAdmin &&
        myRegistration ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Your Registration
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {
                    myRegistration.status ===
                    'PENDING'
                      ? 'Waiting for Admin Approval'
                      : myRegistration.status ===
                          'APPROVED'
                        ? 'You Are In'
                        : myRegistration.status ===
                            'REJECTED'
                          ? 'Registration Rejected'
                          : 'Registration Status'
                  }
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Game Name:{' '}
                  <span className="font-black text-slate-300">
                    {
                      memberGameName(
                        myRegistration,
                      )
                    }
                  </span>
                  {' · '}
                  Team Name:{' '}
                  <span className="font-black text-slate-300">
                    {
                      myRegistration.entryName ||
                      'Not provided'
                    }
                  </span>
                </p>
              </div>

              <FcStatusBadge
                label={
                  myRegistration.status
                }
                tone={
                  statusTone(
                    myRegistration.status,
                  )
                }
              />
            </div>

            {myRegistration.status ===
            'APPROVED' ? (
              <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-sm leading-6 text-emerald-300">
                Approved. Your entry is now eligible for Tournament groups, fixtures, standings and verified match statistics.
              </p>
            ) : null}

            {myRegistration.status ===
            'PENDING' ? (
              <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-300">
                Your application is with the Tournament admin. You cannot submit a duplicate registration while this one is pending.
              </p>
            ) : null}

            {myRegistration.status ===
            'REJECTED' ? (
              <p className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[0.04] p-4 text-sm leading-6 text-red-300">
                The admin rejected this entry. If registration is still open, you can correct the details and submit again.
              </p>
            ) : null}
          </FcPanel>
        ) : null}


        {canSelfRegister ? (
          <FcPanel className="p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Player Entry
            </p>

            <h2 className="mt-2 text-xl font-black">
              Join Tournament
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isIndividualEntry
                ? 'Your FC ARENA Player ID is linked automatically. Enter your Game Name and Team Name, then submit for admin approval.'
                : 'Submit the complete roster for this team entry. Every Player ID must already belong to this League.'}
            </p>


            <form
              onSubmit={
                submitRegistration
              }
              className="mt-5 grid gap-4"
            >
              {isIndividualEntry ? (
                <>
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      FC ARENA Player ID
                    </span>

                    <input
                      value={
                        user.player
                          ?.playerCode ??
                        ''
                      }
                      readOnly
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono font-black text-slate-400 outline-none"
                    />
                  </label>


                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Game Name
                    </span>

                    <input
                      value={
                        gameName
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setGameName(
                            event
                              .target
                              .value,
                          )
                      }
                      required
                      maxLength={
                        80
                      }
                      placeholder="Your FC Mobile game name"
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                    />

                    <span className="text-[11px] leading-5 text-slate-600">
                      For identity safety, this must match the Game Name saved in your FC ARENA profile.
                    </span>
                  </label>


                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Team Name
                    </span>

                    <input
                      name="entryName"
                      required
                      maxLength={
                        120
                      }
                      placeholder="Your in-game Team / Club name"
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {tournament.mode ===
                      'DUO'
                        ? 'Duo Name'
                        : 'Team Name'}
                    </span>

                    <input
                      name="entryName"
                      required
                      maxLength={
                        120
                      }
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                    />
                  </label>


                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      FC ARENA Player IDs
                    </span>

                    <textarea
                      value={
                        playerCodes
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setPlayerCodes(
                            event
                              .target
                              .value,
                          )
                      }
                      rows={
                        Math.max(
                          3,
                          tournament.teamSize,
                        )
                      }
                      required
                      placeholder="One Player ID per line"
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono outline-none focus:border-sky-400/50"
                    />
                  </label>
                </>
              )}


              <button
                disabled={
                  busy
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
              >
                {busy
                  ? 'Submitting...'
                  : tournament.registrationMode ===
                      'APPROVAL'
                    ? 'Submit for Admin Approval'
                    : 'Join Tournament'}
              </button>
            </form>
          </FcPanel>
        ) : null}


        {!tournament
          .isLeagueAdmin &&
        tournament
          .registrationMode ===
          'ADMIN_ONLY' ? (
          <FcPanel className="border-amber-400/15 p-6">
            <p className="font-black text-amber-300">
              Admin-managed registration
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Players cannot self-register for this Tournament. The Tournament admin manages all entries.
            </p>
          </FcPanel>
        ) : null}


        {!tournament
          .isLeagueAdmin &&
        !registrationOpen &&
        !myRegistration ? (
          <FcPanel className="border-amber-400/15 p-6">
            <p className="font-black text-amber-300">
              Registration is currently closed.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              The Tournament admin must open registration before League members can submit an entry.
            </p>
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
