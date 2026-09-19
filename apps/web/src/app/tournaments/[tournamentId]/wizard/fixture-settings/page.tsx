'use client';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
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


export default function FixtureSettingsPage() {
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
    fixtureMode,
    setFixtureMode,
  ] =
    useState(
      'AUTOMATIC',
    );

  const [
    legType,
    setLegType,
  ] =
    useState(
      'SINGLE_LEG',
    );

  const [
    dailyLimit,
    setDailyLimit,
  ] =
    useState(
      20,
    );

  const [
    duration,
    setDuration,
  ] =
    useState(
      30,
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
        const [
          current,
          wizard,
          settings,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/wizard`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${tournamentId}/wizard/fixture-settings`,
            ),
          ]);

        setUser(
          current,
        );

        setSteps(
          wizard.data.steps,
        );

        setFixtureMode(
          settings
            .data
            .fixtureMode,
        );

        setLegType(
          settings
            .data
            .legType,
        );

        setDailyLimit(
          settings
            .data
            .dailyMatchLimit,
        );

        setDuration(
          settings
            .data
            .matchDurationMinutes,
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


  async function next() {
    setBusy(true);
    setError('');

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-settings`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              fixtureMode,
              legType,

              dailyMatchLimit:
                dailyLimit,

              matchDurationMinutes:
                duration,
            }),
        },
      );

      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-preview/generate`,
        {
          method:
            'POST',
        },
      );

      router.push(
        `/tournaments/${tournamentId}/wizard/fixture-preview`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate fixtures.',
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
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Fixture Settings...
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
        currentStep="FIXTURE_SETTINGS"
        steps={
          steps
        }
        title="Fixture Settings"
        description="Choose how FC ARENA should generate the match schedule."
      >

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-red-300">
            {error}
          </div>
        ) : null}


        <div className="space-y-7">

          <section>
            <p className="mb-3 text-sm font-black">
              Generation Mode
            </p>

            <div className="grid gap-3 md:grid-cols-3">

              {[
                'AUTOMATIC',
                'RANDOMIZED',
                'MANUAL',
              ].map(
                (
                  value,
                ) => (
                  <button
                    key={
                      value
                    }
                    type="button"
                    onClick={() =>
                      setFixtureMode(
                        value,
                      )
                    }
                    className={`rounded-2xl border p-5 text-left font-black ${
                      fixtureMode ===
                      value
                        ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                        : 'border-white/10'
                    }`}
                  >
                    {
                      value.replace(
                        '_',
                        ' ',
                      )
                    }
                  </button>
                ),
              )}

            </div>
          </section>


          <section>
            <p className="mb-3 text-sm font-black">
              Match Legs
            </p>

            <div className="grid gap-3 md:grid-cols-2">

              {[
                [
                  'SINGLE_LEG',
                  'Single Leg',
                ],
                [
                  'HOME_AWAY',
                  'Home & Away',
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
                    onClick={() =>
                      setLegType(
                        value,
                      )
                    }
                    className={`rounded-2xl border p-5 text-left font-black ${
                      legType ===
                      value
                        ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                        : 'border-white/10'
                    }`}
                  >
                    {
                      label
                    }
                  </button>
                ),
              )}

            </div>
          </section>


          <div className="grid gap-5 md:grid-cols-2">

            <label>
              <span className="mb-2 block text-sm font-black">
                Matches Per Day
              </span>

              <input
                type="number"
                min="1"
                max="100"
                value={
                  dailyLimit
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDailyLimit(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
              />
            </label>


            <label>
              <span className="mb-2 block text-sm font-black">
                Match Duration
              </span>

              <input
                type="number"
                min="5"
                max="240"
                value={
                  duration
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDuration(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
                className="w-full rounded-xl border border-white/10 bg-[#080e15] px-4 py-3"
              />
            </label>

          </div>


          <div className="flex justify-between border-t border-white/10 pt-5">

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="rounded-xl border border-white/10 px-5 py-3 font-black text-slate-400"
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                void next()
              }
              className="rounded-xl bg-sky-400 px-6 py-3 font-black text-[#041019] disabled:opacity-40"
            >
              {busy
                ? 'Generating...'
                : 'Generate Preview →'}
            </button>

          </div>

        </div>

      </TournamentWizardShell>
    </AppShell>
  );
}