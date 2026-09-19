'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  TournamentWizardShell,
  type TournamentWizardStep,
} from '@/components/tournaments/tournament-wizard-shell';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  groupId: string | null;
}


interface Group {
  id: string;
  name: string;
  position: number;
  entries: Entry[];
}


interface GroupData {
  tournament: {
    id: string;
    name: string;
    groupMode:
      string;
  };

  groups:
    Group[];

  unassigned:
    Entry[];
}


interface WizardData {
  currentStep:
    TournamentWizardStep;

  steps:
    TournamentWizardStep[];
}


const routeMap:
  Record<
    TournamentWizardStep,
    string
  > = {
    SETUP:
      'setup',

    TEAMS:
      'teams',

    GROUPS:
      'groups',

    FIXTURE_SETTINGS:
      'fixture-settings',

    FIXTURE_PREVIEW:
      'fixture-preview',

    QUALIFICATION:
      'qualification',

    REVIEW:
      'review',
  };


export default function GroupsWizardPage() {
  const params =
    useParams<{
      tournamentId:
        string;
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
    wizard,
    setWizard,
  ] =
    useState<WizardData | null>(
      null,
    );


  const [
    data,
    setData,
  ] =
    useState<GroupData | null>(
      null,
    );


  const [
    editingGroupId,
    setEditingGroupId,
  ] =
    useState<string | null>(
      null,
    );


  const [
    editingName,
    setEditingName,
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


  async function loadGroups() {
    const response =
      await authenticatedRequest<{
        success: true;

        data:
          GroupData;

        error: null;
      }>(
        `/tournaments/${tournamentId}/groups`,
      );

    setData(
      response.data,
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const wizardResponse =
          await authenticatedRequest<{
            success: true;

            data:
              WizardData;

            error: null;
          }>(
            `/tournaments/${tournamentId}/wizard`,
          );

        if (
          !wizardResponse
            .data
            .steps
            .includes(
              'GROUPS',
            )
        ) {
          router.replace(
            `/tournaments/${tournamentId}/wizard/fixture-settings`,
          );

          return;
        }

        setWizard(
          wizardResponse.data,
        );

        await loadGroups();
      } catch {
        router.replace(
          `/tournaments/${tournamentId}/wizard/teams`,
        );
      }
    }

    void load();
  }, [
    router,
    tournamentId,
  ]);


  async function createGroup(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formElement =
      event.currentTarget;

    const form =
      new FormData(
        formElement,
      );

    const name =
      String(
        form.get(
          'groupName',
        ) ?? '',
      ).trim();

    if (!name) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/groups`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              name,
            }),
        },
      );

      formElement.reset();

      setMessage(
        `${name} created.`,
      );

      await loadGroups();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create group.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function renameGroup(
    groupId:
      string,
  ) {
    if (
      !editingName.trim()
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/groups/${groupId}`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              name:
                editingName.trim(),
            }),
        },
      );

      setEditingGroupId(
        null,
      );

      setMessage(
        'Group renamed.',
      );

      await loadGroups();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to rename group.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function deleteGroup(
    group:
      Group,
  ) {
    const confirmed =
      window.confirm(
        `Delete ${group.name}? ${group.entries.length} team(s) inside it will become unassigned.`,
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/groups/${group.id}`,
        {
          method:
            'DELETE',
        },
      );

      setMessage(
        `${group.name} deleted.`,
      );

      await loadGroups();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete group.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function moveEntry(
    entryId:
      string,

    groupId:
      string,
  ) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (
        groupId ===
        'UNASSIGNED'
      ) {
        await authenticatedRequest(
          `/tournaments/${tournamentId}/registrations/${entryId}/group`,
          {
            method:
              'DELETE',
          },
        );
      } else {
        await authenticatedRequest(
          `/tournaments/${tournamentId}/registrations/${entryId}/group`,
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                groupId,
              }),
          },
        );
      }

      await loadGroups();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to move team.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function distribute(
    mode:
      'AUTO_DISTRIBUTE'
      | 'RANDOM_DRAW',
  ) {
    const label =
      mode ===
      'RANDOM_DRAW'
        ? 'randomly redraw all teams'
        : 'redistribute all teams evenly';

    if (
      !window.confirm(
        `This will ${label}. Continue?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message:
              string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/groups/distribute`,
          {
            method:
              'POST',

            body:
              JSON.stringify({
                mode,
              }),
          },
        );

      setMessage(
        response
          .data
          .message,
      );

      await loadGroups();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to distribute teams.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function continueWizard() {
    if (
      !wizard ||
      !data
    ) {
      return;
    }

    if (
      data.groups.length <
      2
    ) {
      setError(
        'Create at least two groups before continuing.',
      );

      return;
    }

    if (
      data.unassigned.length >
      0
    ) {
      setError(
        `Assign all teams before continuing. ${data.unassigned.length} team(s) are still unassigned.`,
      );

      return;
    }

    if (
      data.groups.some(
        (group) =>
          group.entries.length <
          2,
      )
    ) {
      setError(
        'Every group must contain at least two teams.',
      );

      return;
    }

    const index =
      wizard.steps.indexOf(
        'GROUPS',
      );

    const next =
      wizard.steps[
        index +
        1
      ];

    if (!next) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard-step`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              step:
                next,
            }),
        },
      );

      router.push(
        `/tournaments/${tournamentId}/wizard/${routeMap[next]}`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to continue.',
      );
    } finally {
      setBusy(false);
    }
  }


  if (
    !user ||
    !wizard ||
    !data
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Groups...
      </div>
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

      <TournamentWizardShell
        tournamentId={
          tournamentId
        }
        currentStep="GROUPS"
        steps={
          wizard.steps
        }
        title="Group Management"
        description="Create groups and decide exactly where every team belongs."
      >

        {message ? (
          <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}


        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}


        <div className="flex flex-wrap items-end justify-between gap-4">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
              Tournament Groups
            </p>

            <h2 className="mt-1 text-3xl font-black">
              {
                data.groups.length
              } Groups
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {
                data.unassigned.length
              } team(s) unassigned
            </p>
          </div>


          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              disabled={
                busy ||
                data.groups.length <
                  2
              }
              onClick={() =>
                void distribute(
                  'AUTO_DISTRIBUTE',
                )
              }
              className="rounded-xl border border-emerald-400/20 px-4 py-3 text-sm font-black text-emerald-300 disabled:opacity-40"
            >
              Auto Distribute
            </button>


            <button
              type="button"
              disabled={
                busy ||
                data.groups.length <
                  2
              }
              onClick={() =>
                void distribute(
                  'RANDOM_DRAW',
                )
              }
              className="rounded-xl border border-amber-400/20 px-4 py-3 text-sm font-black text-amber-300 disabled:opacity-40"
            >
              Random Draw
            </button>

          </div>

        </div>


        <form
          onSubmit={
            createGroup
          }
          className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 sm:flex-row"
        >

          <input
            name="groupName"
            required
            maxLength={
              40
            }
            placeholder="Example: North Zone"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
          />

          <button
            type="submit"
            disabled={
              busy ||
              data.groups.length >=
                16
            }
            className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-40"
          >
            + Add Group
          </button>

        </form>


        {data.unassigned.length >
        0 ? (
          <section className="mt-7 rounded-[22px] border border-amber-400/20 bg-amber-400/[0.03] p-5">

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                Unassigned Teams
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Manually choose a group for each team or use Auto Distribute / Random Draw.
              </p>
            </div>


            <div className="mt-4 space-y-3">

              {data.unassigned.map(
                (
                  entry,
                ) => (
                  <div
                    key={
                      entry.id
                    }
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                  >

                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-white/[0.04]">

                      {entry.entryLogoUrl ? (
                        <img
                          src={
                            entry.entryLogoUrl
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-black text-slate-500">
                          {entry.entryName
                            ?.slice(
                              0,
                              2,
                            )
                            .toUpperCase() ??
                            'FC'}
                        </span>
                      )}

                    </div>


                    <p className="min-w-0 flex-1 truncate font-black">
                      {
                        entry.entryName ??
                        'Unnamed Team'
                      }
                    </p>


                    <select
                      defaultValue="UNASSIGNED"
                      disabled={
                        busy
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          void moveEntry(
                            entry.id,
                            event
                              .target
                              .value,
                          )
                      }
                      className="rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
                    >
                      <option value="UNASSIGNED">
                        Select Group
                      </option>

                      {data.groups.map(
                        (
                          group,
                        ) => (
                          <option
                            key={
                              group.id
                            }
                            value={
                              group.id
                            }
                          >
                            {
                              group.name
                            }
                          </option>
                        ),
                      )}

                    </select>

                  </div>
                ),
              )}

            </div>

          </section>
        ) : null}


        <div className="mt-7 grid gap-5 xl:grid-cols-2">

          {data.groups.map(
            (
              group,
            ) => (
              <section
                key={
                  group.id
                }
                className="overflow-hidden rounded-[24px] border border-white/10 bg-black/10"
              >

                <header className="border-b border-white/10 p-5">

                  {editingGroupId ===
                  group.id ? (

                    <div className="flex gap-2">

                      <input
                        value={
                          editingName
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setEditingName(
                              event
                                .target
                                .value,
                            )
                        }
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080e15] px-4 py-2"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          void renameGroup(
                            group.id,
                          )
                        }
                        className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-black"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingGroupId(
                            null,
                          )
                        }
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>

                    </div>

                  ) : (

                    <div className="flex items-center justify-between gap-3">

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-sky-400">
                          Group {
                            group.position
                          }
                        </p>

                        <h3 className="mt-1 text-2xl font-black">
                          {
                            group.name
                          }
                        </h3>

                        <p className="mt-1 text-xs text-slate-600">
                          {
                            group.entries.length
                          } team(s)
                        </p>
                      </div>


                      <div className="flex gap-2">

                        <button
                          type="button"
                          onClick={() => {
                            setEditingGroupId(
                              group.id,
                            );

                            setEditingName(
                              group.name,
                            );
                          }}
                          className="rounded-xl border border-sky-400/20 px-3 py-2 text-xs font-black text-sky-300"
                        >
                          Rename
                        </button>


                        <button
                          type="button"
                          disabled={
                            data.groups.length <=
                            2
                          }
                          onClick={() =>
                            void deleteGroup(
                              group,
                            )
                          }
                          className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-30"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  )}

                </header>


                <div className="space-y-2 p-4">

                  {group.entries.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
                      No teams in this group.
                    </div>
                  ) : (
                    group.entries.map(
                      (
                        entry,
                      ) => (
                        <div
                          key={
                            entry.id
                          }
                          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-3"
                        >

                          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white/[0.04]">

                            {entry.entryLogoUrl ? (
                              <img
                                src={
                                  entry.entryLogoUrl
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-black text-slate-500">
                                {entry.entryName
                                  ?.slice(
                                    0,
                                    2,
                                  )
                                  .toUpperCase() ??
                                  'FC'}
                              </span>
                            )}

                          </div>


                          <p className="min-w-0 flex-1 truncate font-black">
                            {
                              entry.entryName ??
                              'Unnamed Team'
                            }
                          </p>


                          <select
                            value={
                              entry.groupId ??
                              'UNASSIGNED'
                            }
                            disabled={
                              busy
                            }
                            onChange={
                              (
                                event,
                              ) =>
                                void moveEntry(
                                  entry.id,
                                  event
                                    .target
                                    .value,
                                )
                            }
                            className="max-w-[160px] rounded-xl border border-white/10 bg-[#080e15] px-2 py-2 text-xs"
                          >

                            <option value="UNASSIGNED">
                              Unassign
                            </option>

                            {data.groups.map(
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
                      ),
                    )
                  )}

                </div>

              </section>
            ),
          )}

        </div>


        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">

          <button
            type="button"
            onClick={() =>
              router.push(
                `/tournaments/${tournamentId}/wizard/teams`,
              )
            }
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-400"
          >
            ← Back
          </button>


          <button
            type="button"
            disabled={
              busy ||
              data.groups.length <
                2 ||
              data.unassigned.length >
                0
            }
            onClick={() =>
              void continueWizard()
            }
            className="rounded-xl bg-sky-400 px-6 py-3 text-sm font-black text-[#041019] disabled:opacity-40"
          >
            Next →
          </button>

        </div>

      </TournamentWizardShell>

    </AppShell>
  );
}