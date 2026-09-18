'use client';

import Link from 'next/link';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import { AppShell } from '@/components/app/app-shell';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface Tournament {
  id: string;
  name: string;
  code: string;
  status: string;
  approvedEntries: number;
  maxEntries: number;
  fixturesGeneratedAt: string | null;
  isLeagueAdmin: boolean;

  league: {
    id: string;
    name: string;
  };
}

interface GroupMember {
  id: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;
}

interface GroupEntry {
  id: string;
  entryName: string | null;
  groupId: string | null;
  members: GroupMember[];
}

interface TournamentGroup {
  id: string;
  name: string;
  position: number;
  entries: GroupEntry[];
}

interface GroupsResponse {
  tournament: {
    id: string;
    name: string;
  };

  groups: TournamentGroup[];
  unassigned: GroupEntry[];
}

function getEntryName(
  entry: GroupEntry,
) {
  if (entry.entryName) {
    return entry.entryName;
  }

  const firstMember =
    entry.members[0];

  return (
    firstMember?.inGameName ||
    firstMember?.fullName ||
    'Tournament Entry'
  );
}

function getEntrySubtitle(
  entry: GroupEntry,
) {
  if (
    entry.members.length === 0
  ) {
    return 'No player information';
  }

  return entry.members
    .map(
      (member) =>
        member.inGameName ||
        member.fullName,
    )
    .join(' ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ');
}

export default function TournamentGroupsPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

  const router =
    useRouter();

  const tournamentId =
    params.tournamentId;

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
    groups,
    setGroups,
  ] =
    useState<TournamentGroup[]>(
      [],
    );

  const [
    unassigned,
    setUnassigned,
  ] =
    useState<GroupEntry[]>(
      [],
    );

  const [
    groupNames,
    setGroupNames,
  ] =
    useState<string[]>([
      'Group A',
      'Group B',
    ]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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

  async function loadGroups(
    syncNames = false,
  ) {
    const response =
      await authenticatedRequest<{
        success: true;
        data: GroupsResponse;
        error: null;
      }>(
        `/tournaments/${tournamentId}/groups`,
      );

    setGroups(
      response.data.groups,
    );

    setUnassigned(
      response.data.unassigned,
    );

    if (
      syncNames &&
      response.data.groups.length > 0
    ) {
      setGroupNames(
        response.data.groups.map(
          (group) => group.name,
        ),
      );
    }

    return response.data;
  }

  useEffect(() => {
    async function load() {
      try {
        const currentUser =
          await getCurrentUser();

        setUser(
          currentUser,
        );

        const tournamentResponse =
          await authenticatedRequest<{
            success: true;

            data: {
              tournament:
                Tournament;
            };

            error: null;
          }>(
            `/tournaments/${tournamentId}`,
          );

        setTournament(
          tournamentResponse
            .data
            .tournament,
        );

        await loadGroups(
          true,
        );
      } catch {
        router.replace(
          '/tournaments',
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
    tournamentId,
  ]);

  function updateGroupName(
    index: number,
    value: string,
  ) {
    setGroupNames(
      (current) =>
        current.map(
          (
            name,
            currentIndex,
          ) =>
            currentIndex ===
            index
              ? value
              : name,
        ),
    );
  }

  function addGroup() {
    const nextPosition =
      groupNames.length;

    const alphabet =
      String.fromCharCode(
        65 +
          Math.min(
            nextPosition,
            25,
          ),
      );

    setGroupNames(
      (current) => [
        ...current,
        `Group ${alphabet}`,
      ],
    );
  }

  function removeGroup(
    index: number,
  ) {
    if (
      groupNames.length <= 2
    ) {
      setError(
        'A grouped tournament must contain at least two groups.',
      );

      return;
    }

    setError('');

    setGroupNames(
      (current) =>
        current.filter(
          (_, currentIndex) =>
            currentIndex !==
            index,
        ),
    );
  }

  async function saveGroups() {
    const names =
      groupNames
        .map(
          (name) =>
            name.trim(),
        )
        .filter(Boolean);

    if (
      names.length < 2
    ) {
      setError(
        'Create at least two groups.',
      );

      return;
    }

    const normalized =
      names.map(
        (name) =>
          name.toLocaleLowerCase(),
      );

    if (
      new Set(
        normalized,
      ).size !==
      normalized.length
    ) {
      setError(
        'Group names must be unique.',
      );

      return;
    }

    if (
      groups.length > 0
    ) {
      const confirmed =
        window.confirm(
          'Saving group structure again will return every team to Unassigned. Continue?',
        );

      if (!confirmed) {
        return;
      }
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/groups/setup`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                groupNames:
                  names,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadGroups(
        true,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to configure groups.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function assignEntry(
    registrationId: string,
    groupId: string,
  ) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/group`,
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                groupId,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadGroups();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to move entry.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function unassignEntry(
    registrationId: string,
  ) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/group`,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadGroups();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to unassign entry.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeGroup(
    entry:
      GroupEntry,
    value:
      string,
  ) {
    if (!value) {
      await unassignEntry(
        entry.id,
      );

      return;
    }

    await assignEntry(
      entry.id,
      value,
    );
  }

  async function generateGroupFixtures() {
    const confirmed =
      window.confirm(
        'Generate group-stage fixtures now? Group assignments will be locked after generation.',
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
            participants: number;
            fixtures: number;

            groups: Array<{
              id: string;
              name: string;
              entries: number;
              fixtures: number;
              matchesPerEntry: number;
            }>;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/fixtures/generate-groups`,
          {
            method: 'POST',
          },
        );

      setMessage(
        `${response.data.message} ${response.data.fixtures} total fixtures created.`,
      );

      router.push(
        `/tournaments/${tournamentId}/fixtures`,
        {
          scroll: true,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate group fixtures.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    loading ||
    !user ||
    !tournament
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-bold text-slate-500">
        Loading Group Manager...
      </div>
    );
  }

  const locked =
    Boolean(
      tournament
        .fixturesGeneratedAt,
    );

  const registrationClosed =
    tournament.status ===
    'REGISTRATION_CLOSED';

  const canManage =
    tournament.isLeagueAdmin &&
    !locked &&
    registrationClosed;

  const groupCounts =
    groups.map(
      (group) =>
        group.entries.length,
    );

  const minimumGroupSize =
    groupCounts.length
      ? Math.min(
          ...groupCounts,
        )
      : 0;

  const maximumGroupSize =
    groupCounts.length
      ? Math.max(
          ...groupCounts,
        )
      : 0;

  const balanced =
    groupCounts.length >= 2 &&
    maximumGroupSize -
      minimumGroupSize <=
      1;

  const everyGroupPlayable =
    groups.length >= 2 &&
    groups.every(
      (group) =>
        group.entries.length >=
        2,
    );

  const readyForFixtures =
    groups.length >= 2 &&
    unassigned.length ===
      0 &&
    everyGroupPlayable;

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <Link
          href={`/tournaments/${tournamentId}`}
          scroll
          className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-white"
        >
          ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Tournament
        </Link>

        <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1018] p-6 md:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-sky-400/10" />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
              Tournament Administration
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-5xl">
              Group Manager
            </h1>

            <p className="mt-3 text-lg font-black text-white">
              {
                tournament.name
              }
            </p>

            <p className="mt-1 font-mono text-xs text-slate-600">
              {
                tournament.code
              }
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-400">
                Approved{' '}
                {
                  tournament.approvedEntries
                }
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-400">
                Groups{' '}
                {
                  groups.length
                }
              </span>

              <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs font-black text-amber-300">
                Unassigned{' '}
                {
                  unassigned.length
                }
              </span>

              {readyForFixtures ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs font-black text-emerald-300">
                  Ready for Fixtures
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {!registrationClosed &&
        !locked ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-200">
            Close tournament
            registration before
            finalising the group
            draw.
          </div>
        ) : null}

        {locked ? (
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] p-4 text-sm leading-6 text-sky-200">
            Fixtures have already
            been generated.
            Tournament groups are
            now locked and can only
            be viewed.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {tournament.isLeagueAdmin &&
        !locked ? (
          <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                  Group Structure
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Customise Groups
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Admin can choose
                  the number of
                  groups and rename
                  every group.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  busy ||
                  groupNames.length >=
                    16
                }
                onClick={
                  addGroup
                }
                className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3 text-sm font-black text-sky-300 disabled:opacity-40"
              >
                + Add Group
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupNames.map(
                (
                  name,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sm font-black text-sky-400">
                        {
                          index +
                          1
                        }
                      </div>

                      <input
                        value={
                          name
                        }
                        disabled={
                          !canManage
                        }
                        onChange={(
                          event,
                        ) =>
                          updateGroupName(
                            index,
                            event
                              .target
                              .value,
                          )
                        }
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080e15] px-3 py-3 font-black outline-none focus:border-sky-400/50 disabled:opacity-50"
                      />

                      {groupNames.length >
                      2 ? (
                        <button
                          type="button"
                          disabled={
                            !canManage
                          }
                          onClick={() =>
                            removeGroup(
                              index,
                            )
                          }
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-400/20 text-red-300 disabled:opacity-30"
                          aria-label="Remove group"
                        >
                          ÃƒÆ’Ã¢â‚¬â€
                        </button>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !canManage
              }
              onClick={() =>
                void saveGroups()
              }
              className="mt-5 w-full rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-40 md:w-auto"
            >
              {busy
                ? 'Saving...'
                : groups.length >
                    0
                  ? 'Save Group Structure'
                  : 'Create Groups'}
            </button>
          </section>
        ) : null}

        {groups.length > 0 ? (
          <>
            <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                    Player Pool
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Unassigned Entries
                  </h2>
                </div>

                <span className="text-sm font-black text-slate-500">
                  {
                    unassigned.length
                  }{' '}
                  remaining
                </span>
              </div>

              {unassigned.length ===
              0 ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6 text-center">
                  <p className="font-black text-emerald-300">
                    Every approved
                    entry has been
                    assigned.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {unassigned.map(
                    (
                      entry,
                    ) => (
                      <article
                        key={
                          entry.id
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <p className="font-black">
                          {
                            getEntryName(
                              entry,
                            )
                          }
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-600">
                          {
                            getEntrySubtitle(
                              entry,
                            )
                          }
                        </p>

                        {canManage ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {groups.map(
                              (
                                group,
                              ) => (
                                <button
                                  key={
                                    group.id
                                  }
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void assignEntry(
                                      entry.id,
                                      group.id,
                                    )
                                  }
                                  className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2 text-xs font-black text-sky-300 disabled:opacity-40"
                                >
                                  ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢{' '}
                                  {
                                    group.name
                                  }
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>

            <section>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                    Manual Draw
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Tournament Groups
                  </h2>
                </div>

                {groups.length >=
                2 ? (
                  <p
                    className={`text-sm font-black ${
                      balanced
                        ? 'text-emerald-300'
                        : 'text-amber-300'
                    }`}
                  >
                    {balanced
                      ? 'Balanced groups'
                      : 'Manual groups are uneven'}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                {groups.map(
                  (
                    group,
                  ) => (
                    <article
                      key={
                        group.id
                      }
                      className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1018]"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                            Group
                          </p>

                          <h3 className="mt-1 text-2xl font-black">
                            {
                              group.name
                            }
                          </h3>
                        </div>

                        <div className="grid h-12 min-w-12 place-items-center rounded-2xl bg-sky-400/10 px-3 font-black text-sky-400">
                          {
                            group
                              .entries
                              .length
                          }
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        {group.entries.map(
                          (
                            entry,
                            index,
                          ) => (
                            <div
                              key={
                                entry.id
                              }
                              className="rounded-2xl border border-white/10 bg-black/20 p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-xs font-black text-slate-500">
                                  {
                                    index +
                                    1
                                  }
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-black">
                                    {
                                      getEntryName(
                                        entry,
                                      )
                                    }
                                  </p>

                                  <p className="mt-1 truncate text-xs text-slate-600">
                                    {
                                      getEntrySubtitle(
                                        entry,
                                      )
                                    }
                                  </p>
                                </div>
                              </div>

                              {canManage ? (
                                <div className="mt-4">
                                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-600">
                                    Move
                                    Entry
                                  </label>

                                  <select
                                    value={
                                      group.id
                                    }
                                    disabled={
                                      busy
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      void changeGroup(
                                        entry,
                                        event
                                          .target
                                          .value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-white/10 bg-[#080e15] px-3 py-3 text-sm font-bold outline-none focus:border-sky-400/50 disabled:opacity-40"
                                  >
                                    <option value="">
                                      Unassigned
                                    </option>

                                    {groups.map(
                                      (
                                        destination,
                                      ) => (
                                        <option
                                          key={
                                            destination.id
                                          }
                                          value={
                                            destination.id
                                          }
                                        >
                                          {
                                            destination.name
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>
                              ) : null}
                            </div>
                          ),
                        )}

                        {group.entries
                          .length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
                            No entries
                            assigned.
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section
              className={`rounded-[26px] border p-6 ${
                readyForFixtures
                  ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                  : 'border-amber-400/20 bg-amber-400/[0.04]'
              }`}
            >
              <p
                className={`text-xs font-black uppercase tracking-[0.18em] ${
                  readyForFixtures
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }`}
              >
                Fixture Readiness
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {readyForFixtures
                  ? 'Group draw is ready.'
                  : 'Complete the group draw.'}
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {readyForFixtures
                  ? 'Every approved entry is assigned and every group contains enough entries for round-robin fixtures.'
                  : 'Assign every approved entry to a group. Each group must contain at least two entries before fixtures can be generated.'}
              </p>

              {readyForFixtures ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {groups.map(
                    (
                      group,
                    ) => {
                      const n =
                        group
                          .entries
                          .length;

                      const fixtureCount =
                        (n *
                          (n -
                            1)) /
                        2;

                      return (
                        <div
                          key={
                            group.id
                          }
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <p className="font-black">
                            {
                              group.name
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              n
                            }{' '}
                            entries
                          </p>

                          <p className="mt-3 text-xl font-black text-sky-400">
                            {
                              fixtureCount
                            }{' '}
                            fixtures
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            {
                              n -
                              1
                            }{' '}
                            matches
                            per entry
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : null}

              {readyForFixtures &&
              tournament
                .isLeagueAdmin ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] opacity-50"
                >
                  Generate Group
                  Fixtures ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Next
                  Stage
                </button>
              ) : null}
            </section>
          </>
        ) : (
          <section className="rounded-[26px] border border-dashed border-white/10 p-10 text-center">
            <p className="text-lg font-black text-slate-300">
              No group
              structure yet.
            </p>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Create Group A /
              Group B above, or
              customise your own
              group names.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}