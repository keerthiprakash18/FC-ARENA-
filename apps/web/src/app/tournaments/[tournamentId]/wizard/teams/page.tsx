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
  ChangeEvent,
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


interface Tournament {
  id: string;
  name: string;
  maxEntries: number;
}


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  sortOrder: number;
  status: string;
  fixtureCount: number;
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


export default function TeamsWizardPage() {
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
    tournament,
    setTournament,
  ] =
    useState<Tournament | null>(
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
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
      [],
    );


  const [
    bulkText,
    setBulkText,
  ] =
    useState('');


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
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          entries:
            Entry[];
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}/entries`,
      );

    setEntries(
      response
        .data
        .entries,
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

        const [
          tournamentResponse,
          wizardResponse,
        ] =
          await Promise.all([
            authenticatedRequest<{
              success: true;

              data: {
                tournament:
                  Tournament;
              };

              error: null;
            }>(
              `/tournaments/${tournamentId}`,
            ),

            authenticatedRequest<{
              success: true;

              data:
                WizardData;

              error: null;
            }>(
              `/tournaments/${tournamentId}/wizard`,
            ),
          ]);

        setTournament(
          tournamentResponse
            .data
            .tournament,
        );

        setWizard(
          wizardResponse.data,
        );

        await loadEntries();
      } catch {
        router.replace(
          '/tournaments',
        );
      }
    }

    void load();
  }, [
    router,
    tournamentId,
  ]);


  async function addTeam(
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

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const name =
        String(
          form.get(
            'entryName',
          ) ?? '',
        );

      const logo =
        String(
          form.get(
            'entryLogoUrl',
          ) ?? '',
        );

      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              entryName:
                name,

              ...(logo
                ? {
                    entryLogoUrl:
                      logo,
                  }
                : {}),
            }),
        },
      );

      formElement.reset();

      setMessage(
        'Team added successfully.',
      );

      await loadEntries();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add team.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function bulkAdd() {
    const names =
      bulkText
        .split(
          /\r?\n/,
        )
        .map(
          (line) =>
            line.trim(),
        )
        .filter(Boolean);

    if (
      names.length ===
      0
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/bulk`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              names,
            }),
        },
      );

      setBulkText('');

      setMessage(
        `${names.length} team(s) added.`,
      );

      await loadEntries();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Bulk add failed.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function importFile(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const text =
      await file.text();

    const names =
      text
        .split(
          /\r?\n/,
        )
        .map(
          (line) =>
            line
              .split(',')[0]
              ?.trim() ??
            '',
        )
        .filter(Boolean);

    setBulkText(
      names.join(
        '\n',
      ),
    );

    event.target.value =
      '';
  }


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
  }


  async function saveEdit(
    entryId: string,
  ) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/${entryId}`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              entryName:
                editName,

              ...(editLogo
                ? {
                    entryLogoUrl:
                      editLogo,
                  }
                : {}),
            }),
        },
      );

      setEditingId(
        null,
      );

      setMessage(
        'Team updated.',
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
      setBusy(false);
    }
  }


  async function deleteTeam(
    entry: Entry,
  ) {
    const confirmed =
      window.confirm(
        entry.fixtureCount >
        0
          ? `Delete ${entry.entryName ?? 'this team'}? It already has ${entry.fixtureCount} fixture(s).`
          : `Delete ${entry.entryName ?? 'this team'}?`,
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/${entry.id}`,
        {
          method:
            'DELETE',
        },
      );

      setMessage(
        'Team deleted.',
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
      setBusy(false);
    }
  }


  async function move(
    index: number,
    direction:
      -1 | 1,
  ) {
    const target =
      index +
      direction;

    if (
      target < 0 ||
      target >=
        entries.length
    ) {
      return;
    }

    const reordered =
      [...entries];

    [
      reordered[index],
      reordered[target],
    ] = [
      reordered[target],
      reordered[index],
    ];

    setEntries(
      reordered,
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/entries/reorder`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              registrationIds:
                reordered.map(
                  (entry) =>
                    entry.id,
                ),
            }),
        },
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reorder teams.',
      );

      await loadEntries();
    }
  }


  async function continueWizard() {
    if (!wizard) {
      return;
    }

    if (
      entries.length <
      2
    ) {
      setError(
        'Add at least 2 teams before continuing.',
      );

      return;
    }

    const index =
      wizard.steps.indexOf(
        'TEAMS',
      );

    const next =
      wizard.steps[
        index + 1
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
    !tournament ||
    !wizard
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Teams...
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
        currentStep="TEAMS"
        steps={
          wizard.steps
        }
        title="Team Management"
        description="Add, edit, delete and reorder the Tournament teams."
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
              Teams Added
            </p>

            <p className="mt-2 text-4xl font-black">
              {entries.length}
              <span className="text-xl text-slate-600">
                {' '}/ {
                  tournament.maxEntries
                }
              </span>
            </p>
          </div>

        </div>


        <form
          onSubmit={
            addTeam
          }
          className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-black/10 p-5 md:grid-cols-[1fr_1fr_auto]"
        >

          <div className="field">
            <label>
              Team Name
            </label>

            <input
              name="entryName"
              required
              placeholder="Manchester City"
            />
          </div>


          <div className="field">
            <label>
              Logo URL — optional
            </label>

            <input
              name="entryLogoUrl"
              type="url"
              placeholder="https://..."
            />
          </div>


          <button
            type="submit"
            disabled={
              busy ||
              entries.length >=
                tournament.maxEntries
            }
            className="self-end rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-40"
          >
            Add Team
          </button>

        </form>


        <section className="mt-6 rounded-2xl border border-white/10 p-5">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                Bulk Add / Import
              </p>

              <p className="mt-1 text-sm text-slate-500">
                One team per line. TXT and CSV import supported.
              </p>
            </div>


            <label className="cursor-pointer rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300">
              Import File

              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={
                  importFile
                }
                className="hidden"
              />
            </label>

          </div>


          <textarea
            value={
              bulkText
            }
            onChange={
              (
                event,
              ) =>
                setBulkText(
                  event
                    .target
                    .value,
                )
            }
            rows={6}
            placeholder={`Team One
Team Two
Team Three`}
            className="mt-4 w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 outline-none"
          />


          <button
            type="button"
            disabled={
              busy ||
              !bulkText.trim()
            }
            onClick={() =>
              void bulkAdd()
            }
            className="mt-3 rounded-xl border border-sky-400/30 px-5 py-3 text-sm font-black text-sky-300 disabled:opacity-40"
          >
            Add All Teams
          </button>

        </section>


        <section className="mt-7">

          {entries.length ===
          0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-500">
              No teams added yet.
            </div>
          ) : (
            <div className="space-y-3">

              {entries.map(
                (
                  entry,
                  index,
                ) => (

                  <article
                    key={
                      entry.id
                    }
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >

                    {editingId ===
                    entry.id ? (

                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">

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
                          className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
                        />

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
                          placeholder="Logo URL"
                          className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
                        />

                        <div className="flex gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              void saveEdit(
                                entry.id,
                              )
                            }
                            className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingId(
                                null,
                              )
                            }
                            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
                          >
                            Cancel
                          </button>

                        </div>

                      </div>

                    ) : (

                      <div className="flex flex-wrap items-center gap-4">

                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">

                          {entry.entryLogoUrl ? (
                            <img
                              src={
                                entry.entryLogoUrl
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-black text-slate-600">
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


                        <div className="min-w-0 flex-1">

                          <p className="truncate text-lg font-black">
                            {entry.entryName ??
                              'Unnamed Team'}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Position {
                              index +
                              1
                            }
                            {' · '}
                            {
                              entry.fixtureCount
                            } fixture(s)
                          </p>

                        </div>


                        <div className="flex flex-wrap gap-2">

                          <button
                            type="button"
                            disabled={
                              index ===
                              0
                            }
                            onClick={() =>
                              void move(
                                index,
                                -1,
                              )
                            }
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            disabled={
                              index ===
                              entries.length -
                                1
                            }
                            onClick={() =>
                              void move(
                                index,
                                1,
                              )
                            }
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              beginEdit(
                                entry,
                              )
                            }
                            className="rounded-xl border border-sky-400/20 px-4 py-2 text-sm font-black text-sky-300"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteTeam(
                                entry,
                              )
                            }
                            className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300"
                          >
                            Delete
                          </button>

                        </div>

                      </div>

                    )}

                  </article>
                ),
              )}

            </div>
          )}

        </section>


        <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">

          <button
            type="button"
            onClick={() =>
              router.push(
                `/tournaments/${tournamentId}/wizard/setup`,
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
              entries.length <
                2
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