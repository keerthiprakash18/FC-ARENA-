'use client';

import { confirmAction, formAction } from '@/components/fc/confirmation-provider';
import { FcEmptyState, FcLoadingScreen, FcNotice } from '@/components/fc/fc-ui';
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
}

interface Fixture {
  id: string;
  roundNumber: number;
  matchday: number | null;

  homeRegistration: {
    id: string;
    entryName: string | null;
  } | null;

  awayRegistration: {
    id: string;
    entryName: string | null;
  } | null;

  group: {
    id: string;
    name: string;
  } | null;
}


export default function FixturePreviewPage() {
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
    steps,
    setSteps,
  ] =
    useState<TournamentWizardStep[]>(
      [],
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<Fixture[]>(
      [],
    );

  const [
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
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


  async function loadPreview() {
    const [
      preview,
      entryResponse,
    ] =
      await Promise.all([
        authenticatedRequest<any>(
          `/tournaments/${tournamentId}/wizard/fixture-preview`,
        ),

        authenticatedRequest<any>(
          `/tournaments/${tournamentId}/entries`,
        ),
      ]);

    setFixtures(
      preview
        .data
        .fixtures,
    );

    setEntries(
      entryResponse
        .data
        .entries,
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          wizard,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/wizard`,
            ),
          ]);

        setUser(
          current,
        );

        setSteps(
          wizard.data.steps,
        );

        await loadPreview();
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


  const rounds =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Fixture[]
          >();

        for (
          const fixture
          of fixtures
        ) {
          const key =
            `${fixture.group?.name ?? 'Tournament'} · Matchday ${fixture.matchday ?? fixture.roundNumber}`;

          const list =
            map.get(
              key,
            ) ??
            [];

          list.push(
            fixture,
          );

          map.set(
            key,
            list,
          );
        }

        return Array.from(
          map.entries(),
        );
      },
      [
        fixtures,
      ],
    );


  async function regenerate() {
    if (
      !(await confirmAction(
        { title: 'Replace fixture preview?', description: 'Regenerate the fixture preview? Your current draft changes will be replaced.', confirmLabel: 'Regenerate preview', destructive: true },
      ))
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-preview/generate`,
        {
          method:
            'POST',
        },
      );

      setMessage(
        'Fixture preview regenerated.',
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to regenerate.',
      );
    } finally {
      setBusy(false);
    }
  }


  async function reset() {
    if (
      !(await confirmAction(
        { title: 'Reset draft fixtures?', description: 'Remove all fixtures from this draft preview? You will need to generate or add draft fixtures again.', confirmLabel: 'Reset draft', destructive: true },
      ))
    ) {
      return;
    }

    await updateDraft(() => authenticatedRequest(
      `/tournaments/${tournamentId}/wizard/fixture-preview`,
      {
        method:
          'DELETE',
      },
    ));
  }


  async function swap(
    fixtureId:
      string,
  ) {
    await updateDraft(() => authenticatedRequest(
      `/tournaments/${tournamentId}/wizard/fixture-preview/${fixtureId}/swap`,
      {
        method:
          'POST',
      },
    ));
  }


  async function remove(
    fixtureId:
      string,
  ) {
    if (
      !(await confirmAction(
        { title: 'Delete draft fixture?', description: 'Remove this fixture from the draft preview?', confirmLabel: 'Delete fixture', destructive: true },
      ))
    ) {
      return;
    }

    await updateDraft(() => authenticatedRequest(
      `/tournaments/${tournamentId}/wizard/fixture-preview/${fixtureId}`,
      {
        method:
          'DELETE',
      },
    ));
  }


  async function moveRound(
    fixture:
      Fixture,
  ) {
    const values = await formAction({
      title: 'Move draft fixture', description: 'Choose the matchday for this fixture.', confirmLabel: 'Move fixture',
      fields: [{ name: 'matchday', label: 'Matchday', type: 'number', required: true, min: 1, step: 1, defaultValue: String(fixture.matchday ?? fixture.roundNumber) }],
    });
    const value = values?.matchday;

    if (!value) {
      return;
    }

    const matchday =
      Number(
        value,
      );

    if (
      !Number.isInteger(
        matchday,
      ) ||
      matchday <
      1
    ) {
      return;
    }

    await updateDraft(() => authenticatedRequest(
      `/tournaments/${tournamentId}/wizard/fixture-preview/${fixture.id}`,
      {
        method:
          'PATCH',

        body:
          JSON.stringify({
            roundNumber:
              matchday,

            matchday,
          }),
      },
    ));
  }


  async function addMatch() {
    if (
      entries.length <
      2
    ) {
      return;
    }

    const options = entries.map(entry => ({ value: entry.id, label: entry.entryName || entry.id }));
    const values = await formAction({
      title: 'Add draft fixture', description: 'Select the home and away teams and choose a matchday.', confirmLabel: 'Add fixture',
      fields: [
        { name: 'home', label: 'Home team', type: 'select', required: true, options },
        { name: 'away', label: 'Away team', type: 'select', required: true, options },
        { name: 'matchday', label: 'Matchday', type: 'number', required: true, min: 1, step: 1, defaultValue: '1' },
      ],
      validate: values => values.home === values.away ? 'Choose two different teams.' : undefined,
    });
    if (!values) return;
    const home = values.home, away = values.away, round = Number(values.matchday);

    await updateDraft(() => authenticatedRequest(
      `/tournaments/${tournamentId}/wizard/fixture-preview`,
      {
        method:
          'POST',

        body:
          JSON.stringify({
            homeRegistrationId:
              home.trim(),

            awayRegistrationId:
              away.trim(),

            roundNumber:
              round,

            matchday:
              round,
          }),
      },
    ));
  }

  async function updateDraft(mutate: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await mutate();
      await loadPreview();
      setMessage('Fixture preview updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the fixture preview.');
    } finally {
      setBusy(false);
    }
  }


  async function publish() {
    setBusy(true);
    setError('');

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/wizard/fixture-preview/publish`,
          {
            method:
              'POST',
          },
        );

      const next =
        response
          .data
          .nextStep;

      router.push(
        next ===
        'QUALIFICATION'
          ? `/tournaments/${tournamentId}/wizard/qualification`
          : `/tournaments/${tournamentId}/wizard/review`,
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
      setBusy(false);
    }
  }


  if (
    !user ||
    steps.length ===
      0
  ) {
    return (
      <FcLoadingScreen label="Loading Fixture Preview..." />
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
        currentStep="FIXTURE_PREVIEW"
        steps={
          steps
        }
        title="Fixture Preview"
        description="Review and edit fixtures before they become official."
      >

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>


        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            disabled={busy || entries.length < 2}
            onClick={() =>
              void addMatch()
            }
            className="rounded-xl border border-sky-400/20 px-4 py-3 font-black text-sky-300"
          >
            + Add Match
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void regenerate()
            }
            className="rounded-xl border border-white/10 px-4 py-3 font-black"
          >
            Regenerate
          </button>

          <button
            type="button"
            disabled={busy || fixtures.length === 0}
            onClick={() =>
              void reset()
            }
            className="rounded-xl border border-red-400/20 px-4 py-3 font-black text-red-300"
          >
            Reset
          </button>

        </div>


        <div className="mt-7 space-y-7">
          {fixtures.length === 0 ? <FcEmptyState title="No draft fixtures" description="Add a match or regenerate the preview to start reviewing fixtures." icon="fixtures" /> : null}

          {rounds.map(
            ([
              title,
              roundFixtures,
            ]) => (

              <section
                key={
                  title
                }
              >

                <h2 className="text-xl font-black text-sky-300">
                  {
                    title
                  }
                </h2>


                <div className="mt-3 space-y-3">

                  {roundFixtures.map(
                    (
                      fixture,
                    ) => (

                      <article
                        key={
                          fixture.id
                        }
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >

                        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto]">

                          <p className="font-black md:text-right">
                            {
                              fixture
                                .homeRegistration
                                ?.entryName ??
                              'TBD'
                            }
                          </p>

                          <span className="text-xs font-black text-slate-600">
                            VS
                          </span>

                          <p className="font-black">
                            {
                              fixture
                                .awayRegistration
                                ?.entryName ??
                              'TBD'
                            }
                          </p>


                          <div className="flex flex-wrap gap-2">

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void swap(
                                  fixture.id,
                                )
                              }
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black"
                            >
                              Swap
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void moveRound(
                                  fixture,
                                )
                              }
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black"
                            >
                              Move
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void remove(
                                  fixture.id,
                                )
                              }
                              className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                            >
                              Delete
                            </button>

                          </div>

                        </div>

                      </article>
                    ),
                  )}

                </div>

              </section>
            ),
          )}

        </div>


        <div className="fc-workflow-actions mt-8 flex justify-between border-t pt-5">

          <button
            type="button"
            onClick={() =>
              router.push(
                `/tournaments/${tournamentId}/wizard/fixture-settings`,
              )
            }
            className="rounded-xl border border-white/10 px-5 py-3 font-black text-slate-400"
          >
            ← Back
          </button>


          <button
            type="button"
            disabled={
              busy ||
              fixtures.length ===
                0
            }
            onClick={() =>
              void publish()
            }
            className="rounded-xl bg-sky-400 px-6 py-3 font-black text-[#041019] disabled:opacity-40"
          >
            {busy
              ? 'Validating...'
              : 'Publish Fixtures & Continue →'}
          </button>

        </div>

      </TournamentWizardShell>

    </AppShell>
  );
}