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
  mode: string;
  status: string;
  registrationMode: string;
  teamSize: number;
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


  async function openPlayerRegistration() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/open-registration`,
        {
          method:
            'POST',
        },
      );

      router.push(
        `/tournaments/${tournamentId}/registration`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to open player registration.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function continueWizard() {
    if (!wizard) {
      return;
    }

    if (
      tournament?.status ===
      'REGISTRATION_OPEN'
    ) {
      setError(
        'Close player registration before continuing Tournament setup.',
      );

      return;
    }

    const pendingCount =
      entries.filter(
        (entry) =>
          entry.status ===
          'PENDING',
      ).length;

    if (
      pendingCount >
      0
    ) {
      setError(
        `Review the ${pendingCount} pending registration(s) before continuing.`,
      );

      return;
    }

    const approvedCount =
      entries.filter(
        (entry) =>
          entry.status ===
          'APPROVED',
      ).length;

    if (
      approvedCount <
      2
    ) {
      setError(
        'At least 2 approved entries are required before continuing.',
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


  const approvedEntries =
    entries.filter(
      (entry) =>
        entry.status ===
        'APPROVED',
    );

  const pendingEntries =
    entries.filter(
      (entry) =>
        entry.status ===
        'PENDING',
    );

  const selfRegistrationEnabled =
    tournament.registrationMode !==
    'ADMIN_ONLY';

  const registrationOpen =
    tournament.status ===
    'REGISTRATION_OPEN';


  const participantManagementOpen =
    [
      'DRAFT',
      'REGISTRATION_OPEN',
      'REGISTRATION_CLOSED',
    ].includes(
      tournament.status,
    ) &&
    entries.every(
      (entry) =>
        entry.fixtureCount ===
        0,
    );


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
        title="Registration & Participants"
        description="Let League players register themselves. Approved entries automatically become Tournament participants."
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


        <section className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Recommended Flow
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Player Self-Registration
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                League players join this Tournament from their own account, submit their Game Name and Team Name, and wait for admin approval. You do not need to create every participant manually.
              </p>
            </div>


            <div className="flex flex-wrap gap-2">
              {selfRegistrationEnabled &&
              tournament.status ===
                'DRAFT' ? (
                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    void openPlayerRegistration()
                  }
                  className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019] disabled:opacity-40"
                >
                  {busy
                    ? 'Opening...'
                    : 'Open Player Registration'}
                </button>
              ) : null}


              {registrationOpen ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/tournaments/${tournamentId}/registration`,
                    )
                  }
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-[#03150f]"
                >
                  Manage Registrations
                </button>
              ) : null}


              {tournament.status ===
              'REGISTRATION_CLOSED' ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/tournaments/${tournamentId}/registration`,
                    )
                  }
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300"
                >
                  Review Registrations
                </button>
              ) : null}
            </div>
          </div>


          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Approved
              </p>

              <p className="mt-2 text-3xl font-black text-emerald-300">
                {approvedEntries.length}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Pending
              </p>

              <p className="mt-2 text-3xl font-black text-amber-300">
                {pendingEntries.length}
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Entry Limit
              </p>

              <p className="mt-2 text-3xl font-black">
                {tournament.maxEntries}
              </p>
            </div>
          </div>


          {registrationOpen ? (
            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm leading-6 text-emerald-300">
              Registration is live. League players can now open this Tournament and submit their entry. Approve or reject them from the Registration page, then close registration before generating fixtures.
            </div>
          ) : tournament.status ===
              'REGISTRATION_CLOSED' ? (
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-300">
              Registration is closed. Resolve all pending applications, then continue with approved participants only.
            </div>
          ) : selfRegistrationEnabled ? (
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/10 p-4 text-sm leading-6 text-slate-500">
              Click <span className="font-black text-slate-300">Open Player Registration</span>. Players will register themselves; this page will then use the approved list automatically.
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-300">
              This Tournament is configured as Admin Only. Use the manual entry tools below or change Registration Mode in Setup.
            </div>
          )}
        </section>


        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                Tournament Participants
              </p>

              <p className="mt-2 text-4xl font-black">
                {approvedEntries.length}
                <span className="text-xl text-slate-600">
                  {' '}/ {
                    tournament.maxEntries
                  }
                </span>
              </p>
            </div>

            {pendingEntries.length >
            0 ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/tournaments/${tournamentId}/registration`,
                  )
                }
                className="rounded-xl border border-amber-400/25 px-4 py-3 text-sm font-black text-amber-300"
              >
                Review {pendingEntries.length} Pending
              </button>
            ) : null}
          </div>


          <div className="mt-5 space-y-3">
            {entries.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <p className="font-black text-slate-300">
                  No registrations yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Open player registration and let League members submit their own Tournament entry.
                </p>
              </div>
            ) : (
              entries.map(
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
                      entry.id &&
                    participantManagementOpen ? (
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
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          {entry.entryLogoUrl ? (
                            <img
                              src={
                                entry.entryLogoUrl
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-black text-slate-600">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-black">
                              {entry.entryName ??
                                'Unnamed Entry'}
                            </p>

                            <span
                              className={
                                'rounded-lg border px-2 py-1 text-[10px] font-black ' +
                                (entry.status ===
                                'APPROVED'
                                  ? 'border-emerald-400/20 text-emerald-300'
                                  : 'border-amber-400/20 text-amber-300')
                              }
                            >
                              {entry.status}
                            </span>
                          </div>

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


                        {participantManagementOpen ? (
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
                        ) : null}
                      </div>
                    )}
                  </article>
                ),
              )
            )}
          </div>
        </section>


        {participantManagementOpen ? (
          <details
            open={
              tournament.registrationMode ===
              'ADMIN_ONLY'
            }
            className="mt-7 rounded-2xl border border-white/10"
          >
            <summary className="cursor-pointer list-none p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                Admin Manual Entry — Optional
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Use this only when you want to add entries yourself. Manual participant management stays available until fixtures are generated.
              </p>
            </summary>


            <div className="border-t border-white/10 p-5">
              <form
                onSubmit={
                  addTeam
                }
                className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
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


              <div className="mt-6 rounded-2xl border border-white/10 p-5">
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
                  rows={5}
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
              </div>
            </div>
          </details>
        ) : null}


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
              registrationOpen ||
              pendingEntries.length >
                0 ||
              approvedEntries.length <
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