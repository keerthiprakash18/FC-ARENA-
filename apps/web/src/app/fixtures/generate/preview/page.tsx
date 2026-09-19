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
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  expectedRoundRobinCounts,
  loadFixtureGeneratorDraft,
  type FixtureGeneratorDraft,
} from '@/lib/fixture-generator-draft';


interface Registration {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
}


interface PreviewFixture {
  id: string;
  roundNumber: number;
  roundName: string;
  matchday: number | null;
  scheduledAt: string | null;
  venue: string | null;

  group: {
    id: string;
    name: string;
  } | null;

  homeRegistration:
    Registration | null;

  awayRegistration:
    Registration | null;
}


interface Group {
  id: string;
  name: string;

  entries: Array<{
    id: string;
  }>;
}


interface EditState {
  homeRegistrationId:
    string;
  awayRegistrationId:
    string;
  roundNumber:
    number;
  scheduledAt:
    string;
}


function toLocalDateTime(
  value:
    string | null,
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      value,
    );

  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime() -
    offset *
    60_000,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}


function toIso(
  value:
    string,
) {
  if (!value) {
    return undefined;
  }

  return new Date(
    value,
  ).toISOString();
}


export default function FixturePreviewPage() {
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
  ] =
    useState<FixtureGeneratorDraft>(
      () =>
        loadFixtureGeneratorDraft(),
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<PreviewFixture[]>(
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
    currentRound,
    setCurrentRound,
  ] =
    useState(
      1,
    );

  const [
    edits,
    setEdits,
  ] =
    useState<
      Record<
        string,
        EditState
      >
    >(
      {},
    );

  const [
    showAdd,
    setShowAdd,
  ] =
    useState(false);

  const [
    addHome,
    setAddHome,
  ] =
    useState('');

  const [
    addAway,
    setAddAway,
  ] =
    useState('');

  const [
    addRound,
    setAddRound,
  ] =
    useState(
      1,
    );

  const [
    addDateTime,
    setAddDateTime,
  ] =
    useState('');

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
    const response =
      await authenticatedRequest<any>(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview`,
      );

    const all:
      PreviewFixture[] =
      response
        .data
        .fixtures;

    const scoped =
      draft.scope ===
        'GROUP' &&
      draft.groupId
        ? all.filter(
            (
              fixture,
            ) =>
              fixture.group?.id ===
              draft.groupId,
          )
        : all;

    setFixtures(
      scoped,
    );

    const nextEdits:
      Record<
        string,
        EditState
      > =
      {};

    for (
      const fixture
      of scoped
    ) {
      nextEdits[
        fixture.id
      ] = {
        homeRegistrationId:
          fixture
            .homeRegistration
            ?.id ??
          '',
        awayRegistrationId:
          fixture
            .awayRegistration
            ?.id ??
          '',
        roundNumber:
          fixture.roundNumber,
        scheduledAt:
          toLocalDateTime(
            fixture.scheduledAt,
          ),
      };
    }

    setEdits(
      nextEdits,
    );

    if (
      scoped.length >
      0
    ) {
      const rounds =
        scoped.map(
          (
            fixture,
          ) =>
            fixture.roundNumber,
        );

      setCurrentRound(
        (
          current,
        ) =>
          rounds.includes(
            current,
          )
            ? current
            : Math.min(
                ...rounds,
              ),
      );
    }
  }


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

    void (async () => {
      try {
        const [
          current,
          groupResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${draft.tournamentId}/groups`,
            ).catch(
              () => ({
                data: {
                  groups: [],
                },
              }),
            ),
          ]);

        setUser(
          current,
        );

        setGroups(
          groupResponse
            .data
            .groups ??
            [],
        );

        await loadPreview();
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load fixture preview.',
        );
      }
    })();
  }, [
    draft.tournamentId,
    router,
  ]);


  const participants =
    useMemo(
      () =>
        draft.participants.filter(
          (
            participant,
          ) =>
            draft.selectedRegistrationIds.includes(
              participant.registrationId,
            ),
        ),
      [
        draft.participants,
        draft.selectedRegistrationIds,
      ],
    );


  const participantName =
    useMemo(
      () =>
        new Map(
          participants.map(
            (
              participant,
            ) => [
              participant.registrationId,
              participant.name,
            ],
          ),
        ),
      [
        participants,
      ],
    );


  const groupByRegistration =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const group
          of groups
        ) {
          for (
            const entry
            of group.entries
          ) {
            map.set(
              entry.id,
              group.id,
            );
          }
        }

        return map;
      },
      [
        groups,
      ],
    );


  const rounds =
    useMemo(
      () =>
        [
          ...new Set(
            fixtures.map(
              (
                fixture,
              ) =>
                fixture.roundNumber,
            ),
          ),
        ].sort(
          (
            a,
            b,
          ) =>
            a -
            b,
        ),
      [
        fixtures,
      ],
    );


  const currentFixtures =
    fixtures.filter(
      (
        fixture,
      ) =>
        fixture.roundNumber ===
        currentRound,
    );


  const byeParticipants =
    useMemo(
      () => {
        if (
          draft.participantCount %
          2 ===
          0 ||
          currentFixtures.length ===
          0
        ) {
          return [];
        }

        const playing =
          new Set<string>();

        for (
          const fixture
          of currentFixtures
        ) {
          if (
            fixture
              .homeRegistration
              ?.id
          ) {
            playing.add(
              fixture
                .homeRegistration
                .id,
            );
          }

          if (
            fixture
              .awayRegistration
              ?.id
          ) {
            playing.add(
              fixture
                .awayRegistration
                .id,
            );
          }
        }

        return participants.filter(
          (
            participant,
          ) =>
            !playing.has(
              participant.registrationId,
            ),
        );
      },
      [
        currentFixtures,
        draft.participantCount,
        participants,
      ],
    );


  const counts =
    expectedRoundRobinCounts(
      draft.participantCount,
      draft.meetings,
    );


  function patchEdit(
    fixtureId:
      string,
    patch:
      Partial<EditState>,
  ) {
    setEdits(
      (
        current,
      ) => ({
        ...current,

        [fixtureId]: {
          ...current[
            fixtureId
          ],
          ...patch,
        },
      }),
    );
  }


  async function saveEdit(
    fixture:
      PreviewFixture,
  ) {
    const edit =
      edits[
        fixture.id
      ];

    if (
      !edit
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
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview/${fixture.id}`,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              homeRegistrationId:
                edit.homeRegistrationId,

              awayRegistrationId:
                edit.awayRegistrationId,

              roundNumber:
                Number(
                  edit.roundNumber,
                ),

              matchday:
                Number(
                  edit.roundNumber,
                ),

              ...(fixture.group?.id
                ? {
                    groupId:
                      fixture.group.id,
                  }
                : {}),

              ...(edit.scheduledAt
                ? {
                    scheduledAt:
                      toIso(
                        edit.scheduledAt,
                      ),
                  }
                : {}),
            }),
        },
      );

      setMessage(
        'Match updated.',
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update match.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function swap(
    fixtureId:
      string,
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview/${fixtureId}/swap`,
        {
          method:
            'POST',
        },
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to swap Home/Away.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function remove(
    fixtureId:
      string,
  ) {
    if (
      !window.confirm(
        'Remove this match from the draft fixture list?',
      )
    ) {
      return;
    }

    setBusy(
      true,
    );

    try {
      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview/${fixtureId}`,
        {
          method:
            'DELETE',
        },
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove match.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function regenerate() {
    if (
      !window.confirm(
        'Regenerate this preview? Manual fixture edits in this scope will be replaced.',
      )
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
                draft.matchdayPrefix,

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
          : 'Unable to regenerate fixtures.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function reset() {
    if (
      !window.confirm(
        'Reset draft fixtures in this generator scope?',
      )
    ) {
      return;
    }

    setBusy(
      true,
    );

    try {
      await authenticatedRequest(
        draft.scope ===
          'GROUP' &&
        draft.groupId
          ? `/tournaments/${draft.tournamentId}/wizard/fixture-preview/group/${draft.groupId}`
          : `/tournaments/${draft.tournamentId}/wizard/fixture-preview`,
        {
          method:
            'DELETE',
        },
      );

      setMessage(
        'Draft preview reset.',
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset preview.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function addMatch() {
    if (
      !addHome ||
      !addAway
    ) {
      setError(
        'Choose Home and Away participants.',
      );

      return;
    }

    if (
      addHome ===
      addAway
    ) {
      setError(
        'A participant cannot play itself.',
      );

      return;
    }

    let groupId =
      draft.scope ===
        'GROUP'
        ? draft.groupId
        : null;

    if (
      draft.scope ===
        'TOURNAMENT' &&
      groups.length >
        0
    ) {
      const homeGroup =
        groupByRegistration.get(
          addHome,
        );

      const awayGroup =
        groupByRegistration.get(
          addAway,
        );

      if (
        homeGroup ||
        awayGroup
      ) {
        if (
          !homeGroup ||
          !awayGroup ||
          homeGroup !==
          awayGroup
        ) {
          setError(
            'Group-stage manual matches must use participants from the same Group.',
          );

          return;
        }

        groupId =
          homeGroup;
      }
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              homeRegistrationId:
                addHome,

              awayRegistrationId:
                addAway,

              roundNumber:
                Number(
                  addRound,
                ),

              matchday:
                Number(
                  addRound,
                ),

              ...(groupId
                ? {
                    groupId,
                  }
                : {}),

              ...(addDateTime
                ? {
                    scheduledAt:
                      toIso(
                        addDateTime,
                      ),
                  }
                : {}),
            }),
        },
      );

      setShowAdd(
        false,
      );

      setAddHome(
        '',
      );

      setAddAway(
        '',
      );

      setMessage(
        'Match added to preview.',
      );

      await loadPreview();

      setCurrentRound(
        Number(
          addRound,
        ),
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add match.',
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
        label="Loading Fixture Preview..."
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
        step="PREVIEW"
        title="Fixture Preview"
        description="Review one Matchday at a time. Edit participants, Home/Away, Matchday and schedule before saving official fixtures."
      >
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


        <FcPanel className="p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#6F7B8A]">
                Fixture List
              </p>

              <p className="mt-1 truncate text-sm font-semibold">
                {
                  draft.fixtureListName
                }
              </p>
            </div>

            <div>
              <p className="text-xs text-[#6F7B8A]">
                Participants
              </p>

              <p className="mt-1 text-sm font-semibold">
                {
                  draft.participantCount
                }
              </p>
            </div>

            <div>
              <p className="text-xs text-[#6F7B8A]">
                Matchdays
              </p>

              <p className="mt-1 text-sm font-semibold">
                {draft.method ===
                'MANUAL'
                  ? rounds.length
                  : counts.rounds}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#6F7B8A]">
                Matches
              </p>

              <p className="mt-1 text-sm font-semibold">
                {
                  fixtures.length
                }
              </p>
            </div>
          </div>
        </FcPanel>


        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setShowAdd(
                (
                  value,
                ) =>
                  !value,
              )
            }
            className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-sm font-medium"
          >
            + Add Match
          </button>

          {draft.method !==
          'MANUAL' ? (
            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                void regenerate()
              }
              className="min-h-11 rounded-[10px] border border-[#253140] px-4 text-sm font-medium text-[#A7B0BE]"
            >
              Regenerate
            </button>
          ) : null}

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              void reset()
            }
            className="min-h-11 rounded-[10px] border border-red-400/20 px-4 text-sm font-medium text-red-300"
          >
            Reset
          </button>
        </div>


        {showAdd ? (
          <FcPanel className="p-5">
            <h2 className="text-lg font-semibold">
              Add Match
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-medium text-[#A7B0BE]">
                  Home
                </span>

                <select
                  value={
                    addHome
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setAddHome(
                        event
                          .target
                          .value,
                      )
                  }
                  className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                >
                  <option value="">
                    Select Home
                  </option>

                  {participants.map(
                    (
                      participant,
                    ) => (
                      <option
                        key={
                          participant.registrationId
                        }
                        value={
                          participant.registrationId
                        }
                      >
                        {
                          participant.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>


              <label className="grid gap-2">
                <span className="text-xs font-medium text-[#A7B0BE]">
                  Away
                </span>

                <select
                  value={
                    addAway
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setAddAway(
                        event
                          .target
                          .value,
                      )
                  }
                  className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                >
                  <option value="">
                    Select Away
                  </option>

                  {participants.map(
                    (
                      participant,
                    ) => (
                      <option
                        key={
                          participant.registrationId
                        }
                        value={
                          participant.registrationId
                        }
                      >
                        {
                          participant.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>


              <label className="grid gap-2">
                <span className="text-xs font-medium text-[#A7B0BE]">
                  Matchday
                </span>

                <input
                  type="number"
                  min="1"
                  value={
                    addRound
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setAddRound(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                  }
                  className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                />
              </label>


              <label className="grid gap-2">
                <span className="text-xs font-medium text-[#A7B0BE]">
                  Date & Time
                </span>

                <input
                  type="datetime-local"
                  value={
                    addDateTime
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setAddDateTime(
                        event
                          .target
                          .value,
                      )
                  }
                  className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowAdd(
                    false,
                  )
                }
                className="min-h-11 rounded-[10px] px-4 text-sm font-medium text-[#A7B0BE]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  busy
                }
                onClick={() =>
                  void addMatch()
                }
                className="min-h-11 rounded-[10px] bg-[#38BDF8] px-4 text-sm font-semibold text-[#071018] disabled:opacity-40"
              >
                Add Match
              </button>
            </div>
          </FcPanel>
        ) : null}


        {rounds.length >
        0 ? (
          <FcPanel className="p-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                disabled={
                  rounds.indexOf(
                    currentRound,
                  ) <=
                  0
                }
                onClick={() => {
                  const index =
                    rounds.indexOf(
                      currentRound,
                    );

                  if (
                    index >
                    0
                  ) {
                    setCurrentRound(
                      rounds[
                        index -
                        1
                      ],
                    );
                  }
                }}
                className="h-10 shrink-0 rounded-[10px] border border-[#253140] px-3 text-sm text-[#A7B0BE] disabled:opacity-30"
              >
                ←
              </button>

              <select
                value={
                  currentRound
                }
                onChange={
                  (
                    event,
                  ) =>
                    setCurrentRound(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                }
                className="min-h-10 min-w-[180px] flex-1 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-sm font-medium"
              >
                {rounds.map(
                  (
                    round,
                  ) => (
                    <option
                      key={
                        round
                      }
                      value={
                        round
                      }
                    >
                      {
                        draft.matchdayPrefix ||
                        'Matchday'
                      }{' '}
                      {
                        round
                      }
                    </option>
                  ),
                )}
              </select>

              <button
                type="button"
                disabled={
                  rounds.indexOf(
                    currentRound,
                  ) ===
                  rounds.length -
                    1
                }
                onClick={() => {
                  const index =
                    rounds.indexOf(
                      currentRound,
                    );

                  if (
                    index >=
                      0 &&
                    index <
                      rounds.length -
                        1
                  ) {
                    setCurrentRound(
                      rounds[
                        index +
                        1
                      ],
                    );
                  }
                }}
                className="h-10 shrink-0 rounded-[10px] border border-[#253140] px-3 text-sm text-[#A7B0BE] disabled:opacity-30"
              >
                →
              </button>
            </div>
          </FcPanel>
        ) : null}


        {currentFixtures.length >
        0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {
                  draft.matchdayPrefix ||
                  'Matchday'
                }{' '}
                {
                  currentRound
                }
              </h2>

              <FcStatusBadge
                label={
                  `${currentFixtures.length} Matches`
                }
                tone="slate"
              />
            </div>


            {currentFixtures.map(
              (
                fixture,
              ) => {
                const edit =
                  edits[
                    fixture.id
                  ];

                if (
                  !edit
                ) {
                  return null;
                }

                return (
                  <FcPanel
                    key={
                      fixture.id
                    }
                    className="p-4 sm:p-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Home
                        </span>

                        <select
                          value={
                            edit.homeRegistrationId
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              patchEdit(
                                fixture.id,
                                {
                                  homeRegistrationId:
                                    event
                                      .target
                                      .value,
                                },
                              )
                          }
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                        >
                          {participants.map(
                            (
                              participant,
                            ) => (
                              <option
                                key={
                                  participant.registrationId
                                }
                                value={
                                  participant.registrationId
                                }
                              >
                                {
                                  participant.name
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>


                      <span className="pb-3 text-center text-xs font-medium text-[#6F7B8A]">
                        VS
                      </span>


                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Away
                        </span>

                        <select
                          value={
                            edit.awayRegistrationId
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              patchEdit(
                                fixture.id,
                                {
                                  awayRegistrationId:
                                    event
                                      .target
                                      .value,
                                },
                              )
                          }
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                        >
                          {participants.map(
                            (
                              participant,
                            ) => (
                              <option
                                key={
                                  participant.registrationId
                                }
                                value={
                                  participant.registrationId
                                }
                              >
                                {
                                  participant.name
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>


                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Matchday
                        </span>

                        <input
                          type="number"
                          min="1"
                          value={
                            edit.roundNumber
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              patchEdit(
                                fixture.id,
                                {
                                  roundNumber:
                                    Number(
                                      event
                                        .target
                                        .value,
                                    ),
                                },
                              )
                          }
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                        />
                      </label>


                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Date & Time
                        </span>

                        <input
                          type="datetime-local"
                          value={
                            edit.scheduledAt
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              patchEdit(
                                fixture.id,
                                {
                                  scheduledAt:
                                    event
                                      .target
                                      .value,
                                },
                              )
                          }
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                        />
                      </label>
                    </div>


                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#253140] pt-4">
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void swap(
                            fixture.id,
                          )
                        }
                        className="min-h-10 rounded-[10px] border border-[#253140] px-3 text-xs font-medium text-[#A7B0BE]"
                      >
                        Swap Home/Away
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void saveEdit(
                            fixture,
                          )
                        }
                        className="min-h-10 rounded-[10px] border border-sky-400/25 px-3 text-xs font-medium text-[#38BDF8]"
                      >
                        Save Changes
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void remove(
                            fixture.id,
                          )
                        }
                        className="min-h-10 rounded-[10px] border border-red-400/20 px-3 text-xs font-medium text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </FcPanel>
                );
              },
            )}


            {byeParticipants.map(
              (
                participant,
              ) => (
                <FcPanel
                  key={
                    `bye-${participant.registrationId}-${currentRound}`
                  }
                  className="border-dashed p-4"
                >
                  <div className="flex items-center gap-3">
                    <FcCrest
                      name={
                        participant.name
                      }
                      imageUrl={
                        participant.logoUrl
                      }
                      size="sm"
                    />

                    <p className="font-medium">
                      {
                        participant.name
                      }
                    </p>

                    <span className="ml-auto rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 text-xs font-medium text-amber-300">
                      BYE
                    </span>
                  </div>
                </FcPanel>
              ),
            )}
          </section>
        ) : (
          <FcPanel className="border-dashed p-8 text-center">
            <p className="text-sm font-medium text-[#F8FAFC]">
              No draft matches yet
            </p>

            <p className="mt-2 text-sm text-[#6F7B8A]">
              {draft.method ===
              'MANUAL'
                ? 'Use Add Match to create the manual fixture list.'
                : 'Regenerate the preview or return to Fixture Rules.'}
            </p>
          </FcPanel>
        )}


        <div className="flex items-center justify-between border-t border-[#253140] pt-5">
          <button
            type="button"
            onClick={() =>
              router.push(
                '/fixtures/generate/rules',
              )
            }
            className="min-h-11 rounded-[10px] px-4 text-sm font-medium text-[#A7B0BE] hover:bg-[#151C26]"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              fixtures.length ===
              0
            }
            onClick={() =>
              router.push(
                '/fixtures/generate/save',
              )
            }
            className="min-h-11 rounded-[10px] bg-[#38BDF8] px-5 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9] disabled:opacity-40"
          >
            Continue to Save →
          </button>
        </div>
      </FixtureGeneratorShell>
    </AppShell>
  );
}
