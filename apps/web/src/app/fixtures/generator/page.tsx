'use client';

import Link from 'next/link';
import {
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
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface Membership {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
  };
}


interface Tournament {
  id: string;
  name: string;
  code: string;
  status: string;
  groupMode?: string;
  competitionFormat?: string;
  approvedEntries: number;
  leagueName: string;
}


interface Entry {
  id: string;
  entryName: string | null;
}


interface Group {
  id: string;
  name: string;
  entries: Entry[];
}


interface PreviewFixture {
  id: string;
  roundName: string;
  roundNumber: number;
  matchday: number | null;

  homeRegistration: {
    entryName: string | null;
  } | null;

  awayRegistration: {
    entryName: string | null;
  } | null;
}


const steps = [
  'Select Tournament',
  'Review Teams',
  'Fixture Rules',
  'Preview',
  'Generate',
];


export default function FixtureGeneratorPage() {
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
    tournaments,
    setTournaments,
  ] =
    useState<Tournament[]>(
      [],
    );

  const [
    tournamentId,
    setTournamentId,
  ] =
    useState('');

  const [
    step,
    setStep,
  ] =
    useState(
      0,
    );

  const [
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
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
    settings,
    setSettings,
  ] =
    useState<any>(
      null,
    );

  const [
    preview,
    setPreview,
  ] =
    useState<PreviewFixture[]>(
      [],
    );

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
    message,
    setMessage,
  ] =
    useState('');


  useEffect(() => {
    void (async () => {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const leaguesResponse =
          await authenticatedRequest<any>(
            '/leagues/my',
          );

        const adminLeagues:
          Membership[] =
          leaguesResponse
            .data
            .leagues
            .filter(
              (
                membership:
                  Membership,
              ) =>
                Boolean(
                  membership.adminRole,
                ),
            );

        const groups =
          await Promise.all(
            adminLeagues.map(
              async (
                membership,
              ) => {
                const response =
                  await authenticatedRequest<any>(
                    `/leagues/${membership.league.id}/tournaments`,
                  );

                return (
                  response
                    .data
                    .tournaments as Omit<
                    Tournament,
                    'leagueName'
                  >[]
                )
                  .filter(
                    (
                      tournament,
                    ) =>
                      tournament.status ===
                      'DRAFT',
                  )
                  .map(
                    (
                      tournament,
                    ) => ({
                      ...tournament,
                      leagueName:
                        membership
                          .league
                          .name,
                    }),
                  );
              },
            ),
          );

        setTournaments(
          groups.flat(),
        );
      } catch {
        router.replace(
          '/fixtures',
        );
      }
    })();
  }, [
    router,
  ]);


  const selectedTournament =
    useMemo(
      () =>
        tournaments.find(
          (
            tournament,
          ) =>
            tournament.id ===
            tournamentId,
        ) ??
        null,
      [
        tournamentId,
        tournaments,
      ],
    );


  async function loadReview() {
    if (
      !tournamentId
    ) {
      return;
    }

    const [
      entriesResponse,
      groupsResponse,
      settingsResponse,
    ] =
      await Promise.all([
        authenticatedRequest<any>(
          `/tournaments/${tournamentId}/entries`,
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

        authenticatedRequest<any>(
          `/tournaments/${tournamentId}/wizard/fixture-settings`,
        ),
      ]);

    setEntries(
      entriesResponse
        .data
        .entries,
    );

    setGroups(
      groupsResponse
        .data
        .groups,
    );

    setSettings(
      settingsResponse.data,
    );
  }


  async function nextFromTournament() {
    if (
      !tournamentId
    ) {
      setError(
        'Select a Draft Tournament first.',
      );

      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await loadReview();

      setStep(
        1,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Tournament setup.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function saveRules() {
    if (
      !tournamentId ||
      !settings
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-settings`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              fixtureMode:
                settings.fixtureMode,

              legType:
                settings.legType,

              dailyMatchLimit:
                Number(
                  settings.dailyMatchLimit,
                ),

              matchesPerParticipantPerDay:
                Number(
                  settings.matchesPerParticipantPerDay,
                ),

              matchDurationMinutes:
                Number(
                  settings.matchDurationMinutes,
                ),
            }),
        },
      );

      setStep(
        3,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save fixture rules.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function generatePreview() {
    if (
      !tournamentId
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
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/wizard/fixture-preview/generate`,
          {
            method:
              'POST',
          },
        );

      const previewResponse =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/wizard/fixture-preview`,
        );

      setPreview(
        previewResponse
          .data
          .fixtures,
      );

      setMessage(
        response.data.message,
      );

      setStep(
        4,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate preview.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function publishFixtures() {
    if (
      !tournamentId
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-preview/publish`,
        {
          method:
            'POST',
        },
      );

      router.push(
        `/tournaments/${tournamentId}/fixtures`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to publish fixtures.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Fixture Generator..."
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
          backHref="/fixtures"
          backLabel="Fixtures"
          eyebrow="Admin Workflow"
          title="Fixture Generator"
          subtitle="A focused five-step workflow using the existing FC ARENA Tournament and fixture APIs."
        />


        <FcPanel className="overflow-x-auto p-3">
          <div className="flex min-w-max items-center gap-2">
            {steps.map(
              (
                label,
                index,
              ) => (
                <div
                  key={
                    label
                  }
                  className="flex items-center gap-2"
                >
                  <span
                    className={`rounded-xl border px-4 py-2 text-xs font-black ${
                      index ===
                      step
                        ? 'border-sky-400/30 bg-sky-400/[0.08] text-sky-300'
                        : index <
                            step
                          ? 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300'
                          : 'border-white/[0.07] text-slate-600'
                    }`}
                  >
                    {index +
                      1}
                    .{' '}
                    {
                      label
                    }
                  </span>

                  {index <
                  steps.length -
                    1 ? (
                    <span className="text-slate-700">
                      →
                    </span>
                  ) : null}
                </div>
              ),
            )}
          </div>
        </FcPanel>


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


        {step ===
        0 ? (
          <FcPanel className="p-5 sm:p-6">
            <h2 className="text-xl font-black">
              Select Draft Tournament
            </h2>

            <select
              value={
                tournamentId
              }
              onChange={
                (
                  event,
                ) =>
                  setTournamentId(
                    event
                      .target
                      .value,
                  )
              }
              className="mt-5 w-full rounded-xl border border-white/10 bg-[#07101a] px-4 py-3"
            >
              <option value="">
                Choose Tournament
              </option>

              {tournaments.map(
                (
                  tournament,
                ) => (
                  <option
                    key={
                      tournament.id
                    }
                    value={
                      tournament.id
                    }
                  >
                    {
                      tournament.leagueName
                    } — {
                      tournament.name
                    }
                  </option>
                ),
              )}
            </select>

            <button
              type="button"
              disabled={
                busy ||
                !tournamentId
              }
              onClick={() =>
                void nextFromTournament()
              }
              className="mt-5 rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
            >
              Next →
            </button>
          </FcPanel>
        ) : null}


        {step ===
        1 &&
        selectedTournament ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  {
                    selectedTournament.leagueName
                  }
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Review Teams / Groups
                </h2>
              </div>

              <FcStatusBadge
                label={
                  selectedTournament.competitionFormat ||
                  'Tournament'
                }
                tone="cyan"
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.025] p-4">
                <p className="text-[10px] text-slate-600">
                  Approved Entries
                </p>
                <p className="mt-2 text-2xl font-black">
                  {
                    entries.length
                  }
                </p>
              </div>

              <div className="rounded-xl bg-white/[0.025] p-4">
                <p className="text-[10px] text-slate-600">
                  Groups
                </p>
                <p className="mt-2 text-2xl font-black">
                  {
                    groups.length
                  }
                </p>
              </div>

              <div className="rounded-xl bg-white/[0.025] p-4">
                <p className="text-[10px] text-slate-600">
                  Group Mode
                </p>
                <p className="mt-2 text-sm font-black">
                  {
                    selectedTournament.groupMode ||
                    'SINGLE GROUP'
                  }
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() =>
                  setStep(
                    0,
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-3 font-black text-slate-400"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={() =>
                  setStep(
                    2,
                  )
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019]"
              >
                Next →
              </button>
            </div>
          </FcPanel>
        ) : null}


        {step ===
        2 &&
        settings ? (
          <FcPanel className="p-5 sm:p-6">
            <h2 className="text-xl font-black">
              Fixture Rules
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black text-slate-500">
                  Fixture Mode
                </span>

                <select
                  value={
                    settings.fixtureMode
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSettings({
                        ...settings,
                        fixtureMode:
                          event
                            .target
                            .value,
                      })
                  }
                  className="rounded-xl border border-white/10 bg-[#07101a] px-4 py-3"
                >
                  <option value="AUTOMATIC">
                    Automatic
                  </option>
                  <option value="RANDOMIZED">
                    Randomized
                  </option>
                  <option value="MANUAL">
                    Manual
                  </option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black text-slate-500">
                  Leg Type
                </span>

                <select
                  value={
                    settings.legType
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSettings({
                        ...settings,
                        legType:
                          event
                            .target
                            .value,
                      })
                  }
                  className="rounded-xl border border-white/10 bg-[#07101a] px-4 py-3"
                >
                  <option value="SINGLE_LEG">
                    Single Leg
                  </option>
                  <option value="HOME_AWAY">
                    Home & Away
                  </option>
                </select>
              </label>

              {[
                [
                  'dailyMatchLimit',
                  'Daily Match Limit',
                ],
                [
                  'matchesPerParticipantPerDay',
                  'Matches / Participant / Day',
                ],
                [
                  'matchDurationMinutes',
                  'Match Duration Minutes',
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <label
                    key={
                      key
                    }
                    className="grid gap-2"
                  >
                    <span className="text-xs font-black text-slate-500">
                      {
                        label
                      }
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        settings[
                          key
                        ]
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setSettings({
                            ...settings,
                            [key]:
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                          })
                      }
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                    />
                  </label>
                ),
              )}
            </div>

            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() =>
                  setStep(
                    1,
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-3 font-black text-slate-400"
              >
                ← Back
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void saveRules()
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
              >
                Save & Preview →
              </button>
            </div>
          </FcPanel>
        ) : null}


        {step ===
        3 ? (
          <FcPanel className="p-5 sm:p-6">
            <h2 className="text-xl font-black">
              Fixture Preview
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Generate a draft preview first. Nothing is published until the final step.
            </p>

            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() =>
                  setStep(
                    2,
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-3 font-black text-slate-400"
              >
                ← Back
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void generatePreview()
                }
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
              >
                {busy
                  ? 'Generating...'
                  : 'Generate Preview →'}
              </button>
            </div>
          </FcPanel>
        ) : null}


        {step ===
        4 ? (
          <FcPanel className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Final Step
                </p>

                <h2 className="mt-2 text-xl font-black">
                  Generate Fixtures
                </h2>
              </div>

              <FcStatusBadge
                label={
                  `${preview.length} Draft Fixtures`
                }
                tone="emerald"
              />
            </div>

            <div className="mt-5 space-y-2">
              {preview
                .slice(
                  0,
                  6,
                )
                .map(
                  (
                    fixture,
                  ) => (
                    <div
                      key={
                        fixture.id
                      }
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-500">
                          {
                            fixture.roundName
                          }
                        </p>

                        <p className="mt-1 text-sm font-black">
                          {fixture.homeRegistration
                            ?.entryName ||
                            'TBD'}
                          {' vs '}
                          {fixture.awayRegistration
                            ?.entryName ||
                            'TBD'}
                        </p>
                      </div>

                      <span className="text-[10px] text-slate-600">
                        MD{' '}
                        {fixture.matchday ||
                          fixture.roundNumber}
                      </span>
                    </div>
                  ),
                )}

              {preview.length >
              6 ? (
                <p className="pt-2 text-xs text-slate-600">
                  +{
                    preview.length -
                    6
                  } more fixtures
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={
                  `/tournaments/${tournamentId}/wizard/fixture-preview`
                }
                className="text-sm font-black text-sky-300"
              >
                Open Full Preview
              </Link>

              <button
                type="button"
                disabled={
                  busy ||
                  preview.length ===
                    0
                }
                onClick={() =>
                  void publishFixtures()
                }
                className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-[#031019] disabled:opacity-40"
              >
                {busy
                  ? 'Publishing...'
                  : 'Confirm Generate Fixtures'}
              </button>
            </div>
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
