'use client';

import { AwardCeremony } from '@/components/fc/award-ceremony';
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
  FcPanel,
} from '@/components/fc/fc-ui';
import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

type RaceKey =
  | 'goldenBoot'
  | 'goldenGlove'
  | 'playerOfTournament';

interface CategoryConfig {
  title: string;
  icon: string;
  detail: string;
  backendTypes: string[];
  raceKey?: RaceKey;
  seasonal?: boolean;
  calculationTitle: string;
  rules: Array<{
    label: string;
    detail: string;
  }>;
}

const categories:
  Record<string, CategoryConfig> = {
    'golden-boot': {
      title: 'Golden Boot',
      icon: '⚽',
      detail: 'Live scoring races from verified tournament results, with player and team records clearly identified.',
      backendTypes: [
        'GOLDEN_BOOT',
      ],
      raceKey: 'goldenBoot',
      calculationTitle: 'Golden Boot ranking order',
      rules: [
        { label: '1 · Total Goals', detail: 'More verified goals ranks higher.' },
        { label: '2 · Goals / Match', detail: 'If goals are tied, the higher scoring rate ranks higher.' },
        { label: '3 · Goal Difference', detail: 'Next tie-break is the better overall goal difference.' },
        { label: '4 · Wins', detail: 'Next tie-break is more wins. Exact ties can share the award.' },
      ],
    },
    'golden-glove': {
      title: 'Golden Glove',
      icon: '🧤',
      detail: 'Live defensive race based on verified clean sheets and goals conceded.',
      backendTypes: [
        'GOLDEN_GLOVE',
      ],
      raceKey: 'goldenGlove',
      calculationTitle: 'Golden Glove ranking order',
      rules: [
        { label: '1 · Clean Sheets', detail: 'More verified clean sheets ranks higher.' },
        { label: '2 · Clean Sheet %', detail: 'If tied, the better clean-sheet rate ranks higher.' },
        { label: '3 · Goals Against / Match', detail: 'Lower goals conceded per match ranks higher.' },
        { label: '4 · Matches + Total GA', detail: 'Then more matches, followed by fewer total goals conceded. Exact ties can share the award.' },
      ],
    },
    'player-of-tournament': {
      title: 'Player of the Tournament',
      icon: '⭐',
      detail: 'Overall tournament performance rating from verified match data.',
      backendTypes: [
        'BEST_PLAYER',
        'PLAYER_OF_TOURNAMENT',
      ],
      raceKey: 'playerOfTournament',
      calculationTitle: 'FC Arena performance rating · 100 points',
      rules: [
        { label: 'Match Performance · 30', detail: '55% points per match (Win 3, Draw 1) + 45% win rate.' },
        { label: 'Attack · 20', detail: '70% goals per match + 30% total goals.' },
        { label: 'Defence · 15', detail: '60% clean-sheet rate + 40% goals-conceded efficiency.' },
        { label: 'Goal Difference · 15', detail: 'Positive goal difference per match relative to the best rate.' },
        { label: 'Big Matches · 15', detail: 'QF win +0.5, SF +1, Final +2, Champion +3, Runner-up +1.' },
        { label: 'Consistency · 5', detail: 'Longest win streak and low-loss rate.' },
      ],
    },
    'rising-star': {
      title: 'Rising Star',
      icon: '🚀',
      detail: 'Seasonal honour for the best eligible newcomer in an FC Arena Ballon season.',
      backendTypes: [
        'RISING_STAR',
      ],
      seasonal: true,
      calculationTitle: 'Rising Star eligibility',
      rules: [
        { label: 'Ballon Eligible', detail: 'Player must meet the season minimum-match requirement.' },
        { label: 'Newcomer Window', detail: 'First competitive activity must fall from 90 days before season start through season end.' },
        { label: 'No Previous Ballon', detail: 'A previous FC Arena Ballon winner cannot receive Rising Star.' },
        { label: 'Highest Ranked', detail: 'The highest Ballon-ranked player who meets the newcomer rules wins.' },
      ],
    },
    'tournament-champion': {
      title: 'Tournament Champion',
      icon: '🏆',
      detail: 'Official championship honours generated when a tournament is completed.',
      backendTypes: [
        'TOURNAMENT_CHAMPION',
      ],
      calculationTitle: 'How Champion is decided',
      rules: [
        { label: 'League / Round Robin', detail: 'Final standings decide the winner using tournament standing rules.' },
        { label: 'Knockout', detail: 'The verified winner of the final receives the Champion honour.' },
      ],
    },
    'tournament-runner-up': {
      title: 'Tournament Runner-Up',
      icon: '🥈',
      detail: 'Official second-place honours from completed tournaments.',
      backendTypes: [
        'TOURNAMENT_RUNNER_UP',
      ],
      calculationTitle: 'How Runner-Up is decided',
      rules: [
        { label: 'League / Round Robin', detail: 'Second place in the final standings receives Runner-Up.' },
        { label: 'Knockout', detail: 'The verified losing finalist receives Runner-Up.' },
      ],
    },
    'winning-streak': {
      title: 'Winning Streak',
      icon: '🔥',
      detail: 'Verified winning-run achievements earned in FC Arena tournaments.',
      backendTypes: [
        'WINNING_STREAK',
      ],
      calculationTitle: 'Winning Streak rule',
      rules: [
        { label: '3+ Consecutive Wins', detail: 'The achievement starts at three verified wins in a row.' },
        { label: 'Longest Run', detail: 'Draws and losses reset the active streak. The longest verified run is stored.' },
      ],
    },
  };

interface AwardTournament {
  id: string;
  name: string;
  code: string;
  status: string;
  league: {
    id: string;
    name: string;
  };
}

interface TournamentAward {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  tournamentId: string;
}

interface SeasonalAward {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;
  seasonId: string;
}

interface RecentSeasonalAward
  extends SeasonalAward {
  player: {
    fullName: string;
    inGameName: string | null;
    playerCode: string | null;
    profileImageUrl: string | null;
  };
}

interface AwardsOverview {
  trophyCabinet:
    Record<string, number>;
  myTournamentAwards:
    TournamentAward[];
  mySeasonalAwards:
    SeasonalAward[];
  activeAwardTournaments:
    AwardTournament[];
  recentSeasonalWinners:
    RecentSeasonalAward[];
}

interface RaceRow {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  matches: number;
  goals: number;
  goalsPerMatch: number;
  cleanSheets: number;
  cleanSheetRate: number;
  goalsAgainstPerMatch: number;
  rating: number | null;
}

interface VerifiedScoreRow {
  id: string;
  name: string;
  position: number;
  matches: number;
  goals: number;
  goalsPerMatch: number;
  cleanSheets: number;
  goalsAgainstPerMatch: number;
}

interface AwardRaceData {
  available: boolean;
  reason: string | null;
  verifiedScoreRaces?: {
    scope: 'PLAYER' | 'TEAM';
    goldenBoot: VerifiedScoreRow[];
    goldenGlove: VerifiedScoreRow[];
  };
  goldenBoot: RaceRow[];
  goldenGlove: RaceRow[];
  playerOfTournament:
    RaceRow[];
}

interface TournamentRace {
  tournament: AwardTournament;
  data: AwardRaceData;
}

function playerName(
  row: RaceRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}

function raceMetric(
  key: RaceKey,
  row: RaceRow,
) {
  if (
    key ===
    'goldenBoot'
  ) {
    return `${row.goals} goals · ${row.goalsPerMatch}/M · ${row.matches} M`;
  }

  if (
    key ===
    'goldenGlove'
  ) {
    return `${row.cleanSheets} CS · ${row.cleanSheetRate}% CS · ${row.goalsAgainstPerMatch} GA/M · ${row.matches} M`;
  }

  return `${row.rating ?? 0}/100`;
}

export default function AwardCategoryPage() {
  const {
    category,
  } =
    useParams<{
      category: string;
    }>();

  const config =
    categories[
      category
    ];

  const [
    overview,
    setOverview,
  ] =
    useState<AwardsOverview | null>(
      null,
    );

  const [
    races,
    setRaces,
  ] =
    useState<TournamentRace[]>(
      [],
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [attempt, setAttempt] = useState(0);
  const [raceOffset, setRaceOffset] = useState(0);
  const [pagination, setPagination] = useState<{ offset: number; limit: number; total: number; nextOffset: number | null }>({ offset: 0, limit: 6, total: 0, nextOffset: null });

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null,
    );

  useEffect(() => {
    if (!config) {
      setLoading(
        false,
      );
      return;
    }

    let active = true;
    let loadingRequest = false;
    let lastRequestedAt = 0;
    const controller = new AbortController();
    async function load(silent = false) {
      if (loadingRequest || controller.signal.aborted || (silent && (
        document.visibilityState !== 'visible' || navigator.onLine === false ||
        Date.now() - lastRequestedAt < 15_000
      ))) return;
      loadingRequest = true;
      lastRequestedAt = Date.now();
      try {
        const [response, live] = await Promise.all([
          authenticatedRequest<{ data: AwardsOverview }>('/awards/overview', { signal: controller.signal }),
          config.raceKey ? authenticatedRequest<{ data: {
            races: TournamentRace[]; failed: Array<{ tournamentId: string }>;
            pagination: { offset: number; limit: number; total: number; nextOffset: number | null };
          } }>(`/awards/live-races?offset=${raceOffset}&limit=6`, { signal: controller.signal }) : Promise.resolve(null),
        ]);
        if (!active) return;
        setOverview(response.data);
        setRaces(live?.data.races ?? []);
        if (live) setPagination(live.data.pagination);
        const failed = live?.data.failed.length ?? 0;
        setError(failed ? `${failed} tournament race${failed === 1 ? '' : 's'} could not be loaded. Retry to get the complete award table.` : '');
        setLastUpdated(new Date());
      } catch (err) {
        if (active && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load this award category.');
      } finally {
        loadingRequest = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => { void load(true); }, 60_000);
    const refresh = () => { void load(true); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      active = false; controller.abort(); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [
    category,
    config,
    attempt,
    raceOffset,
  ]);

  const myAwards =
    useMemo(
      () => {
        if (
          !config ||
          !overview
        ) {
          return [];
        }

        const source =
          config.seasonal
            ? overview.mySeasonalAwards
            : overview.myTournamentAwards;

        return source.filter(
          (
            award,
          ) =>
            config.backendTypes.includes(
              award.type,
            ),
        );
      },
      [
        config,
        overview,
      ],
    );

  const recentSeasonal =
    useMemo(
      () =>
        !config ||
        !overview ||
        !config.seasonal
          ? []
          : overview.recentSeasonalWinners.filter(
              (
                award,
              ) =>
                config.backendTypes.includes(
                  award.type,
                ),
            ),
      [
        config,
        overview,
      ],
    );

  if (!config) {
    return (
      <SecondaryFeaturePage
        eyebrow="Hall of Honours"
        title="Award not found"
        subtitle="This award category is not available."
        backHref="/awards"
        backLabel="Awards"
      >
        <FcPanel className="p-8 text-center">
          <Link
            href="/awards"
            className="text-sm font-black text-amber-300"
          >
            ← Back to Awards
          </Link>
        </FcPanel>
      </SecondaryFeaturePage>
    );
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Award Category"
      title={config.title}
      subtitle={config.detail}
      backHref="/awards"
      backLabel="Awards"
      action={
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
          {error ? 'Refresh needed' : loading ? 'Loading' : '● Live · 60s'}
          {lastUpdated
            ? ` · ${lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </span>
      }
    >
      <section className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-[#0B0F14] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="text-5xl">
              {config.icon}
            </span>

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              FC Arena Awards
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-4xl">
              {config.title}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {config.detail}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-center">
            <p className="text-3xl font-black text-amber-300">
              {
                overview
                  ?.trophyCabinet[
                  config.backendTypes[
                    config.backendTypes.length -
                      1
                  ]
                ] ??
                config.backendTypes.reduce(
                  (
                    total,
                    type,
                  ) =>
                    total +
                    (overview
                      ?.trophyCabinet[
                      type
                    ] ??
                      0),
                  0,
                )
              }
            </p>

            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
              My honours
            </p>
          </div>
        </div>
      </section>

      <details className="overflow-hidden rounded-[24px] border border-amber-400/15 bg-amber-400/[0.035]" open>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              How scoring works
            </p>
            <h2 className="mt-1 text-base font-black">
              {config.calculationTitle}
            </h2>
          </div>
          <span className="text-lg">
            ⓘ
          </span>
        </summary>

        <div className="grid gap-3 border-t border-white/[0.07] p-5 sm:grid-cols-2">
          {config.rules.map((rule) => (
            <div
              key={rule.label}
              className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
            >
              <p className="text-sm font-black text-slate-200">
                {rule.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {rule.detail}
              </p>
            </div>
          ))}
        </div>

        <p className="border-t border-white/[0.07] px-5 py-4 text-xs leading-5 text-slate-500">
          Individual races use verified SOLO results or verified individual DUO games. Aggregate DUO and TEAM scores appear as team records. Unverified, cancelled or duplicate fixtures do not count.
        </p>
      </details>

      {config.raceKey ? (
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Live Races
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Active Tournaments
              </h2>
            </div>

            <p className="text-xs font-semibold text-slate-500">
              Verified results auto-refresh
            </p>
          </div>

          {pagination.total > 6 ? (
            <nav aria-label="Award race pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" disabled={loading || raceOffset === 0}
                onClick={() => { setLoading(true); setRaces([]); setRaceOffset(Math.max(0, raceOffset - 6)); }}
                className="theme-secondary-button min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40">Previous races</button>
              <span aria-live="polite" className="text-xs text-slate-400">{raceOffset + 1}–{Math.min(raceOffset + 6, pagination.total)} of {pagination.total} tournaments</span>
              <button type="button" disabled={loading || pagination.nextOffset === null}
                onClick={() => { if (pagination.nextOffset !== null) { setLoading(true); setRaces([]); setRaceOffset(pagination.nextOffset); } }}
                className="theme-secondary-button min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40">Next races</button>
            </nav>
          ) : null}
          {loading && races.length === 0 ? <p role="status" className="mt-4 text-sm text-slate-400">Loading verified races…</p> : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {races.map(
              (
                race,
              ) => {
                const key =
                  config.raceKey!;

                const verified = key === 'playerOfTournament' ? undefined : race.data.verifiedScoreRaces;
                const rows: RaceRow[] = verified && key !== 'playerOfTournament'
                  ? verified[key].map(row => ({ ...row, userId: row.id, fullName: row.name, inGameName: null,
                    playerCode: verified.scope === 'TEAM' ? 'Team record' : 'Verified DUO player',
                    cleanSheetRate: row.matches > 0 ? Number((row.cleanSheets / row.matches * 100).toFixed(1)) : 0, rating: null }))
                  : race.data[key];

                return (
                  <FcPanel
                    key={
                      race.tournament.id
                    }
                    className="overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black">
                          {
                            race.tournament
                              .name
                          }
                        </h3>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {
                            race.tournament
                              .league.name
                          } · {
                            race.tournament
                              .status
                          }
                        </p>
                      </div>

                      <Link
                        href={
                          `/tournaments/${race.tournament.id}/achievements`
                        }
                        className="shrink-0 text-xs font-black text-amber-300"
                      >
                        Full race →
                      </Link>
                    </div>

                    {verified ? <p className="border-b border-white/[0.07] px-5 py-3 text-xs text-slate-400">{verified.scope === 'TEAM'
                      ? 'Team record · aggregate scores; individual player honours are separate.'
                      : 'Player record · verified individual DUO games.'}</p> : null}
                    {race.data.available || verified ? (
                      <div className="divide-y divide-white/[0.06]">
                        {rows
                          .slice(
                            0,
                            5,
                          )
                          .map(
                            (
                              row,
                            ) => (
                              <div
                                key={
                                  row.userId
                                }
                                className="grid grid-cols-[34px_1fr_auto] items-center gap-3 px-5 py-3.5"
                              >
                                <span className={
                                  row.position <=
                                  3
                                    ? 'text-center text-sm font-black text-amber-300'
                                    : 'text-center text-xs font-black text-slate-600'
                                }>
                                  #{
                                    row.position
                                  }
                                </span>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black">
                                    {playerName(
                                      row,
                                    )}
                                  </p>

                                  <p className="mt-1 truncate font-mono text-[9px] text-slate-600">
                                    {
                                      row.playerCode ||
                                      'FC Arena Player'
                                    }
                                  </p>
                                </div>

                                <p className="text-right text-xs font-black text-slate-300">
                                  {raceMetric(
                                    key,
                                    row,
                                  )}
                                </p>
                              </div>
                            ),
                          )}

                        {rows.length ===
                        0 ? (
                          <p className="p-6 text-center text-sm text-slate-500">
                            Verified results will populate this race.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="p-5 text-sm leading-6 text-slate-500">
                        {
                          race.data
                            .reason ||
                          'This award race is not available yet.'
                        }
                      </p>
                    )}
                  </FcPanel>
                );
              },
            )}

            {!loading && !error &&
            races.length ===
              0 ? (
              <FcPanel className="p-8 text-center text-sm text-slate-500 lg:col-span-2">
                No active tournament race is available in your leagues right now.
              </FcPanel>
            ) : null}
          </div>
        </section>
      ) : null}

      {config.seasonal ? (
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Recent Winners
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Seasonal Honours
          </h2>
          {recentSeasonal[0] && <AwardCeremony
            title={recentSeasonal[0].title}
            variant={recentSeasonal[0].title.toLowerCase().includes('ballon') ? 'ballon' : recentSeasonal[0].title.toLowerCase().includes('golden boot') ? 'boot' : 'season'}
            winner={recentSeasonal[0].player.inGameName || recentSeasonal[0].player.fullName}
          />}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recentSeasonal.map(
              (
                award,
              ) => (
                <FcPanel
                  key={
                    award.id
                  }
                  className="p-5"
                >
                  <p className="text-sm font-black">
                    {config.icon}{' '}
                    {
                      award.player
                        .inGameName ||
                      award.player
                        .fullName
                    }
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {
                      award.title
                    }
                  </p>

                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    {
                      new Date(
                        award.awardedAt,
                      ).toLocaleDateString()
                    }
                  </p>
                </FcPanel>
              ),
            )}

            {!loading &&
            recentSeasonal.length ===
              0 ? (
              <FcPanel className="p-8 text-center text-sm text-slate-500 md:col-span-2">
                No locked seasonal winner is available yet.
              </FcPanel>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              My Record
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Earned Honours
            </h2>
          </div>

          <Link
            href="/career/achievements"
            className="text-xs font-black text-amber-300"
          >
            Trophy cabinet →
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {myAwards.map(
            (
              award,
            ) => (
              <FcPanel
                key={
                  award.id
                }
                className="p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {
                      config.icon
                    }
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-black">
                      {
                        award.title
                      }
                    </p>

                    {award.description ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {
                          award.description
                        }
                      </p>
                    ) : null}

                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {
                        new Date(
                          award.awardedAt,
                        ).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>
              </FcPanel>
            ),
          )}

          {!loading &&
          myAwards.length ===
            0 ? (
            <FcPanel className="p-8 text-center text-sm text-slate-500 md:col-span-2">
              You have not earned this honour yet.
            </FcPanel>
          ) : null}
        </div>
      </section>

      {!config.seasonal &&
      overview?.activeAwardTournaments
        .length ? (
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Explore
          </p>

          <h2 className="mt-1 text-2xl font-black">
            Tournament Award Centers
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.activeAwardTournaments.map(
              (
                tournament,
              ) => (
                <Link
                  key={
                    tournament.id
                  }
                  href={
                    `/tournaments/${tournament.id}/achievements`
                  }
                  className="group"
                >
                  <FcPanel className="h-full p-5 transition group-hover:border-amber-400/25">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            tournament.name
                          }
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          {
                            tournament
                              .league.name
                          } · {
                            tournament.status
                          }
                        </p>
                      </div>

                      <span className="text-amber-300">
                        →
                      </span>
                    </div>
                  </FcPanel>
                </Link>
              ),
            )}
          </div>
        </section>
      ) : null}

      {error ? (
        <FcPanel className="p-5 text-sm text-red-300">
          <div role="alert">{error}</div>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="theme-secondary-button mt-3 rounded-lg border px-3 py-2 font-semibold">Retry award data</button>
        </FcPanel>
      ) : null}

      {loading ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading live award data...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
