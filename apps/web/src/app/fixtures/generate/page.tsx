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
  FcEmptyState,
  FcLoadingScreen,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  loadFixtureGeneratorDraft,
  saveFixtureGeneratorDraft,
  type FixtureGeneratorDraft,
} from '@/lib/fixture-generator-draft';


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
  mode: string;
  competitionFormat: string;
  groupMode: string;
  maxEntries: number;
}


interface Group {
  id: string;
  name: string;
  entries: unknown[];
}


export default function FixtureGeneratorSetupPage() {
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
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<Tournament[]>(
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
    draft,
    setDraft,
  ] =
    useState<FixtureGeneratorDraft>(
      () =>
        loadFixtureGeneratorDraft(),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagues,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              '/leagues/my',
            ),
          ]);

        setUser(
          current,
        );

        const adminLeagues:
          Membership[] =
          leagues
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

        setMemberships(
          adminLeagues,
        );

        if (
          !draft.leagueId &&
          adminLeagues[0]
        ) {
          setDraft(
            (
              value,
            ) => ({
              ...value,
              leagueId:
                adminLeagues[0]
                  .league
                  .id,
            }),
          );
        }
      } catch {
        router.replace(
          '/fixtures',
        );
      } finally {
        setLoading(
          false,
        );
      }
    })();
  }, [
    router,
  ]);


  const effectiveLeagueId =
    draft.leagueId ||
    memberships[0]
      ?.league
      .id ||
    '';


  useEffect(() => {
    if (
      !effectiveLeagueId
    ) {
      setTournaments(
        [],
      );

      return;
    }

    void (async () => {
      try {
        const response =
          await authenticatedRequest<any>(
            `/leagues/${effectiveLeagueId}/tournaments`,
          );

        const values:
          Tournament[] =
          response
            .data
            .tournaments
            .filter(
              (
                tournament:
                  Tournament,
              ) =>
                tournament.status ===
                'DRAFT',
            );

        setTournaments(
          values,
        );

        if (
          draft.tournamentId &&
          !values.some(
            (
              tournament,
            ) =>
              tournament.id ===
              draft.tournamentId,
          )
        ) {
          setDraft(
            (
              value,
            ) => ({
              ...value,
              tournamentId:
                '',
              groupId:
                null,
              selectedRegistrationIds:
                [],
              participants:
                [],
            }),
          );
        }
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Tournaments.',
        );
      }
    })();
  }, [
    effectiveLeagueId,
  ]);


  useEffect(() => {
    if (
      !draft.tournamentId
    ) {
      setGroups(
        [],
      );

      return;
    }

    void authenticatedRequest<any>(
      `/tournaments/${draft.tournamentId}/groups`,
    )
      .then(
        (
          response,
        ) => {
          setGroups(
            response
              .data
              .groups ??
              [],
          );
        },
      )
      .catch(
        () =>
          setGroups(
            [],
          ),
      );
  }, [
    draft.tournamentId,
  ]);


  const selectedTournament =
    useMemo(
      () =>
        tournaments.find(
          (
            tournament,
          ) =>
            tournament.id ===
            draft.tournamentId,
        ) ??
        null,
      [
        draft.tournamentId,
        tournaments,
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


  function next() {
    setError(
      '',
    );

    const name =
      draft.fixtureListName
        .trim();

    if (
      name.length <
      3
    ) {
      setError(
        'Fixture List Name must contain at least 3 characters.',
      );

      return;
    }

    if (
      !draft.leagueId ||
      !draft.tournamentId
    ) {
      setError(
        'Select a League and Draft Tournament.',
      );

      return;
    }

    if (
      !Number.isInteger(
        draft.participantCount,
      ) ||
      draft.participantCount <
        2 ||
      draft.participantCount >
        128
    ) {
      setError(
        'Participant count must be between 2 and 128.',
      );

      return;
    }

    if (
      draft.scope ===
        'GROUP' &&
      !draft.groupId
    ) {
      setError(
        'Select the Tournament Group to generate.',
      );

      return;
    }

    const nextDraft = {
      ...draft,
      fixtureListName:
        name,
      leagueId:
        effectiveLeagueId,
    };

    saveFixtureGeneratorDraft(
      nextDraft,
    );

    router.push(
      '/fixtures/generate/participants',
    );
  }


  if (
    loading ||
    !user
  ) {
    return (
      <FcLoadingScreen
        label="Loading Fixture Generator..."
      />
    );
  }


  if (
    memberships.length ===
    0
  ) {
    return (
      <AppShell
        playerName={
          user.player
            ?.identity
            ?.inGameName
        }
      >
        <FixtureGeneratorShell
          step="SETUP"
          title="Create Fixture List"
          description="Fixture generation is available to authorized League administrators."
        >
          <FcEmptyState
            title="Admin access required"
            description="You need OWNER or ADMIN access in a League before creating fixtures."
            actionLabel="Open Leagues"
            actionHref="/leagues"
          />
        </FixtureGeneratorShell>
      </AppShell>
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
        step="SETUP"
        title="Create Fixture List"
        description="Choose the competition, participant count and fixture method. Nothing is generated until you review the participant list and rules."
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
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Fixture List Name
              </span>

              <input
                value={
                  draft.fixtureListName
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      fixtureListName:
                        event
                          .target
                          .value,
                    })
                }
                placeholder="FC Arena Premier League Season 1"
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC] outline-none focus:border-[#38BDF8]"
              />
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                League
              </span>

              <select
                value={
                  effectiveLeagueId
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      leagueId:
                        event
                          .target
                          .value,
                      tournamentId:
                        '',
                      groupId:
                        null,
                      selectedRegistrationIds:
                        [],
                      participants:
                        [],
                    })
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
              >
                {memberships.map(
                  (
                    membership,
                  ) => (
                    <option
                      key={
                        membership
                          .league
                          .id
                      }
                      value={
                        membership
                          .league
                          .id
                      }
                    >
                      {
                        membership
                          .league
                          .name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Tournament
              </span>

              <select
                value={
                  draft.tournamentId
                }
                onChange={
                  (
                    event,
                  ) => {
                    const tournament =
                      tournaments.find(
                        (
                          value,
                        ) =>
                          value.id ===
                          event
                            .target
                            .value,
                      );

                    update({
                      tournamentId:
                        event
                          .target
                          .value,
                      participantType:
                        tournament
                          ?.mode ===
                        'SOLO'
                          ? 'PLAYER'
                          : 'TEAM',
                      scope:
                        'TOURNAMENT',
                      groupId:
                        null,
                      selectedRegistrationIds:
                        [],
                      participants:
                        [],
                    });
                  }
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
              >
                <option value="">
                  Select Draft Tournament
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
                        tournament.name
                      }
                    </option>
                  ),
                )}
              </select>

              {tournaments.length ===
              0 ? (
                <span className="text-xs text-[#6F7B8A]">
                  Only Draft Tournaments can be edited by the fixture generator.
                </span>
              ) : null}
            </label>


            <div className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Participant Type
              </span>

              <div className="grid grid-cols-2 gap-2">
                {([
                  'TEAM',
                  'PLAYER',
                ] as const).map(
                  (
                    value,
                  ) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        update({
                          participantType:
                            value,
                        })
                      }
                      className={`min-h-11 rounded-[10px] border px-4 text-sm font-medium ${
                        draft.participantType ===
                        value
                          ? 'border-sky-400/30 bg-sky-400/[0.10] text-[#F8FAFC]'
                          : 'border-[#253140] bg-[#151C26] text-[#A7B0BE]'
                      }`}
                    >
                      {value ===
                      'TEAM'
                        ? 'Team'
                        : 'Player'}
                    </button>
                  ),
                )}
              </div>
            </div>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Number of Participants
              </span>

              <input
                type="number"
                min="2"
                max="128"
                value={
                  draft.participantCount
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      participantCount:
                        Number(
                          event
                            .target
                            .value,
                        ),
                    })
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
              />
            </label>


            <div className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Meetings
              </span>

              <div className="grid grid-cols-2 gap-2">
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
                      className={`min-h-11 rounded-[10px] border px-3 text-sm font-medium ${
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
            </div>


            <label className="grid gap-2">
              <span className="text-sm font-medium text-[#A7B0BE]">
                Fixture Type
              </span>

              <select
                value={
                  draft.method
                }
                onChange={
                  (
                    event,
                  ) =>
                    update({
                      method:
                        event
                          .target
                          .value as FixtureGeneratorDraft['method'],
                    })
                }
                className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
              >
                <option value="ROUND_ROBIN">
                  Round Robin
                </option>

                <option value="RANDOM_ROUND_ROBIN">
                  Random Round Robin
                </option>

                <option value="MANUAL">
                  Manual Pairing
                </option>
              </select>
            </label>


            {selectedTournament
              ?.groupMode ===
              'MULTIPLE_GROUPS' ? (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#A7B0BE]">
                    Generation Scope
                  </span>

                  <select
                    value={
                      draft.scope
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        update({
                          scope:
                            event
                              .target
                              .value as FixtureGeneratorDraft['scope'],
                          groupId:
                            null,
                          selectedRegistrationIds:
                            [],
                          participants:
                            [],
                        })
                    }
                    className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
                  >
                    <option value="TOURNAMENT">
                      Whole Tournament
                    </option>

                    <option value="GROUP">
                      Specific Group
                    </option>
                  </select>
                </label>


                {draft.scope ===
                'GROUP' ? (
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-[#A7B0BE]">
                      Group
                    </span>

                    <select
                      value={
                        draft.groupId ??
                        ''
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update({
                            groupId:
                              event
                                .target
                                .value ||
                              null,
                            selectedRegistrationIds:
                              [],
                            participants:
                              [],
                          })
                      }
                      className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-[#F8FAFC]"
                    >
                      <option value="">
                        Select Group
                      </option>

                      {groups.map(
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
                  </label>
                ) : null}
              </>
            ) : null}
          </div>


          {selectedTournament ? (
            <div className="mt-5 rounded-xl border border-[#253140] bg-[#151C26] p-4 text-sm text-[#A7B0BE]">
              <span className="font-semibold text-[#F8FAFC]">
                {
                  selectedTournament.name
                }
              </span>
              {' · '}
              {
                selectedTournament.competitionFormat.replaceAll(
                  '_',
                  ' ',
                )
              }
              {' · '}
              max {
                selectedTournament.maxEntries
              } entries
            </div>
          ) : null}


          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={
                next
              }
              className="min-h-11 rounded-[10px] bg-[#38BDF8] px-5 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9]"
            >
              Next — Add Participants →
            </button>
          </div>
        </FcPanel>
      </FixtureGeneratorShell>
    </AppShell>
  );
}
