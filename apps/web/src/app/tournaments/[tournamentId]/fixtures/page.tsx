'use client';

import { TournamentFormatGuide } from '@/components/tournaments/tournament-format-guide';
import type { TournamentFormatDescription } from '@/lib/tournament-format-guide';
import Link from 'next/link';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useMemo,
  useCallback,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { TournamentNavigation } from '@/components/tournaments/tournament-navigation';

import {
  FixtureCard,
  type FixtureForUi,
} from '@/components/tournaments/fixture-card';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';
import { FcLoadingScreen, FcNotice } from '@/components/fc/fc-ui';
import { TournamentFixtureStart } from '@/components/tournaments/tournament-fixture-start';
import type { EntryLimitTournament } from '@/components/tournaments/tournament-entry-limit';


type GroupFixture =
  FixtureForUi & {
    group: {
      id: string;
      name: string;
      position: number;
    } | null;
  };


interface Tournament extends EntryLimitTournament {
  id: string;
  leagueId: string;
  name: string;
  code: string;
  status: string;
  fixturesGeneratedAt: string | null;
  competitionFormat: string;
  formatGuide?: TournamentFormatDescription | null;
  legType: string;

  dailyMatchLimit: number;
  matchesPerParticipantPerDay: number;
  matchDurationMinutes: number;

  isLeagueAdmin: boolean;
  canManageFixtures: boolean;

  league: {
    id: string;
    name: string;
    code: string;
  };
}


export default function TournamentFixturesPage() {
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
    fixtures,
    setFixtures,
  ] =
    useState<GroupFixture[]>(
      [],
    );

  const [
    selectedGroup,
    setSelectedGroup,
  ] =
    useState('ALL');

  const [
    selectedMatchday,
    setSelectedMatchday,
  ] =
    useState('ALL');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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


  const loadFixtures = useCallback(async () => {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          fixtures: GroupFixture[];
          competitionFormat?: string;
          legType?: string;
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}/fixtures`,
      );

    setFixtures(response.data.fixtures.map(fixture => ({
      ...fixture,
      competitionFormat: response.data.competitionFormat,
      legType: response.data.legType,
    })));
  }, [tournamentId]);


  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(
          current,
        );

        const tournamentResponse =
          await authenticatedRequest<{
            success: true;

            data: {
              tournament:
                Tournament;
            };

            error: null;
          }>(
            `/tournaments/${tournamentId}`,
          );

        setTournament(
          tournamentResponse
            .data
            .tournament,
        );

        await loadFixtures();
      } catch {
        router.replace(
          '/tournaments',
        );
      } finally {
        setLoading(
          false,
        );
      }
    }

    void load();
  }, [
    loadFixtures,
    router,
    tournamentId,
  ]);


  useEffect(() => {
    let cancelled =
      false;

    async function syncOpponentFixtureUpdates() {
      if (
        document.visibilityState ===
        'hidden'
      ) {
        return;
      }

      try {
        const response =
          await authenticatedRequest<{
            success: true;

            data: {
              fixtures: GroupFixture[];
              competitionFormat?: string;
              legType?: string;
            };

            error: null;
          }>(
            `/tournaments/${tournamentId}/fixtures`,
          );

        if (
          !cancelled
        ) {
          setFixtures(response.data.fixtures.map(fixture => ({
            ...fixture,
            competitionFormat: response.data.competitionFormat,
            legType: response.data.legType,
          })));
        }
      } catch {
        // Keep the current fixture list.
        // The next focus/poll can retry.
      }
    }

    const interval =
      window.setInterval(
        () => {
          void syncOpponentFixtureUpdates();
        },
        15_000,
      );

    const onFocus =
      () => {
        void syncOpponentFixtureUpdates();
      };

    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void syncOpponentFixtureUpdates();
        }
      };

    window.addEventListener(
      'focus',
      onFocus,
    );

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );

    return () => {
      cancelled =
        true;

      window.clearInterval(
        interval,
      );

      window.removeEventListener(
        'focus',
        onFocus,
      );

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
    };
  }, [
    tournamentId,
  ]);


  const groups =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            {
              id: string;
              name: string;
              position: number;
            }
          >();

        for (
          const fixture
          of fixtures
        ) {
          if (
            fixture.group
          ) {
            map.set(
              fixture.group.id,
              fixture.group,
            );
          }
        }

        return Array.from(
          map.values(),
        ).sort(
          (
            a,
            b,
          ) =>
            a.position -
            b.position,
        );
      },
      [
        fixtures,
      ],
    );


  const filteredByGroup =
    useMemo(
      () => {
        if (
          selectedGroup ===
          'ALL'
        ) {
          return fixtures;
        }

        return fixtures.filter(
          (fixture) =>
            fixture.group
              ?.id ===
            selectedGroup,
        );
      },
      [
        fixtures,
        selectedGroup,
      ],
    );


  const isDoubleLeg =
    tournament?.competitionFormat ===
      'DOUBLE_ROUND_ROBIN' ||
    tournament?.legType ===
      'HOME_AWAY';

  const competitionLabel =
    isDoubleLeg
      ? 'Double Leg · Home & Away'
      : 'Single Leg';

  const legBoundaryByGroup =
    useMemo(
      () => {
        const maximums =
          new Map<string, number>();

        if (!isDoubleLeg) {
          return maximums;
        }

        for (
          const fixture
          of fixtures
        ) {
          if (
            typeof fixture.matchday !==
            'number'
          ) {
            continue;
          }

          const scope =
            fixture.group?.id ??
            'SINGLE';

          maximums.set(
            scope,
            Math.max(
              maximums.get(
                scope,
              ) ?? 0,
              fixture.matchday,
            ),
          );
        }

        for (
          const [
            scope,
            maximum,
          ]
          of maximums
        ) {
          if (
            maximum % 2 ===
            0
          ) {
            maximums.set(
              scope,
              maximum / 2,
            );
          } else {
            maximums.delete(
              scope,
            );
          }
        }

        return maximums;
      },
      [
        fixtures,
        isDoubleLeg,
      ],
    );


  const matchdays =
    useMemo(
      () =>
        Array.from(
          new Set(
            filteredByGroup
              .map(
                (fixture) =>
                  fixture.matchday,
              )
              .filter(
                (
                  value,
                ): value is number =>
                  typeof value ===
                  'number',
              ),
          ),
        ).sort(
          (
            a,
            b,
          ) =>
            a - b,
        ),
      [
        filteredByGroup,
      ],
    );


  const visibleFixtures =
    useMemo(
      () => {
        if (
          selectedMatchday ===
          'ALL'
        ) {
          return filteredByGroup;
        }

        return filteredByGroup.filter(
          (fixture) =>
            fixture.matchday ===
            Number(
              selectedMatchday,
            ),
        );
      },
      [
        filteredByGroup,
        selectedMatchday,
      ],
    );


  const groupedFixtures =
    useMemo(
      () => {
        const result =
          new Map<
            string,
            {
              groupId: string;
              groupName: string;
              groupPosition: number;
              matchdays: Map<
                number,
                GroupFixture[]
              >;
            }
          >();

        for (
          const fixture
          of visibleFixtures
        ) {
          const groupKey =
            fixture.group
              ?.id ??
            'SINGLE';

          const groupName =
            fixture.group
              ?.name ??
            'Tournament Fixtures';

          const groupPosition =
            fixture.group
              ?.position ??
            1;

          if (
            !result.has(
              groupKey,
            )
          ) {
            result.set(
              groupKey,
              {
                groupId:
                  groupKey,
                groupName,
                groupPosition,
                matchdays:
                  new Map(),
              },
            );
          }

          const matchday =
            fixture.matchday ??
            fixture.roundNumber;

          const group =
            result.get(
              groupKey,
            )!;

          if (
            !group.matchdays.has(
              matchday,
            )
          ) {
            group.matchdays.set(
              matchday,
              [],
            );
          }

          group.matchdays
            .get(
              matchday,
            )!
            .push(
              fixture,
            );
        }

        return Array.from(
          result.values(),
        ).sort(
          (
            a,
            b,
          ) =>
            a.groupPosition -
            b.groupPosition,
        );
      },
      [
        visibleFixtures,
      ],
    );


  function selectGroup(
    groupId: string,
  ) {
    setSelectedGroup(
      groupId,
    );

    setSelectedMatchday(
      'ALL',
    );
  }


  async function updateSettings(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!tournament) {
      return;
    }

    const data =
      new FormData(
        event.currentTarget,
      );

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/scheduling-settings`,
          {
            method:
              'PATCH',

            body:
              JSON.stringify({
                dailyMatchLimit:
                  Number(
                    data.get(
                      'dailyMatchLimit',
                    ),
                  ),

                matchesPerParticipantPerDay:
                  Number(
                    data.get(
                      'matchesPerParticipantPerDay',
                    ),
                  ),

                matchDurationMinutes:
                  Number(
                    data.get(
                      'matchDurationMinutes',
                    ),
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      const updated =
        await authenticatedRequest<{
          success: true;

          data: {
            tournament:
              Tournament;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}`,
        );

      setTournament(
        updated.data.tournament,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update scheduling settings.',
      );
    } finally {
      setBusy(false);
    }
  }


  if (
    loading ||
    !user ||
    !tournament
  ) {
    return (
      <AppShell currentUser={user ?? undefined}>
        <FcLoadingScreen label="Loading fixtures…" embedded />
      </AppShell>
    );
  }


  return (
    <AppShell
      currentUser={user}
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="fc-tournament-fixtures space-y-6">
        <BackHeader
          backHref={'/tournaments/' + tournamentId}
          backLabel="Tournament overview"
          eyebrow="Fixture center"
          title={tournament.name}
          subtitle={competitionLabel + (isDoubleLeg ? ' · Both legs count toward the standings' : '')}
        />
        <TournamentNavigation tournamentId={tournamentId} />
        <TournamentFixtureStart tournament={tournament} />
        <TournamentFormatGuide guide={tournament.formatGuide} compact />

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>


        {tournament.isLeagueAdmin ? (
          <section className="theme-panel rounded-2xl border p-5">

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Admin
              </p>

              <h2 className="mt-1 text-xl font-black">
                Scheduling Rules
              </h2>
            </div>

            <form
              onSubmit={
                updateSettings
              }
              className="mt-5 grid gap-3 md:grid-cols-3"
            >
              <label className="grid gap-2 text-xs font-bold text-slate-500">
                DAILY MATCH LIMIT

                <input
                  name="dailyMatchLimit"
                  type="number"
                  min="1"
                  max="256"
                  defaultValue={
                    tournament.dailyMatchLimit
                  }
                  required
                  className="theme-input min-h-11 rounded-xl border px-4 text-sm"
                />
              </label>


              <label className="grid gap-2 text-xs font-bold text-slate-500">
                MATCHES / ENTRY / DAY

                <input
                  name="matchesPerParticipantPerDay"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue={
                    tournament.matchesPerParticipantPerDay
                  }
                  required
                  className="theme-input min-h-11 rounded-xl border px-4 text-sm"
                />
              </label>


              <label className="grid gap-2 text-xs font-bold text-slate-500">
                MATCH DURATION

                <input
                  name="matchDurationMinutes"
                  type="number"
                  min="10"
                  max="300"
                  defaultValue={
                    tournament.matchDurationMinutes
                  }
                  required
                  className="theme-input min-h-11 rounded-xl border px-4 text-sm"
                />
              </label>


              <button
                type="submit"
                disabled={
                  busy
                }
                className="theme-primary-button min-h-11 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 md:col-span-3"
              >
                Save Scheduling Rules
              </button>
            </form>

          </section>
        ) : null}


        <section className="theme-panel rounded-2xl border p-5">

          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Group Filter
          </p>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">

            <button
              type="button"
              onClick={() =>
                selectGroup(
                  'ALL',
                )
              }
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black ${
                selectedGroup ===
                'ALL'
                  ? 'bg-sky-400 text-[#041019]'
                  : 'border border-white/10 text-slate-400'
              }`}
            >
              All Groups
            </button>


            {groups.map(
              (group) => (
                <button
                  key={
                    group.id
                  }
                  type="button"
                  onClick={() =>
                    selectGroup(
                      group.id,
                    )
                  }
                  className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black ${
                    selectedGroup ===
                    group.id
                      ? 'bg-sky-400 text-[#041019]'
                      : 'border border-white/10 text-slate-400'
                  }`}
                >
                  {
                    group.name
                  }
                </button>
              ),
            )}

          </div>


          <div className="mt-5 border-t border-white/10 pt-5">

            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Matchday
            </p>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">

              <button
                type="button"
                aria-pressed={selectedMatchday === 'ALL'}
                onClick={() =>
                  setSelectedMatchday(
                    'ALL',
                  )
                }
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black ${
                  selectedMatchday ===
                  'ALL'
                    ? 'theme-primary-button'
                    : 'theme-secondary-button'
                }`}
              >
                All
              </button>


              {matchdays.map(
                (
                  matchday,
                ) => (
                  <button
                    key={
                      matchday
                    }
                    type="button"
                    aria-pressed={selectedMatchday === String(matchday)}
                    onClick={() =>
                      setSelectedMatchday(
                        String(
                          matchday,
                        ),
                      )
                    }
                    className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black ${
                      selectedMatchday ===
                      String(
                        matchday,
                      )
                        ? 'theme-primary-button'
                        : 'theme-secondary-button'
                    }`}
                  >
                    MD {
                      matchday
                    }
                  </button>
                ),
              )}

            </div>
          </div>

        </section>


        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <article className="theme-panel rounded-2xl border p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Fixtures
            </p>

            <p className="mt-2 text-3xl font-black">
              {
                visibleFixtures.length
              }
            </p>
          </article>


          <article className="theme-panel rounded-2xl border p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Groups
            </p>

            <p className="mt-2 text-3xl font-black">
              {
                groups.length ||
                1
              }
            </p>
          </article>


          <article className="theme-panel rounded-2xl border p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Scheduled
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-300">
              {
                visibleFixtures.filter(
                  (fixture) =>
                    Boolean(
                      fixture.scheduledAt,
                    ),
                ).length
              }
            </p>
          </article>


          <article className="theme-panel rounded-2xl border p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Completed
            </p>

            <p className="mt-2 text-3xl font-black text-sky-300">
              {
                visibleFixtures.filter(
                  (fixture) =>
                    fixture.status ===
                    'COMPLETED',
                ).length
              }
            </p>
          </article>

        </section>


        {groupedFixtures.length ===
        0 ? (
          <section className="rounded-[24px] border border-dashed border-white/10 p-12 text-center">

            <p className="text-lg font-black text-slate-300">
              No fixtures available.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Create fixtures with the approved teams whenever you are ready.
            </p>

            <Link
              href={`/tournaments/${tournamentId}/groups`}
              scroll
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#041019]"
            >
              Open Group Manager
            </Link>

          </section>
        ) : (
          <div className="space-y-8">

            {groupedFixtures.map(
              (
                group,
              ) => (
                <section
                  key={
                    group.groupName
                  }
                  className="space-y-5"
                >

                  <div className="flex items-end justify-between border-b border-white/10 pb-4">

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                        Competition Group
                      </p>

                      <h2 className="mt-1 text-3xl font-black">
                        {
                          group.groupName
                        }
                      </h2>
                    </div>

                    <p className="text-xs font-black text-slate-600">
                      {
                        Array.from(
                          group.matchdays.values(),
                        ).reduce(
                          (
                            total,
                            items,
                          ) =>
                            total +
                            items.length,
                          0,
                        )
                      }{' '}
                      Fixtures
                    </p>

                  </div>


                  {Array.from(
                    group.matchdays.entries(),
                  )
                    .sort(
                      (
                        [a],
                        [b],
                      ) =>
                        a - b,
                    )
                    .map(
                      ([
                        matchday,
                        items,
                      ]) => (
                        <article
                          key={
                            matchday
                          }
                          className="theme-panel rounded-2xl border p-5 md:p-6"
                        >

                          <div className="flex items-center justify-between gap-4">

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                  Matchday
                                </p>

                                {isDoubleLeg &&
                                legBoundaryByGroup.get(
                                  group.groupId,
                                ) ? (
                                  <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                                    {
                                      matchday <=
                                      legBoundaryByGroup.get(
                                        group.groupId,
                                      )!
                                        ? 'Leg 1'
                                        : 'Leg 2'
                                    }
                                  </span>
                                ) : null}
                              </div>

                              <h3 className="mt-1 text-2xl font-black">
                                Matchday {
                                  matchday
                                }
                              </h3>
                            </div>


                            <span className="rounded-full bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-400">
                              {
                                items.length
                              }{' '}
                              Matches
                            </span>

                          </div>


                          <div className="mt-5 grid gap-4 xl:grid-cols-2">

                            {items
                              .sort(
                                (
                                  a,
                                  b,
                                ) =>
                                  a.bracketPosition -
                                  b.bracketPosition,
                              )
                              .map(
                                (
                                  fixture,
                                ) => (
                                  <FixtureCard
                                    key={
                                      fixture.id
                                    }
                                    fixture={
                                      fixture
                                    }
                                    isAdmin={
                                      tournament.canManageFixtures
                                    }
                                    onChanged={
                                      loadFixtures
                                    }
                                  />
                                ),
                              )}

                          </div>

                        </article>
                      ),
                    )}

                </section>
              ),
            )}

          </div>
        )}

      </div>
    </AppShell>
  );
}
