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
  FcCrest,
  FcEmptyState,
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


interface EntryMember {
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


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  fixtureCount: number;
  status: string;
  members: EntryMember[];
}


interface RoleAssignment {
  id: string;
  userId: string;
  role: string;

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


interface Tournament {
  id: string;
  name: string;
  status: string;
  maxEntries: number;
  isLeagueAdmin: boolean;
}


interface TournamentResponse {
  success: true;
  data: {
    tournament: Tournament;
  };
  error: null;
}


interface EntriesResponse {
  success: true;
  data: {
    maxEntries: number;
    entries: Entry[];
  };
  error: null;
}


export default function TournamentTeamsPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId: string;
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
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
      [],
    );

  const [
    roleAssignments,
    setRoleAssignments,
  ] =
    useState<RoleAssignment[]>(
      [],
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    editName,
    setEditName,
  ] =
    useState('');

  const [
    editLogo,
    setEditLogo,
  ] =
    useState('');

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


  async function loadEntries() {
    const teams =
      await authenticatedRequest<EntriesResponse>(
        `/tournaments/${tournamentId}/entries`,
      );

    setEntries(
      teams.data.entries,
    );
  }


  async function loadMatchAdmins() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          assignments:
            RoleAssignment[];
        };

        error: null;
      }>(
        `/security/roles/TOURNAMENT/${tournamentId}`,
      );

    setRoleAssignments(
      response.data.assignments,
    );
  }


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          competition,
          teams,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<TournamentResponse>(
              `/tournaments/${tournamentId}`,
            ),

            authenticatedRequest<EntriesResponse>(
              `/tournaments/${tournamentId}/entries`,
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          competition
            .data
            .tournament,
        );

        setEntries(
          teams
            .data
            .entries,
        );

        if (
          competition
            .data
            .tournament
            .isLeagueAdmin
        ) {
          await loadMatchAdmins();
        }
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


  const totalFixtures =
    useMemo(
      () =>
        entries.reduce(
          (
            sum,
            entry,
          ) =>
            sum +
            entry.fixtureCount,
          0,
        ),
      [
        entries,
      ],
    );


  const matchAdminAssignments =
    useMemo(
      () =>
        roleAssignments.filter(
          (
            assignment,
          ) =>
            assignment.role ===
            'MATCH_OFFICIAL',
        ),
      [
        roleAssignments,
      ],
    );


  const currentMatchAdmin =
    matchAdminAssignments[0] ??
    null;


  function matchAdminAssignmentFor(
    userId: string,
  ) {
    return (
      matchAdminAssignments.find(
        (
          assignment,
        ) =>
          assignment.userId ===
          userId,
      ) ??
      null
    );
  }


  async function assignMatchAdmin(
    targetUserId: string,
  ) {
    if (
      !tournament
        ?.isLeagueAdmin
    ) {
      return;
    }

    if (
      currentMatchAdmin &&
      currentMatchAdmin.userId !==
        targetUserId
    ) {
      setError(
        'Only one Tournament Match Admin is enabled at a time. Remove the current Match Admin first.',
      );

      return;
    }

    setBusy(
      true,
    );

    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        '/security/roles',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              userId:
                targetUserId,

              role:
                'MATCH_OFFICIAL',

              scopeType:
                'TOURNAMENT',

              scopeId:
                tournamentId,
            }),
        },
      );

      setMessage(
        'Tournament Match Admin assigned. This player can now update fixtures and confirm match results for this Tournament.',
      );

      await loadMatchAdmins();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to assign Match Admin.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function removeMatchAdmin(
    assignmentId: string,
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

    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/security/roles/${assignmentId}`,
        {
          method:
            'DELETE',
        },
      );

      setMessage(
        'Tournament Match Admin access removed.',
      );

      await loadMatchAdmins();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove Match Admin.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  const preActive =
    tournament
      ? [
          'DRAFT',
          'REGISTRATION_OPEN',
          'REGISTRATION_CLOSED',
        ].includes(
          tournament.status,
        )
      : false;


  const canManageEntries =
    Boolean(
      tournament
        ?.isLeagueAdmin &&
      preActive &&
      totalFixtures ===
        0,
    );


  function beginEdit(
    entry: Entry,
  ) {
    setEditingId(
      entry.id,
    );

    setEditName(
      entry.entryName ??
      '',
    );

    setEditLogo(
      entry.entryLogoUrl ??
      '',
    );

    setError(
      '',
    );

    setMessage(
      '',
    );
  }


  async function saveEdit(
    entryId: string,
  ) {
    if (
      !canManageEntries
    ) {
      return;
    }

    if (
      !editName.trim()
    ) {
      setError(
        'Team name cannot be empty.',
      );

      return;
    }

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
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/${entryId}`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              entryName:
                editName.trim(),

              entryLogoUrl:
                editLogo.trim(),
            }),
        },
      );

      setEditingId(
        null,
      );

      setMessage(
        'Team updated successfully.',
      );

      await loadEntries();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update team.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function deleteTeam(
    entry: Entry,
  ) {
    if (
      !canManageEntries
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${entry.entryName ?? 'this team'}" from this Tournament? This cannot be undone.`,
      );

    if (
      !confirmed
    ) {
      return;
    }

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
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/${entry.id}`,
        {
          method:
            'DELETE',
        },
      );

      if (
        editingId ===
        entry.id
      ) {
        setEditingId(
          null,
        );
      }

      setMessage(
        'Team deleted from Tournament.',
      );

      await loadEntries();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete team.',
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
        label="Loading Tournament Teams..."
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
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Teams"
          subtitle="Approved Tournament participants. Admins can manage entries safely before fixtures are generated."
          action={
            <FcStatusBadge
              label={
                tournament.status
              }
              tone={
                tournament.status ===
                'ACTIVE'
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


        {tournament.isLeagueAdmin ? (
          <FcPanel className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-400">
                  Tournament Match Admin
                </p>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Assign one linked Tournament player to update existing fixtures, use OCR and submit, confirm, correct or reverse Match results. This does not grant League Admin or Tournament settings access.
                </p>
              </div>

              {currentMatchAdmin ? (
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                      Active Match Admin
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {currentMatchAdmin.user.player
                        ?.identity
                        ?.inGameName ||
                        currentMatchAdmin.user.fullName}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void removeMatchAdmin(
                        currentMatchAdmin.id,
                      )
                    }
                    className="inline-flex min-h-9 items-center justify-center rounded-[9px] border border-red-400/25 px-3 text-xs font-semibold text-red-300 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-slate-500">
                  Not assigned
                </span>
              )}
            </div>
          </FcPanel>
        ) : null}


        {tournament.isLeagueAdmin ? (
          <FcPanel className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Participant Management
                </p>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Add, edit or delete participants before fixtures are generated. Once fixtures exist, participant changes are locked to protect the schedule.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={
                    `/tournaments/${tournamentId}/registration`
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-white/10 px-4 text-sm font-black text-slate-400 transition hover:text-white"
                >
                  Registrations
                </Link>

                {canManageEntries ? (
                  <Link
                    href={
                      `/tournaments/${tournamentId}/wizard/teams`
                    }
                    className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-sky-400 px-4 text-sm font-black text-[#031019]"
                  >
                    + Add / Manage Teams
                  </Link>
                ) : null}
              </div>
            </div>
          </FcPanel>
        ) : null}


        {tournament.isLeagueAdmin &&
        !canManageEntries ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-300">
            {totalFixtures >
            0
              ? 'Participant editing is locked because fixtures already exist. Reset/remove the generated fixtures before changing Tournament participants.'
              : 'Participant editing is locked because this Tournament is already active or completed.'}
          </div>
        ) : null}


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


        {entries.length ===
        0 ? (
          <FcEmptyState
            title="No Tournament teams yet"
            description="Teams will appear here once entries are added or approved."
            actionLabel="Open Registration"
            actionHref={
              `/tournaments/${tournamentId}/registration`
            }
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map(
              (
                entry,
              ) => (
                <FcPanel
                  key={
                    entry.id
                  }
                  className="p-5"
                >
                  {editingId ===
                    entry.id &&
                  canManageEntries ? (
                    <div className="space-y-3">
                      <label className="grid gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Team Name
                        </span>

                        <input
                          value={
                            editName
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              setEditName(
                                event
                                  .target
                                  .value,
                              )
                          }
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Logo URL — optional
                        </span>

                        <input
                          value={
                            editLogo
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              setEditLogo(
                                event
                                  .target
                                  .value,
                              )
                          }
                          placeholder="https://..."
                          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50"
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void saveEdit(
                              entry.id,
                            )
                          }
                          className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-[#03150f] disabled:opacity-40"
                        >
                          {busy
                            ? 'Saving...'
                            : 'Save Changes'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            setEditingId(
                              null,
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-slate-400 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <FcCrest
                          name={
                            entry.entryName ||
                            'FC Team'
                          }
                          imageUrl={
                            entry.entryLogoUrl
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-black">
                              {entry.entryName ||
                                'Unnamed Team'}
                            </h2>

                            <FcStatusBadge
                              label={
                                entry.status
                              }
                              tone={
                                entry.status ===
                                'APPROVED'
                                  ? 'emerald'
                                  : 'amber'
                              }
                            />
                          </div>

                          <p className="mt-1 text-xs text-slate-600">
                            {
                              entry.fixtureCount
                            }{' '}
                            fixtures
                          </p>
                        </div>
                      </div>

                      {tournament.isLeagueAdmin ? (
                        <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                            Match Admin Access
                          </p>

                          {entry.members.length >
                          0 ? (
                            entry.members.map(
                              (
                                member,
                              ) => {
                                const assignment =
                                  matchAdminAssignmentFor(
                                    member.user.id,
                                  );

                                const displayName =
                                  member.user.player
                                    ?.identity
                                    ?.inGameName ||
                                  member.user.fullName;

                                return (
                                  <div
                                    key={
                                      member.user.id
                                    }
                                    className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-black">
                                          {
                                            displayName
                                          }
                                        </p>

                                        {assignment ? (
                                          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-1 text-[9px] font-black text-emerald-300">
                                            MATCH ADMIN
                                          </span>
                                        ) : null}
                                      </div>

                                      <p className="mt-1 text-[10px] text-slate-600">
                                        {member.user.player
                                          ?.playerCode ||
                                          member.user.fullName}
                                      </p>
                                    </div>

                                    {assignment ? (
                                      <button
                                        type="button"
                                        disabled={
                                          busy
                                        }
                                        onClick={() =>
                                          void removeMatchAdmin(
                                            assignment.id,
                                          )
                                        }
                                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/25 bg-red-400/[0.04] px-3.5 text-xs font-semibold text-red-300 disabled:opacity-40"
                                      >
                                        Remove Match Admin
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          Boolean(
                                            currentMatchAdmin,
                                          )
                                        }
                                        onClick={() =>
                                          void assignMatchAdmin(
                                            member.user.id,
                                          )
                                        }
                                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-sky-400 px-3.5 text-xs font-black text-[#031019] disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        {currentMatchAdmin
                                          ? 'Remove Current Admin First'
                                          : 'Make Match Admin'}
                                      </button>
                                    )}
                                  </div>
                                );
                              },
                            )
                          ) : (
                            <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 text-xs leading-5 text-amber-300">
                              This team does not have a linked FC ARENA player account yet, so Match Admin access cannot be assigned from this entry.
                            </p>
                          )}
                        </div>
                      ) : null}


                      {tournament.isLeagueAdmin &&
                      canManageEntries ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              beginEdit(
                                entry,
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 px-3.5 text-xs font-semibold text-slate-500 transition hover:text-white disabled:opacity-40"
                          >
                            Edit Team
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void deleteTeam(
                                entry,
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/30 bg-red-400/[0.04] px-3.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                          >
                            Delete Team
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </FcPanel>
              ),
            )}
          </section>
        )}


        <FcPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">
            {entries.length} of {tournament.maxEntries} Tournament entry slots currently contain real team data.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
