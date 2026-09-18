'use client';

import Link from 'next/link';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import { AppShell } from '@/components/app/app-shell';

import {
  FixtureCard,
  type FixtureForUi,
} from '@/components/tournaments/fixture-card';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


type GroupFixture =
  FixtureForUi & {
    group: {
      id: string;
      name: string;
      position: number;
    } | null;
  };


interface Tournament {
  id: string;
  leagueId: string;
  name: string;
  code: string;
  status: string;
  fixturesGeneratedAt: string | null;

  dailyMatchLimit: number;
  matchesPerParticipantPerDay: number;
  matchDurationMinutes: number;

  isLeagueAdmin: boolean;

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


  async function loadFixtures() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          fixtures:
            GroupFixture[];
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}/fixtures`,
      );

    setFixtures(
      response.data.fixtures,
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
    router,
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
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm font-black text-slate-500">
        Loading Fixture Center...
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
      <div className="space-y-6">

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="text-sm font-black text-slate-500 transition hover:text-white"
        >
          â† Back
        </button>


        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Fixture Center
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] md:text-5xl">
            {
              tournament.name
            }
          </h1>

          <p className="mt-2 font-mono text-xs text-slate-600">
            {
              tournament.code
            }
          </p>

          <div className="mt-6 flex flex-wrap gap-3">

            <Link
              href={`/tournaments/${tournamentId}`}
              scroll
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
            >
              Overview
            </Link>

            <Link
              href={`/tournaments/${tournamentId}/groups`}
              scroll
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
            >
              Groups
            </Link>

            <Link
              href={`/tournaments/${tournamentId}/standings`}
              scroll
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
            >
              Standings
            </Link>
            <Link
              href={`/tournaments/${tournamentId}/playoffs`}
              scroll
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
            >
              Playoffs
            </Link>


          </div>
        </section>


        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}


        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}


        {tournament.isLeagueAdmin ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-5">

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
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-sm text-white"
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
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-sm text-white"
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
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-sm text-white"
                />
              </label>


              <button
                type="submit"
                disabled={
                  busy
                }
                className="rounded-xl bg-white px-4 py-3 text-sm font-black text-black disabled:opacity-50 md:col-span-3"
              >
                Save Scheduling Rules
              </button>
            </form>

          </section>
        ) : null}


        <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-5">

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
                onClick={() =>
                  setSelectedMatchday(
                    'ALL',
                  )
                }
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black ${
                  selectedMatchday ===
                  'ALL'
                    ? 'bg-white text-black'
                    : 'border border-white/10 text-slate-500'
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
                        ? 'bg-white text-black'
                        : 'border border-white/10 text-slate-500'
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

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Fixtures
            </p>

            <p className="mt-2 text-3xl font-black">
              {
                visibleFixtures.length
              }
            </p>
          </article>


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-4">
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


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-4">
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


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-4">
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
              Generate tournament fixtures from the Group Manager.
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
                          className="rounded-[26px] border border-white/10 bg-[#0a1018] p-5 md:p-6"
                        >

                          <div className="flex items-center justify-between">

                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                                Matchday
                              </p>

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
                                      tournament.isLeagueAdmin
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