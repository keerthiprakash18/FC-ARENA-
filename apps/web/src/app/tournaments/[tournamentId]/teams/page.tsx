'use client';
import { CompactTeamCard } from '@/components/tournaments/compact-team-card';
import { ReplaceTournamentPlayer } from '@/components/tournaments/replace-tournament-player';
import { TeamListExport } from '@/components/tournaments/team-list-export';
import { FootballTeamPicker } from '@/components/tournaments/football-team-picker';
import { useRouteLeague } from '@/lib/active-league';
import { normalizeTeamName } from '@/lib/entry-name';


import { confirmAction } from '@/components/fc/confirmation-provider';
import { FcNotice } from '@/components/fc/fc-ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import {
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
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';
import { TournamentEntryLimit, type EntryLimitTournament } from '@/components/tournaments/tournament-entry-limit';
import { TournamentFixtureStart } from '@/components/tournaments/tournament-fixture-start';

import {
  EntryLogoUpload,
} from '@/components/tournaments/entry-logo-upload';
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


interface Tournament extends EntryLimitTournament {
  leagueId?: string;
  id: string;
  name: string;
  status: string;
  maxEntries: number;
  isLeagueAdmin: boolean;
  canManageParticipants?: boolean;
  canManageAdmins?: boolean;
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


  const [teamSearch, setTeamSearch] = useState('');
  const filteredEntries = useMemo(() => {
    const query = teamSearch.trim().toLocaleLowerCase();
    return query ? entries.filter(entry => [entry.entryName, ...entry.members.flatMap(member => [member.user.fullName, member.user.player?.identity?.inGameName, member.user.player?.playerCode])].some(value => value?.toLocaleLowerCase().includes(query))) : entries;
  }, [entries, teamSearch]);
  const [roleError, setRoleError] = useState('');
  useRouteLeague(user?.id, tournament?.id === tournamentId ? tournament.leagueId : null);

  const initialLoad = useRecoverableLoad(async signal => {
    const [current, competition, teams] = await Promise.all([
      getCurrentUser({ signal }),
      authenticatedRequest<TournamentResponse>(`/tournaments/${tournamentId}`, { signal }),
      authenticatedRequest<EntriesResponse>(`/tournaments/${tournamentId}/entries`, { signal }),
    ]);
    if (signal.aborted) return;
    const next = competition.data.tournament;
    setUser(current); setTournament({ ...next, canManageParticipants: next.canManageParticipants ?? next.isLeagueAdmin });
    setEntries(teams.data.entries);
    if (next.canManageAdmins) {
      try { await loadMatchAdmins(); setRoleError(''); }
      catch { if (!signal.aborted) setRoleError('Match admin details could not load. Your team registrations are still available.'); }
    }
  }, tournamentId);

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
        ?.canManageAdmins
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
        ?.canManageAdmins
    ) {
      return;
    }

    if (!(await confirmAction({ title: 'Remove Match Admin access?', description: 'Remove this player’s Match Admin role for this tournament? They will lose the access granted by this role.', confirmLabel: 'Remove access', destructive: true }))) return;

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
        ?.canManageAdmins &&
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
    if (busy) return;
    if (entries.some((entry) => entry.id !== entryId && normalizeTeamName(entry.entryName ?? '') === normalizeTeamName(editName))) {
      setMessage('');
      setError(`“${editName.trim()}” already exists in this Tournament. Choose a different team name.`);
      return;
    }
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
      (await confirmAction(
        { title: 'Delete tournament team?', description: `Permanently remove “${entry.entryName ?? 'this team'}” from this tournament? This cannot be undone.`, confirmLabel: 'Delete team', destructive: true },
      ));

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


  if (initialLoad.error) return <AppShell currentUser={user ?? undefined}><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;

  if (
    !user ||
    !tournament || tournament.id !== tournamentId
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
      <div className="space-y-6" data-refresh-lock={busy ? 'true' : undefined}>
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Teams"
          subtitle="Tournament teams and players. Admins can replace an unavailable player in the same entry, including after fixtures are generated."
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
        <FcNotice tone="error">{roleError}</FcNotice>


        <TournamentFixtureStart tournament={{ ...tournament,
          approvedEntries: entries.filter(entry => entry.status === 'APPROVED').length,
          pendingEntries: entries.filter(entry => entry.status === 'PENDING').length }} />

        <TournamentEntryLimit tournament={{ ...tournament, approvedEntries: entries.filter(entry => entry.status === 'APPROVED').length }}
          onUpdated={maxEntries => setTournament(current => current ? { ...current, maxEntries } : current)} />

        {tournament.canManageParticipants ? (
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


        {tournament.canManageParticipants ? (
          <FcPanel className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Participant Management
                </p>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Add or remove entries before fixtures are generated. To replace an unavailable player, open their team card and choose Replace player. The same group, fixtures, scores and team points are kept.
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


        {tournament.canManageParticipants &&
        !canManageEntries ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-300">
            {totalFixtures >
            0
              ? 'Generated fixtures are protected. Use Replace player in a team card to change its player while keeping the existing schedule and results.'
              : 'Adding or removing entries is locked after the tournament starts. Player replacement remains available until the tournament is completed or cancelled.'}
          </div>
        ) : null}


        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>


        <TeamListExport tournamentId={tournamentId} approvedCount={entries.filter(entry => entry.status === 'APPROVED').length} />
        {entries.length > 0 ? <label className="grid gap-2 text-sm font-semibold">Find a team or player
          <input type="search" value={teamSearch} onChange={event => setTeamSearch(event.target.value)} placeholder="Team name, player name or ID" className="min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-4 text-sm" />
          <span className="text-xs font-normal text-slate-500" role="status">{filteredEntries.length} of {entries.length} teams · Open a card for players and actions</span>
        </label> : null}
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
          <section className="grid grid-cols-2 items-start gap-3 md:gap-4 xl:grid-cols-3" aria-label="Tournament teams">
            {!filteredEntries.length ? <p className="col-span-2 py-8 text-center text-sm text-slate-500">No teams match your search.</p> : null}
            {filteredEntries.map(
              (
                entry,
              ) => (
                <CompactTeamCard key={entry.id} name={entry.entryName || 'Unnamed Team'} logoUrl={entry.entryLogoUrl} status={entry.status} fixtureCount={entry.fixtureCount} memberCount={entry.members.length} editing={editingId === entry.id && canManageEntries}>
                  {editingId ===
                    entry.id &&
                  canManageEntries ? (
                    <div className="space-y-3">
                      <FootballTeamPicker tournamentId={tournamentId} excludeEntryId={entry.id} value={editName} onChange={setEditName} disabled={busy} />

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
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <p className="text-xs font-semibold text-slate-500">Registered players</p>
                        {entry.members.length ? entry.members.map(member => <Link key={member.user.id} href={`/discover/players/${member.user.id}`} className="block rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold break-words">
                          {member.user.player?.identity?.inGameName || member.user.fullName}<span className="mt-1 block text-xs font-normal text-slate-500">{member.user.player?.playerCode || 'FC Arena player'}</span>
                        </Link>) : <p className="text-xs text-slate-500">No linked players recorded.</p>}
                      </div>

                      {tournament.canManageParticipants && !['COMPLETED', 'CANCELLED'].includes(tournament.status) && ['APPROVED', 'PENDING'].includes(entry.status) && entry.members.length > 0 ? (
                        <ReplaceTournamentPlayer tournamentId={tournamentId} entry={entry} onReplaced={async notice => {
                          await loadEntries();
                          setMessage(notice);
                          setError('');
                          if (tournament.canManageAdmins) await loadMatchAdmins();
                        }} />
                      ) : null}

                      {tournament.canManageParticipants ? (
                        <div className="mt-4 border-t border-white/[0.06] pt-4">
                          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                            Team Logo
                          </p>

                          <EntryLogoUpload
                            tournamentId={
                              tournamentId
                            }
                            registrationId={
                              entry.id
                            }
                            entryName={
                              entry.entryName ||
                              'FC Team'
                            }
                            logoUrl={
                              entry.entryLogoUrl
                            }
                            compact
                            locked={
                              [
                                'COMPLETED',
                                'CANCELLED',
                              ].includes(
                                tournament.status,
                              )
                            }
                            onChanged={
                              async () => {
                                await loadEntries();
                              }
                            }
                          />
                        </div>
                      ) : null}


                      {tournament.canManageAdmins ? (
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


                      {tournament.canManageParticipants &&
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
                </CompactTeamCard>
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
