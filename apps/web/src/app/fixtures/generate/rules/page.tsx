'use client';

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
  FixtureGeneratorShell,
} from '@/components/fixtures/fixture-generator-shell';

import {
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  expectedRoundRobinCounts,
  loadFixtureGeneratorDraft,
  saveFixtureGeneratorDraft,
  type FixtureGeneratorDraft,
} from '@/lib/fixture-generator-draft';


export default function FixtureRulesPage() {
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
    draft,
    setDraft,
  ] =
    useState<FixtureGeneratorDraft>(
      () =>
        loadFixtureGeneratorDraft(),
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
    if (
      !draft.tournamentId ||
      draft.selectedRegistrationIds.length <
        2
    ) {
      router.replace(
        '/fixtures/generate/participants',
      );

      return;
    }

    void getCurrentUser()
      .then(
        setUser,
      )
      .catch(
        () =>
          router.replace(
            '/login',
          ),
      );
  }, [
    draft.selectedRegistrationIds.length,
    draft.tournamentId,
    router,
  ]);


  const counts =
    useMemo(
      () =>
        expectedRoundRobinCounts(
          draft.participantCount,
          draft.meetings,
        ),
      [
        draft.meetings,
        draft.participantCount,
      ],
    );


  function update(
    patch:
      Partial<FixtureGeneratorDraft>,
  ) {
    setDraft(
      (
        value,
      ) => ({
        ...value,
        ...patch,
      }),
    );
  }


  async function preview() {
    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const fixtureMode =
        draft.method ===
        'RANDOM_ROUND_ROBIN'
          ? 'RANDOMIZED'
          : draft.method ===
              'MANUAL'
            ? 'MANUAL'
            : 'AUTOMATIC';

      const legType =
        draft.meetings ===
        'HOME_AWAY'
          ? 'HOME_AWAY'
          : 'SINGLE_LEG';

      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-settings`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              fixtureMode,
              legType,
            }),
        },
      );

      const nextDraft = {
        ...draft,
        matchdayPrefix:
          draft.matchdayPrefix.trim() ||
          'Matchday',
      };

      saveFixtureGeneratorDraft(
        nextDraft,
      );

      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview/generate`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              registrationIds:
                draft.selectedRegistrationIds,

              ...(draft.scope ===
                'GROUP' &&
              draft.groupId
                ? {
                    groupId:
                      draft.groupId,
                  }
                : {}),

              homeAwayMode:
                draft.homeAwayMode,

              matchdayPrefix:
                nextDraft.matchdayPrefix,

              ...(draft.startDate
                ? {
                    startDate:
                      new Date(
                        `${draft.startDate}T00:00:00.000Z`,
                      ).toISOString(),
                  }
                : {}),

              matchdayIntervalDays:
                draft.matchdayIntervalDays,

              ...(draft.defaultMatchTime
                ? {
                    defaultMatchTime:
                      draft.defaultMatchTime,
                  }
                : {}),
            }),
        },
      );

      router.push(
        '/fixtures/generate/preview',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate fixture preview.',
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
        label="Loading Fixture Rules..."
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
      <FixtureGeneratorShell
        step="RULES"
        title="Fixture Rules"
        description="Configure meetings, Home/Away behavior, Matchday naming and optional scheduling before preview generation."
      >
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="p-5 sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <section>
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Meetings
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  [
                    'SINGLE',
                    'Single Round',
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
                        update({
                          meetings:
                            value as FixtureGeneratorDraft['meetings'],
                        })
                      }
                      className={`rounded-[10px] border p-4 text-left text-sm font-medium ${
                        draft.meetings ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.10] text-[#F8FAFC]'
                          : 'border-[#253140] bg-[#151C26] text-[#A7B0BE]'
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


            <section>
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Fixture Order
              </p>

              <div className="mt-3 grid gap-2">
                {[
                  [
                    'ROUND_ROBIN',
                    'Standard Round Robin',
                  ],
                  [
                    'RANDOM_ROUND_ROBIN',
                    'Randomized Round Robin',
                  ],
                  [
                    'MANUAL',
                    'Manual Pairing',
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
                        update({
                          method:
                            value as FixtureGeneratorDraft['method'],
                        })
                      }
                      className={`rounded-[10px] border px-4 py-3 text-left text-sm font-medium ${
                        draft.method ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.10] text-[#F8FAFC]'
                          : 'border-[#253140] bg-[#151C26] text-[#A7B0BE]'
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


            <section className="md:col-span-2">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Home / Away
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {[
                  [
                    'BALANCED',
                    'Balanced Home/Away',
                    'Use the standard rotation balance.',
                  ],
                  [
                    'RANDOM',
                    'Random Home/Away',
                    'Randomize orientation while preserving valid pairings.',
                  ],
                  [
                    'MANUAL',
                    'Manual Editing',
                    'Generate normally, then edit Home/Away in Preview.',
                  ],
                ].map(
                  ([
                    value,
                    title,
                    description,
                  ]) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        update({
                          homeAwayMode:
                            value as FixtureGeneratorDraft['homeAwayMode'],
                        })
                      }
                      className={`rounded-xl border p-4 text-left ${
                        draft.homeAwayMode ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.10]'
                          : 'border-[#253140] bg-[#151C26]'
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#F8FAFC]">
                        {
                          title
                        }
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#6F7B8A]">
                        {
                          description
                        }
                      </p>
                    </button>
                  ),
                )}
              </div>
            </section>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Matchday Naming
              </span>

              <input
                value={
                  draft.matchdayPrefix
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      matchdayPrefix:
                        event
                          .target
                          .value,
                    })
                }
                maxLength={
                  40
                }
                placeholder="Matchday"
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
              />
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Start Date
              </span>

              <input
                type="date"
                value={
                  draft.startDate
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      startDate:
                        event
                          .target
                          .value,
                    })
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
              />
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Matchday Interval
              </span>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={
                    draft.matchdayIntervalDays
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      update({
                        matchdayIntervalDays:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      })
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                />

                <span className="text-sm text-[#6F7B8A]">
                  days
                </span>
              </div>
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Default Match Time
              </span>

              <input
                type="time"
                value={
                  draft.defaultMatchTime
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      defaultMatchTime:
                        event
                          .target
                          .value,
                    })
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
              />
            </label>
          </div>


          {draft.method !==
          'MANUAL' ? (
            <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-[#253140] bg-[#151C26] p-4">
              <div>
                <p className="text-xs text-[#6F7B8A]">
                  Participants
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {
                    draft.participantCount
                  }
                </p>
              </div>

              <div>
                <p className="text-xs text-[#6F7B8A]">
                  Matchdays
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {
                    counts.rounds
                  }
                </p>
              </div>

              <div>
                <p className="text-xs text-[#6F7B8A]">
                  Matches
                </p>

                <p className="mt-1 text-lg font-semibold">
                  {
                    counts.matches
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-200">
              Manual Pairing creates an empty preview. Add each match yourself on the next screen.
            </div>
          )}
        </FcPanel>


        <div className="flex items-center justify-between border-t border-[#253140] pt-5">
          <button
            type="button"
            onClick={() => {
              saveFixtureGeneratorDraft(
                draft,
              );

              router.push(
                '/fixtures/generate/participants',
              );
            }}
            className="min-h-11 rounded-[10px] px-4 text-sm font-medium text-[#A7B0BE] hover:bg-[#151C26]"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              void preview()
            }
            className="min-h-11 rounded-[10px] bg-[#38BDF8] px-5 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9] disabled:opacity-40"
          >
            {busy
              ? 'Preparing Preview...'
              : 'Preview Fixtures →'}
          </button>
        </div>
      </FixtureGeneratorShell>
    </AppShell>
  );
}
