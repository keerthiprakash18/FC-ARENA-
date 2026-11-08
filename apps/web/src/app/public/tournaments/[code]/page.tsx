'use client';

import { TournamentFormatGuide } from '@/components/tournaments/tournament-format-guide';
import { PlayoffBracket } from '@/components/tournaments/playoff-bracket';
import type { FixtureForUi } from '@/components/tournaments/fixture-card';
import type { TournamentFormatDescription } from '@/lib/tournament-format-guide';
import Link from 'next/link';
import { FcCrest, FcStatusBadge } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { PremiumHero, PremiumMatch, PremiumSection } from '@/components/fc/premium-ui';
import { CompactStandingsTable } from '@/components/tournaments/compact-standings-table';

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
    playoffFormat?: string;
    formatGuide?: TournamentFormatDescription | null;
    status: string;
    startAt: string | null;
    endAt: string | null;

    league: {
      name: string;
      logoUrl: string | null;
      region: string | null;
    };
  };

  bracketFixtures?: FixtureForUi[];
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
    logoUrl?: string | null;
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
  if (value === 'UCL_CUP') {
    return 'UCL Cup';
  }

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
  const params = useParams<{ code: string }>();
  return <PublicTournamentView key={params.code} />;
}
function PublicTournamentView() {
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

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async (initial = false) => {
      if (pending || (!initial && (navigator.onLine === false || document.visibilityState === 'hidden'))) return;
      pending = true; setRefreshing(true);
      try {
        const response = await apiRequest<{ data: PublicTournamentData }>('/public/tournaments/' + encodeURIComponent(params.code), { signal: controller.signal });
        if (!controller.signal.aborted) {
          setData(response.data); setError(''); setRefreshError(''); setLastUpdated(Date.now());
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Unable to refresh tournament results.';
        if (initial && !lastUpdated) setError(message);
        setRefreshError(message);
      } finally { pending = false; if (!controller.signal.aborted) setRefreshing(false); }
    };
    const refresh = () => { setOnline(navigator.onLine !== false); void load(); };
    const offline = () => setOnline(false);
    setOnline(navigator.onLine !== false); void load(true);
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', refresh); };
    // The retained timestamp does not restart the polling connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, retry]);

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

  async function exportResults() {
    setExporting(true);
    try {
      const response = await apiRequest<{
        data: { filename: string; csv: string };
      }>(
        `/public/tournaments/${encodeURIComponent(params.code)}/export?format=csv`,
      );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([response.data.csv], { type: 'text/csv;charset=utf-8' }));
      link.download = response.data.filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Export could not be created.');
    } finally {
      setExporting(false);
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

          <button type="button" onClick={() => setRetry(value => value + 1)} className="theme-secondary-button mt-4 min-h-11 rounded-xl border px-5 text-sm font-semibold">Try again</button>
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

  const entryLogos = new Map(data.groups.flatMap(group => group.entries).map(entry => [entry.id, entry.logoUrl]));
  const standings = data.standings.map(row => ({
    ...row,
    entryName: row.name,
    logoUrl: row.logoUrl ?? entryLogos.get(row.registrationId) ?? null,
  }));

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

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void exportResults()}
              disabled={exporting}
              className="theme-secondary-button rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {exporting ? 'Preparing…' : 'Export results'}
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="theme-secondary-button rounded-xl border px-4 py-2 text-sm font-semibold transition"
            >
              {copied ? 'Link copied ✓' : 'Share Tournament'}
            </button>
          </div>
        </div>
      </header>

      <div className="premium-page mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <aside aria-label="Tournament update status" className="theme-panel mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="theme-muted text-sm" role="status">
            {!online ? 'Offline. Showing the last successfully loaded results.' : refreshError ? 'Reconnecting. Results may be out of date.' : refreshing ? 'Refreshing results...' : 'Results are up to date.'}
            {lastUpdated ? <span className="mt-1 block text-xs">Last updated: {new Date(lastUpdated).toLocaleTimeString()}</span> : null}
          </div>
          <button type="button" disabled={!online || refreshing} onClick={() => setRetry(value => value + 1)} className="theme-text min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">Refresh results</button>
        </aside>
        {error ? <p role="alert" className="theme-muted mb-4 text-sm">{error}</p> : null}
        <PremiumHero eyebrow={`FC Arena · ${tournament.league.name}`} title={tournament.name} crest={tournament.name} imageUrl={tournament.logoUrl} description={tournament.description || undefined} action={upcoming.length ? <a href="#upcoming-fixtures" className="theme-primary-button premium-button">View Fixtures <FcIcon name="chevronRight" size={16} /></a> : undefined}>
          <div className="premium-hero-tags"><span>{formatCompetition(tournament.competitionFormat)}</span><span>{tournament.mode}</span><span>{formatCompetition(tournament.status)}</span>{tournament.startAt ? <span>{new Date(tournament.startAt).toLocaleDateString()}</span> : null}</div>
        </PremiumHero>
        <TournamentFormatGuide guide={tournament.formatGuide} />
        <nav className="premium-public-tabs" aria-label="Public tournament sections">
          {upcoming.length ? <a href="#upcoming-fixtures">Fixtures</a> : null}
          {data.standings.length ? <a href="#standings">Standings</a> : null}
          {data.fixtures.some(fixture => fixture.result) ? <a href="#results">Results</a> : null}
          {data.bracketFixtures?.length ? <a href="#playoff-bracket">Playoff bracket</a> : null}
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

        {data.bracketFixtures?.length ? <div id="playoff-bracket"><PlayoffBracket fixtures={data.bracketFixtures} tournamentName={tournament.name} format={tournament.competitionFormat === 'UCL_CUP' ? 'UCL_CUP' : tournament.playoffFormat} readOnly /></div> : null}

        {data.standings.length >
        0 ? (
          <section id="standings" className="premium-surface premium-public-standings">
            <div className="premium-public-standings-header flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#1478F2]">
                  Live table
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Standings
                </h2>
              </div>
            </div>

            <CompactStandingsTable label="Tournament standings" rows={standings} qualificationBands={[]} />

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
                  {standings.map(
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
                          <div className="flex items-center gap-3">
                            <FcCrest name={row.name} imageUrl={row.logoUrl} size="sm" />
                            {row.name}
                          </div>
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
