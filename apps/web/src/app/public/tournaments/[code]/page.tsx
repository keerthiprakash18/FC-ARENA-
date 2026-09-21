'use client';

import Link from 'next/link';

import {
  useParams,
} from 'next/navigation';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  apiRequest,
} from '@/lib/api';

interface PublicTournamentData {
  tournament: {
    id: string;
    code: string;
    name: string;
    logoUrl: string | null;
    description: string | null;
    rules: string | null;
    mode: string;
    format: string;
    competitionFormat: string;
    status: string;
    startAt: string | null;
    endAt: string | null;

    league: {
      name: string;
      logoUrl: string | null;
      region: string | null;
    };
  };

  groups: Array<{
    id: string;
    name: string;

    entries: Array<{
      id: string;
      name: string;
      logoUrl: string | null;
    }>;
  }>;

  fixtures: Array<{
    id: string;
    fixtureCode: string;
    roundName: string;
    matchday: number | null;
    scheduledAt: string | null;
    venue: string | null;
    status: string;
    home: string;
    away: string;

    result: {
      homeScore: number;
      awayScore: number;
    } | null;
  }>;

  standings: Array<{
    position: number;
    registrationId: string;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    form: string;
  }>;

  topPlayers: Array<{
    position: number;
    name: string;
    playerCode: string | null;
    matches: number;
    wins: number;
    goalsFor: number;
    goalDifference: number;
  }>;
}

function formatCompetition(
  value: string,
) {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}

export default function PublicTournamentPage() {
  const params =
    useParams<{
      code: string;
    }>();

  const [
    data,
    setData,
  ] =
    useState<PublicTournamentData | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  useEffect(() => {
    void apiRequest<any>(
      '/public/tournaments/' +
        encodeURIComponent(
          params.code,
        ),
    )
      .then(
        (
          response,
        ) => {
          setData(
            response.data,
          );

          setError('');
        },
      )
      .catch(
        (
          err,
        ) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Tournament not found.',
          );
        },
      );
  }, [
    params.code,
  ]);

  const upcoming =
    useMemo(
      () =>
        data?.fixtures
          .filter(
            (
              fixture,
            ) =>
              !fixture.result &&
              fixture.status !==
                'CANCELLED',
          )
          .slice(
            0,
            8,
          ) ??
        [],
      [
        data,
      ],
    );

  async function share() {
    const url =
      window.location.href;

    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            data?.tournament
              .name ||
            'FC ARENA Tournament',

          url,
        });

        return;
      }

      await navigator.clipboard.writeText(
        url,
      );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1600,
      );
    } catch {
      // User may cancel native share.
    }
  }

  if (
    !data &&
    !error
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F5F8FD] text-sm font-semibold text-[#60708A]">
        Loading public Tournament...
      </div>
    );
  }

  if (
    !data
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F5F8FD] p-6">
        <div className="max-w-md rounded-3xl border border-[#DCE5F1] bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">
            ⚽
          </p>

          <h1 className="mt-4 text-2xl font-bold text-[#0B1F44]">
            Tournament unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#60708A]">
            {
              error
            }
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-[#1478F2] px-5 py-3 text-sm font-semibold text-white"
          >
            FC ARENA
          </Link>
        </div>
      </div>
    );
  }

  const tournament =
    data.tournament;

  return (
    <main className="min-h-screen bg-[#F5F8FD] text-[#0B1F44]">
      <header className="border-b border-[#DCE5F1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B1F44] text-white">
              ♛
            </span>

            <span>
              FC{' '}
              <span className="text-[#1478F2]">
                ARENA
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() =>
              void share()
            }
            className="rounded-xl border border-[#DCE5F1] bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-[#1478F2]"
          >
            {copied
              ? 'Link copied ✓'
              : 'Share Tournament'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[28px] border border-[#DCE5F1] bg-white shadow-sm">
          <div className="h-28 bg-gradient-to-r from-[#0B1F44] via-[#123568] to-[#1478F2] sm:h-36" />

          <div className="px-5 pb-6 sm:px-7">
            <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-white bg-[#E8F2FF] text-xl font-bold text-[#1478F2] shadow-sm">
                {tournament.logoUrl ? (
                  <img
                    src={
                      tournament.logoUrl
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  'FC'
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1478F2]">
                  {
                    tournament.league
                      .name
                  }
                </p>

                <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                  {
                    tournament.name
                  }
                </h1>

                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#60708A]">
                  <span>
                    {
                      formatCompetition(
                        tournament.competitionFormat,
                      )
                    }
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {
                      tournament.mode
                    }
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {
                      formatCompetition(
                        tournament.status,
                      )
                    }
                  </span>
                </div>
              </div>
            </div>

            {tournament.description ? (
              <p className="mt-5 max-w-3xl text-sm leading-6 text-[#60708A]">
                {
                  tournament.description
                }
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [
              'Teams',
              String(
                data.standings.length ||
                data.groups.reduce(
                  (
                    total,
                    group,
                  ) =>
                    total +
                    group.entries
                      .length,
                  0,
                ),
              ),
            ],
            [
              'Fixtures',
              String(
                data.fixtures.length,
              ),
            ],
            [
              'Groups',
              String(
                data.groups.length,
              ),
            ],
            [
              'Code',
              tournament.code,
            ],
          ].map(
            (
              [
                label,
                value,
              ],
            ) => (
              <article
                key={
                  label
                }
                className="rounded-2xl border border-[#DCE5F1] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold text-[#60708A]">
                  {
                    label
                  }
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {
                    value
                  }
                </p>
              </article>
            ),
          )}
        </section>

        {data.standings.length >
        0 ? (
          <section className="rounded-[24px] border border-[#DCE5F1] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#1478F2]">
                  Live table
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Standings
                </h2>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-[#60708A]">
                  <tr>
                    <th className="pb-3">
                      #
                    </th>
                    <th className="pb-3">
                      Team / Player
                    </th>
                    <th className="pb-3 text-center">
                      P
                    </th>
                    <th className="pb-3 text-center">
                      W
                    </th>
                    <th className="pb-3 text-center">
                      D
                    </th>
                    <th className="pb-3 text-center">
                      L
                    </th>
                    <th className="pb-3 text-center">
                      GD
                    </th>
                    <th className="pb-3 text-center">
                      PTS
                    </th>
                    <th className="pb-3">
                      Form
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.standings.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.registrationId
                        }
                        className="border-t border-[#EEF2F7]"
                      >
                        <td className="py-3 font-bold">
                          {
                            row.position
                          }
                        </td>

                        <td className="py-3 font-semibold">
                          {
                            row.name
                          }
                        </td>

                        <td className="py-3 text-center">
                          {
                            row.played
                          }
                        </td>

                        <td className="py-3 text-center">
                          {
                            row.wins
                          }
                        </td>

                        <td className="py-3 text-center">
                          {
                            row.draws
                          }
                        </td>

                        <td className="py-3 text-center">
                          {
                            row.losses
                          }
                        </td>

                        <td className="py-3 text-center">
                          {
                            row.goalDifference >
                            0
                              ? '+' +
                                row.goalDifference
                              : row.goalDifference
                          }
                        </td>

                        <td className="py-3 text-center font-bold text-[#1478F2]">
                          {
                            row.points
                          }
                        </td>

                        <td className="py-3 font-mono text-xs">
                          {
                            row.form ||
                            '—'
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {upcoming.length >
        0 ? (
          <section>
            <p className="text-xs font-semibold text-[#1478F2]">
              Schedule
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Upcoming Fixtures
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {upcoming.map(
                (
                  fixture,
                ) => (
                  <article
                    key={
                      fixture.id
                    }
                    className="rounded-2xl border border-[#DCE5F1] bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#60708A]">
                      <span>
                        {
                          fixture.roundName
                        }
                      </span>

                      <span>
                        {
                          formatCompetition(
                            fixture.status,
                          )
                        }
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <p className="text-right font-bold">
                        {
                          fixture.home
                        }
                      </p>

                      <span className="rounded-lg bg-[#E8F2FF] px-3 py-2 text-xs font-bold text-[#1478F2]">
                        VS
                      </span>

                      <p className="font-bold">
                        {
                          fixture.away
                        }
                      </p>
                    </div>

                    <p className="mt-4 text-center text-xs text-[#60708A]">
                      {fixture.scheduledAt
                        ? new Date(
                            fixture.scheduledAt,
                          ).toLocaleString()
                        : 'Schedule pending'}
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>
        ) : null}

        {data.topPlayers.length >
        0 ? (
          <section>
            <p className="text-xs font-semibold text-[#1478F2]">
              Performance
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Top Players
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {data.topPlayers
                .slice(
                  0,
                  6,
                )
                .map(
                  (
                    player,
                  ) => (
                    <article
                      key={
                        player.position +
                        player.name
                      }
                      className="rounded-2xl border border-[#DCE5F1] bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8F2FF] font-bold text-[#1478F2]">
                          {
                            player.position
                          }
                        </span>

                        <span className="text-xs font-semibold text-[#60708A]">
                          {
                            player.playerCode ||
                            'FC Player'
                          }
                        </span>
                      </div>

                      <h3 className="mt-4 font-bold">
                        {
                          player.name
                        }
                      </h3>

                      <p className="mt-2 text-xs text-[#60708A]">
                        {
                          player.wins
                        }{' '}
                        wins ·{' '}
                        {
                          player.goalsFor
                        }{' '}
                        goals
                      </p>
                    </article>
                  ),
                )}
            </div>
          </section>
        ) : null}

        {tournament.rules ? (
          <section className="rounded-[24px] border border-[#DCE5F1] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold text-[#1478F2]">
              Tournament Rules
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#60708A]">
              {
                tournament.rules
              }
            </p>
          </section>
        ) : null}

        <footer className="py-6 text-center text-xs text-[#60708A]">
          Live competition data powered by FC ARENA.
        </footer>
      </div>
    </main>
  );
}
