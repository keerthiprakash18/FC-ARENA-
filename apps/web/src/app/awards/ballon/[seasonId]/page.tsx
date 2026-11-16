'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AwardEmblem, PremiumHero, PremiumPodium } from '@/components/fc/premium-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import {
  useParams,
} from 'next/navigation';
import {
  Fragment,
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

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  maximumMatches: number;
  rankingLimit: number;
  status: string;
  tournamentRequirements?: {
    SOLO?: number;
    DUO?: number;
    TEAM?: number;
  };
  scoringConfig?: {
    matchPerformance?: number;
    attack?: number;
    defence?: number;
    goalDifference?: number;
    bigMatches?: number;
    consistency?: number;
  } | null;
}

interface TournamentOption {
  id: string;
  name: string;
  mode: 'SOLO' | 'DUO' | 'TEAM';
}

interface RankingRow {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
  rating: number;
  eligible: boolean;
  previousPosition: number | null;
  rankChange: number | null;
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  cleanSheets?: number;
  soloTournamentsPlayed?: number;
  duoTournamentsPlayed?: number;
  teamTournamentsPlayed?: number;
  eligibilityReasons?: string[];
  statistics?: {
    matches?: number;
    wins?: number;
    draws?: number;
    losses?: number;
    goalsFor?: number;
    goalsAgainst?: number;
    goalDifference?: number;
    cleanSheets?: number;
    soloTournamentsPlayed?: number;
    duoTournamentsPlayed?: number;
    teamTournamentsPlayed?: number;
  };
}

function metric(
  row: RankingRow,
  key:
    | 'matches'
    | 'wins'
    | 'draws'
    | 'losses'
    | 'goalsFor'
    | 'goalsAgainst'
    | 'goalDifference'
    | 'cleanSheets',
) {
  const direct =
    row[key];

  if (
    typeof direct ===
    'number'
  ) {
    return direct;
  }

  return (
    row.statistics?.[
      key
    ] ??
    0
  );
}

function nameFor(
  row: RankingRow,
) {
  return (
    row.inGameName ||
    row.fullName
  );
}

function movement(
  row: RankingRow,
) {
  if (
    row.rankChange ===
      null ||
    row.rankChange ===
      0
  ) {
    return {
      text: '—',
      className:
        'text-slate-600',
    };
  }

  if (
    row.rankChange > 0
  ) {
    return {
      text:
        '▲ +' +
        row.rankChange,
      className:
        'text-emerald-400',
    };
  }

  return {
    text:
      '▼ ' +
      row.rankChange,
    className:
      'text-red-400',
  };
}

export default function BallonRankingsPage() {
  const {
    seasonId,
  } =
    useParams<{
      seasonId:
        string;
    }>();

  const [
    season,
    setSeason,
  ] =
    useState<Season | null>(
      null,
    );

  const [
    rows,
    setRows,
  ] =
    useState<RankingRow[]>(
      [],
    );

  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [tournamentId, setTournamentId] = useState('');

  const [
    limit,
    setLimit,
  ] =
    useState<
      10 | 20 | 50 | 'all'
    >('all');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null,
    );

  useEffect(() => {
    let active =
      true;

    let inFlight = false;

    async function loadRankings() {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response =
          await authenticatedRequest<any>(
            '/ballon/seasons/' +
              seasonId +
              '/rankings?limit=' +
              limit +
              (tournamentId ? '&tournamentId=' + encodeURIComponent(tournamentId) : ''),
          );

        if (!active) {
          return;
        }

        setSeason(
          response
            .data
            .season,
        );

        setRows(
          response
            .data
            .rows ??
            [],
        );
        setTournaments(response.data.tournaments ?? []);

        setError('');
        setLastUpdated(
          new Date(),
        );
      } catch (
        err
      ) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Ballon rankings.',
        );
      } finally {
        inFlight = false;
      }
    }

    void loadRankings();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void loadRankings();
          }
        },
        10_000,
      );

    const refreshOnFocus =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void loadRankings();
        }
      };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener(
      'visibilitychange',
      refreshOnFocus,
    );

    return () => {
      active =
        false;
      window.clearInterval(
        interval,
      );
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener(
        'visibilitychange',
        refreshOnFocus,
      );
    };
  }, [
    limit,
    seasonId,
    tournamentId,
  ]);

  const eligible =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.eligible,
        ),
      [
        rows,
      ],
    );

  const selectedTournament = tournaments.find((item) => item.id === tournamentId);
  const qualifiers = rows.filter((row) => !row.eligible);
  const tournamentView = Boolean(tournamentId);
  const minimumNeeded = tournamentView ? 3 : Math.max(3, season?.minimumMatches ?? 10);
  const finalSeason = season?.status === 'LOCKED' || season?.status === 'ARCHIVED';

  const scoring = {
    matchPerformance:
      season?.scoringConfig
        ?.matchPerformance ??
      30,
    attack:
      season?.scoringConfig
        ?.attack ??
      20,
    defence:
      season?.scoringConfig
        ?.defence ??
      15,
    goalDifference:
      season?.scoringConfig
        ?.goalDifference ??
      15,
    bigMatches:
      season?.scoringConfig
        ?.bigMatches ??
      15,
    consistency:
      season?.scoringConfig
        ?.consistency ??
      5,
  };

  const live =
    season?.status ===
    'LIVE';

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena Ballon"
      title={
        season?.name ??
        'Season Rankings'
      }
      subtitle={
        season
           ? `${new Date(
               season.startAt,
             ).toLocaleDateString()} – ${new Date(
               season.endAt,
             ).toLocaleDateString()} · ${season.minimumMatches}–${season.maximumMatches} matches counted · ${season.status}`
          : 'Loading seasonal ranking...'
      }
       header={<PremiumHero eyebrow="FC Arena · Ballon d’Or" title={season?.name ?? 'Season Rankings'} description={season ? `${new Date(season.startAt).toLocaleDateString()} – ${new Date(season.endAt).toLocaleDateString()} · ${season.minimumMatches}–${season.maximumMatches} matches counted · ${season.status}` : 'Loading seasonal ranking...'} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/awards"
          className="text-sm font-black text-slate-500 transition hover:text-amber-300"
        >
          ← Hall of Honours
        </Link>

        <span className={
          live
            ? 'rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300'
            : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400'
        }>
          {live
            ? '● LIVE · refresh 10s'
            : season?.status ?? 'Loading'}
          {lastUpdated
            ? ` · ${lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </span>

        <div className="flex flex-wrap rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
          {(
            [
              'all',
              10,
              20,
              50,
            ] as const
          ).map(
            (
              value,
            ) => (
              <button
                key={
                  value
                }
                type="button"
                onClick={() =>
                  setLimit(
                    value,
                  )
                }
                className={
                  limit ===
                  value
                    ? 'rounded-lg bg-amber-300 px-4 py-2 text-xs font-black text-[#151006]'
                    : 'rounded-lg px-4 py-2 text-xs font-black text-slate-500'
                }
              >
                {value ===
                'all'
                  ? 'ALL'
                  : `TOP ${value}`}
              </button>
            ),
          )}
        </div>
      </div>

      {!tournamentView && eligible.length > 0 ? <PremiumPodium rows={rows} seasonId={seasonId} /> : null}

      <FcPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Ranking Scope</p>
            <h2 className="mt-1 text-lg font-black">{tournamentView ? 'Tournament performance' : 'Official season Ballon standings'}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {tournamentView
                ? 'Tournament-only form table. At least 3 verified matches are needed for a tournament position. This table does not award the Ballon or change the season winner.'
                : 'Only verified results from this season count. A player needs ' + minimumNeeded + ' matches and the required tournament mix to enter the ranked contenders list. Everyone else remains unranked.'}
            </p>
          </div>
          <label className="min-w-[220px] text-xs font-bold text-slate-400">
            Choose competition
            <select aria-label="Choose Ballon ranking scope" value={tournamentId} onChange={(event) => setTournamentId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#121821] px-4 py-3 text-sm text-white">
              <option value="">All eligible tournaments · Season award</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name} ({tournament.mode})
                </option>
              ))}
            </select>
          </label>
        </div>
        {tournamentView ? (
          <p className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-xs leading-5 text-sky-200">
            {selectedTournament?.name ?? 'Selected tournament'} · Informational table only.
            {finalSeason ? ' The season award is a locked historical snapshot; this tournament drill-down is recalculated from currently verified results.' : ''}
          </p>
        ) : null}
        {eligible.length === 0 ? (
          <p role="status" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm font-semibold text-amber-200">
            No qualified contenders yet. No player is #1 until the eligibility rules are met.
          </p>
        ) : null}
      </FcPanel>

      <details className="premium-admin-controls overflow-hidden rounded-xl border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Transparent Scoring
            </p>
            <h2 className="mt-1 text-base font-black">
              How is the performance rating calculated?
            </h2>
          </div>
          <span className="text-sm font-black text-amber-300">
            100 pts
          </span>
        </summary>

        <div className="border-t border-white/[0.07] p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                label: 'Match Performance',
                value: scoring.matchPerformance,
                detail: '55% points per match (Win 3, Draw 1) + 45% win rate.',
              },
              {
                label: 'Attack',
                value: scoring.attack,
                detail: '70% goals per match + 30% total goals, normalized against the field.',
              },
              {
                label: 'Defence',
                value: scoring.defence,
                detail: '60% clean-sheet rate + 40% goals-conceded efficiency.',
              },
              {
                label: 'Goal Difference',
                value: scoring.goalDifference,
                detail: 'Positive goal difference per match, normalized against the best rate.',
              },
              {
                label: 'Big Matches',
                value: scoring.bigMatches,
                detail: 'QF win +0.5, SF +1, Final +2, Champion +3, Runner-up +1; capped by this weight.',
              },
              {
                label: 'Consistency',
                value: scoring.consistency,
                detail: '60% longest win streak (up to 5) + 40% low-loss rate.',
              },
            ].map((rule) => (
              <div
                key={rule.label}
                className="rounded-2xl border border-white/[0.07] bg-black/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">
                    {rule.label}
                  </p>
                  <span className="text-sm font-black text-amber-300">
                    {rule.value}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {rule.detail}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
             Canonical confirmed results inside the selected season date window count. The latest <strong className="text-slate-300">{season?.maximumMatches ?? '—'} matches</strong> per player are counted. {tournamentView ? <>A player needs <strong className="text-slate-300">3 matches in this tournament</strong> to enter its performance table. This view does not decide the Ballon.</> : <>The season award requires <strong className="text-slate-300">{minimumNeeded} matches</strong> and the configured mix: <strong className="text-slate-300">{season?.tournamentRequirements?.SOLO ?? 0} SOLO · {season?.tournamentRequirements?.DUO ?? 0} DUO · {season?.tournamentRequirements?.TEAM ?? 0} TEAM</strong>.</>} Ineligible players have no ranking position even if their form rating is high. Qualified ties are resolved by rating, wins, goal difference and goals scored.
          </p>
        </div>
      </details>

      <section className="premium-ranking-ledger">
        <div className="grid gap-5 border-b border-white/[0.07] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
          <AwardEmblem />

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Seasonal Player Honour
            </p>

            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              {tournamentView ? 'Tournament Performance Table' : 'Season Ballon Rankings'}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
               {tournamentView ? 'Only matches in the selected tournament count. This is an insights table, not the official season award.' : 'Official standings include all verified in-scope competitions. Only qualified players can claim a position.'} Rankings refresh every 10 seconds.
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-3xl font-black text-amber-300">
              {
                eligible.length
              }
            </p>

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Ranked contenders
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {rows.map(
            (
              row,
              index,
            ) => {
              const change =
                movement(
                  row,
                );

              return (
                <Fragment key={row.userId}>
                {!row.eligible && index === eligible.length ? (
                  <div className="border-y border-amber-300/15 bg-amber-300/[0.045] px-5 py-3">
                    <p className="text-sm font-black text-amber-200">Qualification queue · Unranked</p>
                    <p className="mt-1 text-xs text-slate-400">Complete the conditions below to enter the season table. Form scores alone do not grant a position.</p>
                  </div>
                ) : null}
                <Link
                  href={
                    `/awards/ballon/${seasonId}/players/${row.userId}`
                  }
                  className="grid grid-cols-[42px_1fr_auto] gap-3 p-4 transition hover:bg-white/[0.025] sm:grid-cols-[48px_1fr_70px_70px_70px_86px] sm:items-center sm:px-6"
                >
                  <span className={
                    row.eligible && row.position <=
                    3
                      ? 'text-center text-lg font-black text-amber-300'
                      : 'text-center text-sm font-black text-slate-500'
                  }>
                    {row.eligible ? '#' + row.position : '—'}
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                      {row.profileImageUrl ? (
                        <Image
                          src={
                            row.profileImageUrl
                          }
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-sm">
                          <FcIcon name="profile" size={20} />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {nameFor(
                          row,
                        )}
                      </span>

                      <span className="mt-1 block truncate font-mono text-[9px] text-slate-600">
                        {
                          row.playerCode ||
                          'FC Arena Player'
                        }
                      </span>

                       {!row.eligible ? (
                         <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-amber-500">
                           Qualifying · {row.eligibilityReasons?.join(' · ') || metric(row, 'matches') + '/' + minimumNeeded + ' matches'}
                          </span>
                       ) : null}

                       <span className="mt-1 block text-[9px] font-bold text-slate-600">
                         {row.soloTournamentsPlayed ?? row.statistics?.soloTournamentsPlayed ?? 0} SOLO · {row.duoTournamentsPlayed ?? row.statistics?.duoTournamentsPlayed ?? 0} DUO · {row.teamTournamentsPlayed ?? row.statistics?.teamTournamentsPlayed ?? 0} TEAM
                       </span>
                    </span>
                  </span>

                  <span className="text-right">
                    <span className="block text-xl font-black text-amber-300">
                      {
                        row.rating
                      }
                    </span>

                    <span className={`text-[10px] font-bold ${change.className}`}>
                      {row.eligible ? change.text : 'Provisional'}
                    </span>
                  </span>

                  <span className="hidden text-center text-xs font-bold text-slate-400 sm:block">
                    {
                      metric(
                        row,
                        'matches',
                      )
                    }{' '}
                    M
                  </span>

                  <span className="hidden text-center text-xs font-bold text-emerald-400 sm:block">
                    {
                      metric(
                        row,
                        'wins',
                      )
                    }{' '}
                    W
                  </span>

                  <span className="hidden text-center text-xs font-bold text-slate-300 sm:block">
                    {
                      metric(
                        row,
                        'goalsFor',
                      )
                    }{' '}
                    G
                  </span>
                </Link>
                </Fragment>
              );
            },
          )}

          {rows.length ===
          0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No verified matches are available for this selection yet.
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <FcPanel className="p-5 text-sm text-red-300">
          {
            error
          }
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
