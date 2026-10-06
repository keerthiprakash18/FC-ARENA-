'use client';

import Link from 'next/link';
import { FcCrest, FcStatusBadge } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { PremiumHero, PremiumMatch, PremiumSection } from '@/components/fc/premium-ui';

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
      <div className="fc-public-page fc-public-state grid min-h-screen place-items-center text-sm font-semibold">
        Loading public Tournament...
      </div>
    );
  }

  if (
    !data
  ) {
    return (
      <div className="fc-public-page fc-public-state grid min-h-screen place-items-center p-6">
        <div className="theme-panel max-w-md rounded-3xl border p-8 text-center">
           <FcIcon name="tournament" size={40} className="mx-auto" />

          <h1 className="theme-text mt-4 text-2xl font-bold">
            Tournament unavailable
          </h1>

          <p className="theme-secondary-text mt-2 text-sm leading-6">
            {
              error
            }
          </p>

          <Link
            href="/"
            className="theme-primary-button mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-semibold"
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
    <main className="fc-public-page premium-public min-h-screen">
      <header className="fc-public-header border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold"
          >
            <span className="theme-brand-mark grid h-10 w-10 place-items-center rounded-xl border">
              FC
            </span>

            <span>
              FC{' '}
              <span className="theme-brand-accent">
                ARENA
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() =>
              void share()
            }
            className="theme-secondary-button rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            {copied
              ? 'Link copied ✓'
              : 'Share Tournament'}
          </button>
        </div>
      </header>

      <div className="premium-page mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <PremiumHero eyebrow={`FC Arena · ${tournament.league.name}`} title={tournament.name} crest={tournament.name} imageUrl={tournament.logoUrl} description={tournament.description || undefined} action={upcoming.length ? <a href="#upcoming-fixtures" className="theme-primary-button premium-button">View Fixtures <FcIcon name="chevronRight" size={16} /></a> : undefined}>
          <div className="premium-hero-tags"><span>{formatCompetition(tournament.competitionFormat)}</span><span>{tournament.mode}</span><span>{formatCompetition(tournament.status)}</span>{tournament.startAt ? <span>{new Date(tournament.startAt).toLocaleDateString()}</span> : null}</div>
        </PremiumHero>
        <nav className="premium-public-tabs" aria-label="Public tournament sections">
          {upcoming.length ? <a href="#upcoming-fixtures">Fixtures</a> : null}
          {data.standings.length ? <a href="#standings">Standings</a> : null}
          {data.fixtures.some(fixture => fixture.result) ? <a href="#results">Results</a> : null}
          {data.topPlayers.length ? <a href="#top-players">Top Players</a> : null}
          {tournament.rules ? <a href="#tournament-rules">Rules</a> : null}
        </nav>

        <section className="premium-metrics" aria-label="Tournament summary">
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
                className="premium-public-metric"
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
          <section id="standings" className="premium-surface premium-public-standings">
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

            <div className="fc-public-mobile-table mt-5 grid gap-2 sm:hidden" aria-label="Mobile standings">
              {data.standings.map(row => (
                <article key={`mobile-${row.registrationId}`} className="theme-soft-accent rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <span className="theme-tone-premium grid h-9 w-9 shrink-0 place-items-center rounded-xl border font-bold">{row.position}</span>
                    <p className="theme-text min-w-0 flex-1 truncate font-semibold">{row.name}</p>
                    <p className="theme-text text-lg font-bold">{row.points}<span className="theme-muted ml-1 text-[10px] font-semibold">PTS</span></p>
                  </div>
                  <div className="theme-secondary-text mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <span><strong className="theme-text block">{row.played}</strong>Played</span>
                    <span><strong className="theme-text block">{row.wins}</strong>Won</span>
                    <span><strong className="theme-text block">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</strong>GD</span>
                    <span><strong className="theme-text block">{row.form || '—'}</strong>Form</span>
                  </div>
                  <details className="fc-row-details mt-2">
                    <summary>More statistics</summary>
                    <dl className="fc-standing-stats">
                      {[['Drawn', row.draws], ['Lost', row.losses], ['Goals for', row.goalsFor], ['Goals against', row.goalsAgainst]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                    </dl>
                  </details>
                </article>
              ))}
            </div>

            <div className="mt-5 hidden overflow-x-auto sm:block">
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
          <section id="upcoming-fixtures">
            <p className="text-xs font-semibold text-[#1478F2]">
              Schedule
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Upcoming Fixtures
            </h2>

            <div className="premium-public-fixtures mt-4">
              {upcoming.map(
                (
                  fixture,
                ) => (
                  <PremiumMatch
                    key={
                      fixture.id
                    }
                    home={fixture.home}
                    away={fixture.away}
                    label={fixture.roundName}
                    status={<FcStatusBadge label={formatCompetition(fixture.status)} />}
                  >
                    <p>
                      {fixture.scheduledAt
                        ? new Date(
                            fixture.scheduledAt,
                          ).toLocaleString()
                        : 'Schedule pending'}
                    </p>
                  </PremiumMatch>
                ),
              )}
            </div>
          </section>
        ) : null}

        {data.fixtures.some(fixture => fixture.result) ? <div id="results"><PremiumSection label="Verified competition results" title="Results"><div className="premium-ledger">{data.fixtures.filter(fixture => fixture.result).map(fixture => <article key={fixture.id} className="premium-ledger-row"><div><p>{fixture.home} <span className="theme-muted">vs</span> {fixture.away}</p><small>{fixture.roundName} · {formatCompetition(fixture.status)}</small></div><span className="premium-ledger-score">{fixture.result!.homeScore} : {fixture.result!.awayScore}</span></article>)}</div></PremiumSection></div> : null}

        {data.topPlayers.length >
        0 ? (
          <section id="top-players">
            <p className="text-xs font-semibold text-[#1478F2]">
              Performance
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Top Players
            </h2>

            <div className="premium-public-leaders mt-4">
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
                      className="premium-public-player"
                    >
                      <div className="flex items-center justify-between">
                        <span className="premium-player-position">
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

                      <div className="flex items-center gap-3 mt-4"><FcCrest name={player.name} size="sm" /><h3 className="font-bold">
                        {
                          player.name
                        }
                      </h3></div>

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
          <section id="tournament-rules" className="premium-inset">
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
