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


interface Tournament {
  id: string;
  name: string;
  code: string;
  isLeagueAdmin: boolean;
}


interface Standing {
  registrationId: string;
  entryName: string;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  points: number;
}


interface GroupEntry {
  id: string;
  entryName: string | null;

  members: Array<{
    fullName: string;
    inGameName: string | null;
  }>;
}


interface TournamentGroup {
  id: string;
  name: string;
  position: number;

  entries: GroupEntry[];
}


type PlayoffFixture =
  FixtureForUi & {
    group: {
      id: string;
      name: string;
      position: number;
    } | null;
  };


function displayName(
  entry: GroupEntry,
) {
  return (
    entry.entryName ||
    entry.members[0]?.inGameName ||
    entry.members[0]?.fullName ||
    'Tournament Entry'
  );
}


function isPowerOfTwo(
  value: number,
) {
  return (
    value >= 2 &&
    (value & (value - 1)) === 0
  );
}


export default function PlayoffsPage() {
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
    groups,
    setGroups,
  ] =
    useState<TournamentGroup[]>(
      [],
    );


  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>(
      [],
    );


  const [
    fixtures,
    setFixtures,
  ] =
    useState<PlayoffFixture[]>(
      [],
    );


  const [
    qualifiersPerGroup,
    setQualifiersPerGroup,
  ] =
    useState(1);


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
            PlayoffFixture[];
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


        const [
          tournamentResponse,
          groupResponse,
          standingsResponse,
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

              data: {
                groups:
                  TournamentGroup[];
              };

              error: null;
            }>(
              `/tournaments/${tournamentId}/groups`,
            ),

            authenticatedRequest<{
              success: true;

              data: {
                standings:
                  Standing[];
              };

              error: null;
            }>(
              `/tournaments/${tournamentId}/standings`,
            ),
          ]);


        setTournament(
          tournamentResponse
            .data
            .tournament,
        );


        const loadedGroups =
          groupResponse
            .data
            .groups
            .sort(
              (
                a,
                b,
              ) =>
                a.position -
                b.position,
            );


        setGroups(
          loadedGroups,
        );


        setStandings(
          standingsResponse
            .data
            .standings,
        );


        if (
          loadedGroups.length >
          0
        ) {
          const minimum =
            Math.min(
              ...loadedGroups.map(
                (group) =>
                  group.entries.length,
              ),
            );


          const options =
            [
              1,
              2,
              4,
              8,
              16,
              32,
            ].filter(
              (value) =>
                value <=
                  minimum &&
                isPowerOfTwo(
                  value *
                    loadedGroups.length,
                ),
            );


          if (
            options.length >
            0
          ) {
            const preferred =
              options.filter(
                (value) =>
                  value <= 8,
              );

            setQualifiersPerGroup(
              preferred[
                preferred.length -
                  1
              ] ??
                options[
                  options.length -
                    1
                ],
            );
          }
        }


        await loadFixtures();
      } catch {
        router.replace(
          `/tournaments/${tournamentId}`,
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


  const groupFixtures =
    useMemo(
      () =>
        fixtures.filter(
          (fixture) =>
            fixture.group !==
            null,
        ),
      [
        fixtures,
      ],
    );


  const playoffFixtures =
    useMemo(
      () =>
        fixtures.filter(
          (fixture) =>
            fixture.group ===
            null,
        ),
      [
        fixtures,
      ],
    );


  const incompleteGroupFixtures =
    groupFixtures.filter(
      (fixture) =>
        fixture.status !==
        'COMPLETED',
    ).length;


  const validQualifierOptions =
    useMemo(
      () => {
        if (
          groups.length <
          2
        ) {
          return [];
        }


        const minimum =
          Math.min(
            ...groups.map(
              (group) =>
                group.entries.length,
            ),
          );


        return [
          1,
          2,
          4,
          8,
          16,
          32,
        ].filter(
          (value) =>
            value <= minimum &&
            isPowerOfTwo(
              value *
                groups.length,
            ),
        );
      },
      [
        groups,
      ],
    );


  const standingLookup =
    useMemo(
      () =>
        new Map(
          standings.map(
            (standing) => [
              standing.registrationId,
              standing,
            ],
          ),
        ),
      [
        standings,
      ],
    );


  const rankedGroups =
    useMemo(
      () =>
        groups.map(
          (group) => {
            const ranked =
              group.entries
                .map(
                  (entry) => {
                    const standing =
                      standingLookup.get(
                        entry.id,
                      );


                    return {
                      registrationId:
                        entry.id,

                      entryName:
                        standing
                          ?.entryName ||
                        displayName(
                          entry,
                        ),

                      points:
                        standing
                          ?.points ??
                        0,

                      goalDifference:
                        standing
                          ?.goalDifference ??
                        0,

                      goalsFor:
                        standing
                          ?.goalsFor ??
                        0,

                      wins:
                        standing
                          ?.wins ??
                        0,
                    };
                  },
                )
                .sort(
                  (
                    a,
                    b,
                  ) => {
                    if (
                      b.points !==
                      a.points
                    ) {
                      return (
                        b.points -
                        a.points
                      );
                    }

                    if (
                      b.goalDifference !==
                      a.goalDifference
                    ) {
                      return (
                        b.goalDifference -
                        a.goalDifference
                      );
                    }

                    if (
                      b.goalsFor !==
                      a.goalsFor
                    ) {
                      return (
                        b.goalsFor -
                        a.goalsFor
                      );
                    }

                    if (
                      b.wins !==
                      a.wins
                    ) {
                      return (
                        b.wins -
                        a.wins
                      );
                    }

                    return a.entryName.localeCompare(
                      b.entryName,
                    );
                  },
                );


            return {
              ...group,

              ranked,

              qualifiers:
                ranked.slice(
                  0,
                  qualifiersPerGroup,
                ),
            };
          },
        ),
      [
        groups,
        standingLookup,
        qualifiersPerGroup,
      ],
    );


  const totalQualifiers =
    qualifiersPerGroup *
    groups.length;


  const firstRoundPairs =
    useMemo(
      () => {
        if (
          rankedGroups.length !==
          2
        ) {
          return [];
        }


        const groupA =
          rankedGroups[0];

        const groupB =
          rankedGroups[1];


        const pairs: Array<{
          home: string;
          away: string;
        }> = [];


        for (
          let rank = 0;
          rank <
          qualifiersPerGroup;
          rank++
        ) {
          const reverse =
            qualifiersPerGroup -
            1 -
            rank;


          if (
            rank >
            reverse
          ) {
            break;
          }


          if (
            rank === reverse
          ) {
            pairs.push({
              home:
                groupA.qualifiers[
                  rank
                ]?.entryName ??
                'TBD',

              away:
                groupB.qualifiers[
                  rank
                ]?.entryName ??
                'TBD',
            });

            continue;
          }


          pairs.push({
            home:
              groupA.qualifiers[
                rank
              ]?.entryName ??
              'TBD',

            away:
              groupB.qualifiers[
                reverse
              ]?.entryName ??
              'TBD',
          });


          pairs.push({
            home:
              groupB.qualifiers[
                rank
              ]?.entryName ??
              'TBD',

            away:
              groupA.qualifiers[
                reverse
              ]?.entryName ??
              'TBD',
          });
        }


        return pairs;
      },
      [
        rankedGroups,
        qualifiersPerGroup,
      ],
    );


  const playoffRounds =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            PlayoffFixture[]
          >();


        for (
          const fixture
          of playoffFixtures
        ) {
          if (
            !map.has(
              fixture.roundName,
            )
          ) {
            map.set(
              fixture.roundName,
              [],
            );
          }


          map.get(
            fixture.roundName,
          )!.push(
            fixture,
          );
        }


        return Array.from(
          map.entries(),
        ).sort(
          (
            [, a],
            [, b],
          ) =>
            (a[0]?.roundNumber ??
              0) -
            (b[0]?.roundNumber ??
              0),
        );
      },
      [
        playoffFixtures,
      ],
    );


  async function generatePlayoffs() {
    if (
      incompleteGroupFixtures >
      0
    ) {
      setError(
        `Complete all group fixtures first. ${incompleteGroupFixtures} match(es) are still incomplete.`,
      );

      return;
    }


    const confirmed =
      window.confirm(
        `Generate knockout stage with ${qualifiersPerGroup} qualifier(s) from each group?`,
      );


    if (!confirmed) {
      return;
    }


    setBusy(true);
    setMessage('');
    setError('');


    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
            totalQualifiers: number;
            fixtures: number;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/playoffs/generate`,
          {
            method:
              'POST',

            body:
              JSON.stringify({
                qualifiersPerGroup,
              }),
          },
        );


      setMessage(
        `${response.data.message} ${response.data.totalQualifiers} qualifiers â†’ ${response.data.fixtures} knockout fixtures.`,
      );


      await loadFixtures();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate playoffs.',
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
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Playoff Center...
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
      <div className="space-y-7">

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="text-sm font-black text-slate-500 hover:text-white"
        >
          â† Back
        </button>


        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-6 md:p-8">

          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Knockout Stage
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] md:text-5xl">
            Playoff Center
          </h1>

          <p className="mt-3 text-xl font-black">
            {
              tournament.name
            }
          </p>

          <p className="mt-1 font-mono text-xs text-slate-600">
            {
              tournament.code
            }
          </p>


          <div className="mt-6 flex flex-wrap gap-2">

            <Link
              href={`/tournaments/${tournamentId}/groups`}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400"
            >
              Groups
            </Link>

            <Link
              href={`/tournaments/${tournamentId}/standings`}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400"
            >
              Standings
            </Link>

            <Link
              href={`/tournaments/${tournamentId}/fixtures`}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400"
            >
              Fixtures
            </Link>
            <Link
              href={`/tournaments/${tournamentId}/achievements`}
              className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-sm font-black text-amber-300"
            >
              Hall of Champions
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


        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Groups
            </p>

            <p className="mt-2 text-3xl font-black">
              {
                groups.length
              }
            </p>
          </article>


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Group Matches
            </p>

            <p className="mt-2 text-3xl font-black">
              {
                groupFixtures.length
              }
            </p>
          </article>


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Remaining
            </p>

            <p className={`mt-2 text-3xl font-black ${
              incompleteGroupFixtures ===
              0
                ? 'text-emerald-300'
                : 'text-amber-300'
            }`}>
              {
                incompleteGroupFixtures
              }
            </p>
          </article>


          <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
            <p className="text-xs text-slate-600">
              Knockout Fixtures
            </p>

            <p className="mt-2 text-3xl font-black text-sky-300">
              {
                playoffFixtures.length
              }
            </p>
          </article>

        </section>


        {playoffFixtures.length ===
        0 ? (
          <>
            <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-6">

              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Qualification Rules
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Qualifiers Per Group
              </h2>


              <div className="mt-5 flex flex-wrap gap-2">

                {validQualifierOptions.map(
                  (
                    value,
                  ) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        setQualifiersPerGroup(
                          value,
                        )
                      }
                      className={`rounded-xl px-5 py-3 font-black ${
                        qualifiersPerGroup ===
                        value
                          ? 'bg-sky-400 text-[#041019]'
                          : 'border border-white/10 text-slate-400'
                      }`}
                    >
                      Top {
                        value
                      }
                    </button>
                  ),
                )}

              </div>


              <div className="mt-6 rounded-2xl bg-white/[0.03] p-5">

                <p className="text-sm text-slate-500">
                  Total Qualified
                </p>

                <p className="mt-1 text-4xl font-black">
                  {
                    totalQualifiers
                  }
                </p>

                <p className="mt-2 text-sm font-bold text-sky-400">
                  {totalQualifiers ===
                  16
                    ? 'Round of 16'
                    : totalQualifiers ===
                        8
                      ? 'Quarter Final'
                      : totalQualifiers ===
                          4
                        ? 'Semi Final'
                        : `${totalQualifiers}-Team Knockout`}
                </p>

              </div>

            </section>


            <section>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Qualification Preview
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Qualified Entries
              </h2>


              <div className="mt-5 grid gap-5 xl:grid-cols-2">

                {rankedGroups.map(
                  (
                    group,
                  ) => (
                    <article
                      key={
                        group.id
                      }
                      className="overflow-hidden rounded-[26px] border border-white/10 bg-[#0a1018]"
                    >

                      <div className="border-b border-white/10 p-5">
                        <h3 className="text-2xl font-black">
                          {
                            group.name
                          }
                        </h3>

                        <p className="mt-1 text-xs text-slate-600">
                          Top {
                            qualifiersPerGroup
                          } qualify
                        </p>
                      </div>


                      <div className="divide-y divide-white/5">

                        {group.ranked.map(
                          (
                            entry,
                            index,
                          ) => {
                            const qualified =
                              index <
                              qualifiersPerGroup;


                            return (
                              <div
                                key={
                                  entry.registrationId
                                }
                                className={`grid grid-cols-[40px_1fr_auto] items-center gap-3 px-5 py-4 ${
                                  qualified
                                    ? 'bg-emerald-400/[0.025]'
                                    : ''
                                }`}
                              >

                                <span className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-black ${
                                  qualified
                                    ? 'bg-emerald-400/10 text-emerald-300'
                                    : 'bg-white/[0.03] text-slate-600'
                                }`}>
                                  {
                                    index +
                                    1
                                  }
                                </span>


                                <div className="min-w-0">
                                  <p className="truncate font-black">
                                    {
                                      entry.entryName
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-600">
                                    GD{' '}
                                    {entry.goalDifference >
                                    0
                                      ? '+'
                                      : ''}
                                    {
                                      entry.goalDifference
                                    }
                                  </p>
                                </div>


                                <div className="text-right">
                                  <p className="text-lg font-black">
                                    {
                                      entry.points
                                    }
                                  </p>

                                  <p className="text-[10px] text-slate-600">
                                    PTS
                                  </p>
                                </div>

                              </div>
                            );
                          },
                        )}

                      </div>

                    </article>
                  ),
                )}

              </div>
            </section>


            {firstRoundPairs.length >
            0 ? (
              <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-6">

                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                  First Round Preview
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Cross-Group Seeding
                </h2>


                <div className="mt-6 grid gap-3 lg:grid-cols-2">

                  {firstRoundPairs.map(
                    (
                      pair,
                      index,
                    ) => (
                      <article
                        key={
                          index
                        }
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                      >

                        <p className="text-right font-black">
                          {
                            pair.home
                          }
                        </p>

                        <span className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-400">
                          VS
                        </span>

                        <p className="font-black">
                          {
                            pair.away
                          }
                        </p>

                      </article>
                    ),
                  )}

                </div>

              </section>
            ) : null}


            {tournament.isLeagueAdmin ? (
              <section className={`rounded-[26px] border p-6 ${
                incompleteGroupFixtures ===
                0
                  ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
                  : 'border-amber-400/20 bg-amber-400/[0.04]'
              }`}>

                <h2 className="text-2xl font-black">
                  {incompleteGroupFixtures ===
                  0
                    ? 'Ready for Knockout Stage'
                    : 'Group Stage Not Finished'}
                </h2>


                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {incompleteGroupFixtures ===
                  0
                    ? `Top ${qualifiersPerGroup} from each group will qualify.`
                    : `${incompleteGroupFixtures} group fixture(s) must be completed before knockout generation.`}
                </p>


                <button
                  type="button"
                  disabled={
                    busy ||
                    incompleteGroupFixtures >
                      0 ||
                    validQualifierOptions.length ===
                      0
                  }
                  onClick={() =>
                    void generatePlayoffs()
                  }
                  className="mt-5 rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-40"
                >
                  {busy
                    ? 'Generating Knockout...'
                    : 'Generate Knockout Stage'}
                </button>

              </section>
            ) : null}

          </>
        ) : (
          <section className="space-y-8">

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                Knockout Bracket
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Road to the Final
              </h2>
            </div>


            {playoffRounds.map(
              ([
                roundName,
                roundFixtures,
              ]) => (
                <article
                  key={
                    roundName
                  }
                  className="rounded-[26px] border border-white/10 bg-[#0a1018] p-5 md:p-6"
                >

                  <div className="flex items-center justify-between">

                    <h3 className="text-2xl font-black">
                      {
                        roundName
                      }
                    </h3>

                    <span className="rounded-full bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300">
                      {
                        roundFixtures.length
                      }{' '}
                      Match
                      {roundFixtures.length ===
                      1
                        ? ''
                        : 'es'}
                    </span>

                  </div>


                  <div className="mt-5 grid gap-4 xl:grid-cols-2">

                    {roundFixtures
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
        )}

      </div>
    </AppShell>
  );
}