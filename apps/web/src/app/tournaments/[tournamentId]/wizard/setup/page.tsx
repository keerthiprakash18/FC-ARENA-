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
  TournamentLogoUpload,
} from '@/components/tournaments/tournament-logo-upload';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


type CompetitionFormat =
  | 'LEAGUE_ROUND_ROBIN'
  | 'DOUBLE_ROUND_ROBIN'
  | 'SINGLE_ELIMINATION'
  | 'GROUP_STAGE_KNOCKOUT'
  | 'CUSTOM_MANUAL';

type GroupMode =
  | 'SINGLE_GROUP'
  | 'MULTIPLE_GROUPS';

type LegType =
  | 'SINGLE_LEG'
  | 'HOME_AWAY';

type FixtureMode =
  | 'AUTOMATIC'
  | 'RANDOMIZED'
  | 'MANUAL';

type Visibility =
  | 'PRIVATE'
  | 'LEAGUE'
  | 'PUBLIC';

type RegistrationMode =
  | 'OPEN'
  | 'APPROVAL'
  | 'ADMIN_ONLY';

type TournamentMode =
  | 'SOLO'
  | 'DUO'
  | 'TEAM';


interface Tournament {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  logoUrl: string | null;

  mode:
    TournamentMode;

  competitionFormat:
    CompetitionFormat;

  groupMode:
    GroupMode;

  legType:
    LegType;

  fixtureMode:
    FixtureMode;

  visibility:
    Visibility;

  registrationMode:
    RegistrationMode;

  maxEntries: number;
  teamSize: number;

  startAt: string | null;
  endAt: string | null;
}


interface WizardData {
  currentStep:
    TournamentWizardStep;

  steps:
    TournamentWizardStep[];
}


function inputDate(
  value: string | null,
) {
  if (!value) {
    return '';
  }

  return new Date(value)
    .toISOString()
    .slice(
      0,
      16,
    );
}


export default function TournamentSetupPage() {
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
    wizard,
    setWizard,
  ] =
    useState<WizardData | null>(
      null,
    );


  const [
    competitionFormat,
    setCompetitionFormat,
  ] =
    useState<CompetitionFormat>(
      'LEAGUE_ROUND_ROBIN',
    );


  const [
    groupMode,
    setGroupMode,
  ] =
    useState<GroupMode>(
      'SINGLE_GROUP',
    );


  const [
    legType,
    setLegType,
  ] =
    useState<LegType>(
      'SINGLE_LEG',
    );


  const [
    fixtureMode,
    setFixtureMode,
  ] =
    useState<FixtureMode>(
      'AUTOMATIC',
    );


  const [
    visibility,
    setVisibility,
  ] =
    useState<Visibility>(
      'LEAGUE',
    );


  const [
    registrationMode,
    setRegistrationMode,
  ] =
    useState<RegistrationMode>(
      'APPROVAL',
    );


  const [
    mode,
    setMode,
  ] =
    useState<TournamentMode>(
      'SOLO',
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


        const loaded =
          tournamentResponse
            .data
            .tournament;


        setTournament(
          loaded,
        );

        setCompetitionFormat(
          loaded.competitionFormat,
        );

        setGroupMode(
          loaded.groupMode,
        );

        setLegType(
          loaded.legType,
        );

        setFixtureMode(
          loaded.fixtureMode,
        );

        setVisibility(
          loaded.visibility,
        );

        setRegistrationMode(
          loaded.registrationMode,
        );

        setMode(
          loaded.mode,
        );

        setWizard(
          wizardResponse.data,
        );
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


  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    setBusy(true);
    setError('');


    try {
      const startAt =
        String(
          form.get(
            'startAt',
          ) ?? '',
        );

      const endAt =
        String(
          form.get(
            'endAt',
          ) ?? '',
        );


      await authenticatedRequest(
        `/tournaments/${tournamentId}/setup`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              name:
                String(
                  form.get(
                    'name',
                  ) ?? '',
                ),

              description:
                String(
                  form.get(
                    'description',
                  ) ?? '',
                ),

              rules:
                String(
                  form.get(
                    'rules',
                  ) ?? '',
                ),

              mode,

              competitionFormat,

              groupMode:
                competitionFormat ===
                'GROUP_STAGE_KNOCKOUT'
                  ? 'MULTIPLE_GROUPS'
                  : groupMode,

              legType,

              fixtureMode,

              visibility,

              registrationMode,

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

              startAt:
                startAt
                  ? new Date(
                      startAt,
                    ).toISOString()
                  : undefined,

              endAt:
                endAt
                  ? new Date(
                      endAt,
                    ).toISOString()
                  : undefined,
            }),
        },
      );


      router.push(
        `/tournaments/${tournamentId}/wizard/teams`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save Tournament setup.',
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
        Loading Tournament Setup...
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
        currentStep="SETUP"
        steps={
          wizard.steps
        }
        title="Tournament Setup"
        description="Configure the competition structure before adding teams."
      >

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}


        <form
          onSubmit={
            submit
          }
          className="space-y-8"
        >

          <div className="grid gap-5 md:grid-cols-2">

            <div className="field">
              <label>
                Tournament Name
              </label>

              <input
                name="name"
                required
                defaultValue={
                  tournament.name
                }
              />
            </div>


            <div className="field">
              <label>
                Number of Teams / Entries
              </label>

              <input
                name="maxEntries"
                type="number"
                min="2"
                max="128"
                required
                defaultValue={
                  tournament.maxEntries
                }
              />
            </div>

          </div>


          <div>
            <p className="mb-3 text-sm font-black text-slate-300">
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
                    className={`rounded-2xl border p-4 text-left ${
                      mode ===
                      value
                        ? 'border-sky-400/40 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      {
                        value
                      }
                    </p>
                  </button>
                ),
              )}

            </div>
          </div>


          {mode ===
          'TEAM' ? (
            <div className="field">
              <label>
                Players Per Team
              </label>

              <input
                name="teamSize"
                type="number"
                min="3"
                max="11"
                defaultValue={
                  Math.max(
                    3,
                    tournament.teamSize,
                  )
                }
                required
              />
            </div>
          ) : null}


          <div>
            <p className="mb-3 text-sm font-black text-slate-300">
              Tournament Format
            </p>

            <div className="grid gap-3 md:grid-cols-2">

              {[
                [
                  'LEAGUE_ROUND_ROBIN',
                  'League / Round Robin',
                ],
                [
                  'DOUBLE_ROUND_ROBIN',
                  'Double Round Robin',
                ],
                [
                  'SINGLE_ELIMINATION',
                  'Single Elimination',
                ],
                [
                  'GROUP_STAGE_KNOCKOUT',
                  'Group Stage + Knockout',
                ],
                [
                  'CUSTOM_MANUAL',
                  'Custom / Manual',
                ],
              ].map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    onClick={() => {
                      const format =
                        value as
                          CompetitionFormat;

                      setCompetitionFormat(
                        format,
                      );

                      if (
                        format ===
                        'GROUP_STAGE_KNOCKOUT'
                      ) {
                        setGroupMode(
                          'MULTIPLE_GROUPS',
                        );
                      }

                      if (
                        format ===
                        'DOUBLE_ROUND_ROBIN'
                      ) {
                        setLegType(
                          'HOME_AWAY',
                        );
                      }

                      if (
                        format ===
                        'CUSTOM_MANUAL'
                      ) {
                        setFixtureMode(
                          'MANUAL',
                        );
                      }
                    }}
                    className={`rounded-2xl border p-4 text-left ${
                      competitionFormat ===
                      value
                        ? 'border-sky-400/40 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      {
                        label
                      }
                    </p>
                  </button>
                ),
              )}

            </div>
          </div>


          <div>
            <p className="mb-3 text-sm font-black text-slate-300">
              Group Mode
            </p>

            <div className="grid gap-3 sm:grid-cols-2">

              {([
                'SINGLE_GROUP',
                'MULTIPLE_GROUPS',
              ] as GroupMode[]).map(
                (
                  value,
                ) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    disabled={
                      competitionFormat ===
                        'GROUP_STAGE_KNOCKOUT' &&
                      value ===
                        'SINGLE_GROUP'
                    }
                    onClick={() =>
                      setGroupMode(
                        value,
                      )
                    }
                    className={`rounded-2xl border p-4 text-left disabled:opacity-30 ${
                      groupMode ===
                      value
                        ? 'border-sky-400/40 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      {value ===
                      'SINGLE_GROUP'
                        ? 'Single Group'
                        : 'Multiple Groups'}
                    </p>
                  </button>
                ),
              )}

            </div>
          </div>


          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <p className="mb-3 text-sm font-black text-slate-300">
                Match Leg
              </p>

              <select
                value={
                  legType
                }
                onChange={
                  (
                    event,
                  ) =>
                    setLegType(
                      event
                        .target
                        .value as
                        LegType,
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
              >
                <option value="SINGLE_LEG">
                  Single Leg
                </option>

                <option value="HOME_AWAY">
                  Home & Away
                </option>
              </select>
            </div>


            <div>
              <p className="mb-3 text-sm font-black text-slate-300">
                Fixture Mode
              </p>

              <select
                value={
                  fixtureMode
                }
                onChange={
                  (
                    event,
                  ) =>
                    setFixtureMode(
                      event
                        .target
                        .value as
                        FixtureMode,
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
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
            </div>

          </div>


          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <p className="mb-3 text-sm font-black text-slate-300">
                Visibility
              </p>

              <select
                value={
                  visibility
                }
                onChange={
                  (
                    event,
                  ) =>
                    setVisibility(
                      event
                        .target
                        .value as
                        Visibility,
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
              >
                <option value="PRIVATE">
                  Private
                </option>

                <option value="LEAGUE">
                  League
                </option>

                <option value="PUBLIC">
                  Public
                </option>
              </select>
            </div>


            <div>
              <p className="mb-3 text-sm font-black text-slate-300">
                Registration Mode
              </p>

              <select
                value={
                  registrationMode
                }
                onChange={
                  (
                    event,
                  ) =>
                    setRegistrationMode(
                      event
                        .target
                        .value as
                        RegistrationMode,
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
              >
                <option value="OPEN">
                  Open
                </option>

                <option value="APPROVAL">
                  Approval Required
                </option>

                <option value="ADMIN_ONLY">
                  Admin Only
                </option>
              </select>
            </div>

          </div>


          <div className="grid gap-5 md:grid-cols-2">

            <div className="field">
              <label>
                Start Date
              </label>

              <input
                name="startAt"
                type="datetime-local"
                defaultValue={
                  inputDate(
                    tournament.startAt,
                  )
                }
              />
            </div>


            <div className="field">
              <label>
                End Date
              </label>

              <input
                name="endAt"
                type="datetime-local"
                defaultValue={
                  inputDate(
                    tournament.endAt,
                  )
                }
              />
            </div>

          </div>


          <TournamentLogoUpload
            tournamentId={
              tournamentId
            }
            initialUrl={
              tournament.logoUrl
            }
          />


          <div className="field">
            <label>
              Description
            </label>

            <textarea
              name="description"
              rows={4}
              defaultValue={
                tournament.description ??
                ''
              }
              className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 outline-none"
            />
          </div>


          <div className="field">
            <label>
              Rules
            </label>

            <textarea
              name="rules"
              rows={5}
              defaultValue={
                tournament.rules ??
                ''
              }
              className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 outline-none"
            />
          </div>


          <div className="sticky bottom-20 flex justify-end border-t border-white/10 bg-[#0a1018]/95 pt-5 backdrop-blur lg:bottom-0">

            <button
              type="submit"
              disabled={
                busy
              }
              className="rounded-xl bg-sky-400 px-6 py-3 font-black text-[#041019] disabled:opacity-40"
            >
              {busy
                ? 'Saving...'
                : 'Save & Continue →'}
            </button>

          </div>

        </form>

      </TournamentWizardShell>

    </AppShell>
  );
}