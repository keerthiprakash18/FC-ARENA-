'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';
import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

interface Player {
  id: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
}

interface RosterSlot {
  id: string;
  slot: number;
  leagueId: string;
  user: Player;
}

interface MatchPermission {
  canSubmit: boolean;
  canConfirm: boolean;
  canDispute: boolean;
}

interface WarMatch {
  id: string;
  sequence: number;
  leg: number;
  status: string;
  resultStatus: string;
  homeScore: number | null;
  awayScore: number | null;
  proofUrl: string | null;
  disputeReason: string | null;
  walkoverLeagueId: string | null;
  resultSubmittedByLeagueId: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  disputedAt: string | null;
  completedAt: string | null;
  homeLeagueId: string;
  awayLeagueId: string;
  homePlayer: Player;
  awayPlayer: Player;
  permissions: MatchPermission;
}

interface SideScore {
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface PlayerWarStat {
  position: number;
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
}

interface WarDetail {
  id: string;
  name: string;
  status: string;
  playerCount: number;
  legType: string;
  pairingMode: string;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  challengeExpiresAt: string | null;
  scheduledStartAt: string | null;
  deadlineAt: string | null;
  acceptedAt: string | null;
  homeReadyAt: string | null;
  awayReadyAt: string | null;
  homeRosterLockedAt: string | null;
  awayRosterLockedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  winnerLeagueId: string | null;
  rematchOfWarId: string | null;
  homeLeague: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  awayLeague: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  readiness: {
    home: boolean;
    away: boolean;
  };
  permissions: {
    canManageHome: boolean;
    canManageAway: boolean;
    canAccept: boolean;
    canReject: boolean;
    canCancel: boolean;
    canStart: boolean;
    canUpdateResults: boolean;
    canComplete: boolean;
    canRematch: boolean;
  };
  roster: {
    home: RosterSlot[];
    away: RosterSlot[];
  };
  candidates: {
    home: Player[];
    away: Player[];
  };
  matches: WarMatch[];
  summary: {
    completedMatches: number;
    totalMatches: number;
    remainingMatches: number;
    home: SideScore;
    away: SideScore;
    leaderLeagueId: string | null;
    tieBreakOrder: string[];
  };
  playerStats: PlayerWarStat[];
  mvp: PlayerWarStat | null;
  rivalry: {
    previousWars: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    homeBattlePoints: number;
    awayBattlePoints: number;
    recent: Array<{
      id: string;
      name: string;
      completedAt: string | null;
      winnerLeagueId: string | null;
    }>;
  };
}

function displayName(
  player:
    Player,
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

function dateLabel(
  value:
    string | null,
) {
  if (!value) {
    return 'Not set';
  }

  return new Date(
    value,
  ).toLocaleString();
}

function resultTone(
  status: string,
):
  | 'emerald'
  | 'amber'
  | 'red'
  | 'slate' {
  if (
    [
      'CONFIRMED',
      'WALKOVER_CONFIRMED',
    ].includes(
      status,
    )
  ) {
    return 'emerald';
  }

  if (
    [
      'PENDING_CONFIRMATION',
      'WALKOVER_PENDING',
    ].includes(
      status,
    )
  ) {
    return 'amber';
  }

  if (
    status ===
    'DISPUTED'
  ) {
    return 'red';
  }

  return 'slate';
}

export default function LeagueWarDetailPage() {
  const {
    warId,
  } =
    useParams<{
      warId: string;
    }>();

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
    war,
    setWar,
  ] =
    useState<WarDetail | null>(
      null,
    );

  const [
    homeSelection,
    setHomeSelection,
  ] =
    useState<string[]>(
      [],
    );

  const [
    awaySelection,
    setAwaySelection,
  ] =
    useState<string[]>(
      [],
    );

  const [
    scores,
    setScores,
  ] =
    useState<
      Record<
        string,
        {
          home: string;
          away: string;
        }
      >
    >({});

  const [
    proofs,
    setProofs,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    disputes,
    setDisputes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    busy,
    setBusy,
  ] =
    useState('');

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

  async function load() {
    const response =
      await authenticatedRequest<any>(
        `/league-wars/${warId}`,
      );

    const next:
      WarDetail =
      response
        .data
        .war;

    setWar(
      next,
    );

    if (
      [
        'INVITED',
        'ACCEPTED',
      ].includes(
        next.status,
      )
    ) {
      setHomeSelection(
        next.roster.home.map(
          (
            row,
          ) =>
            row.user.id,
        ),
      );

      setAwaySelection(
        next.roster.away.map(
          (
            row,
          ) =>
            row.user.id,
        ),
      );
    }

    setScores(
      (
        current,
      ) =>
        Object.fromEntries(
          next.matches.map(
            (
              match,
            ) => [
              match.id,
              current[
                match.id
              ] ?? {
                home:
                  match.homeScore ===
                  null
                    ? ''
                    : String(
                        match.homeScore,
                      ),
                away:
                  match.awayScore ===
                  null
                    ? ''
                    : String(
                        match.awayScore,
                      ),
              },
            ],
          ),
        ),
    );

    setProofs(
      (
        current,
      ) =>
        Object.fromEntries(
          next.matches.map(
            (
              match,
            ) => [
              match.id,
              current[
                match.id
              ] ??
                match.proofUrl ??
                '',
            ],
          ),
        ),
    );

    setLastUpdated(
      new Date(),
    );
  }

  useEffect(() => {
    void getCurrentUser()
      .then(
        (
          current,
        ) => {
          setUser(
            current,
          );
          return load();
        },
      )
      .catch(
        () =>
          router.replace(
            '/login',
          ),
      );
  }, [
    router,
    warId,
  ]);

  useEffect(() => {
    if (
      war?.status !==
      'LIVE'
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
              'visible' &&
            !busy
          ) {
            void load().catch(
              () =>
                undefined,
            );
          }
        },
        10_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [
    war?.status,
    busy,
    warId,
  ]);

  const allMatchesComplete =
    useMemo(
      () =>
        Boolean(
          war &&
          war.matches.length >
            0 &&
          war.matches.every(
            (
              match,
            ) =>
              match.status ===
              'COMPLETED',
          ),
        ),
      [
        war,
      ],
    );

  const deadlinePassed =
    Boolean(
      war?.deadlineAt &&
      new Date() >
        new Date(
          war.deadlineAt,
        ),
    );

  async function action(
    key: string,
    path: string,
    options:
      RequestInit = {
        method:
          'POST',
      },
  ) {
    setBusy(
      key,
    );
    setError(
      '',
    );

    try {
      await authenticatedRequest(
        path,
        options,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'League War action failed.',
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  async function reasonAction(
    kind:
      'reject' |
      'cancel',
  ) {
    if (!war) {
      return;
    }

    const reason =
      window.prompt(
        kind ===
        'reject'
          ? 'Reason for rejecting this challenge? (optional)'
          : 'Reason for cancelling this War? (optional)',
      );

    if (
      reason ===
      null
    ) {
      return;
    }

    await action(
      kind,
      `/league-wars/${war.id}/${kind}`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            reason:
              reason.trim() ||
              undefined,
          }),
      },
    );
  }

  async function createRematch() {
    if (!war) {
      return;
    }

    setBusy(
      'rematch',
    );
    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/league-wars/${war.id}/rematch`,
          {
            method:
              'POST',
          },
        );

      router.push(
        `/league-war/${response.data.war.id}`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create rematch.',
      );
      setBusy(
        '',
      );
    }
  }

  function togglePlayer(
    side:
      'home' |
      'away',
    userId: string,
  ) {
    if (!war) {
      return;
    }

    const current =
      side ===
      'home'
        ? homeSelection
        : awaySelection;

    const setter =
      side ===
      'home'
        ? setHomeSelection
        : setAwaySelection;

    if (
      current.includes(
        userId,
      )
    ) {
      setter(
        current.filter(
          (
            id,
          ) =>
            id !==
            userId,
        ),
      );
      return;
    }

    if (
      current.length >=
      war.playerCount
    ) {
      return;
    }

    setter([
      ...current,
      userId,
    ]);
  }

  async function saveRoster(
    side:
      'home' |
      'away',
  ) {
    if (!war) {
      return;
    }

    await action(
      `roster-${side}`,
      `/league-wars/${war.id}/roster`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            leagueId:
              side ===
              'home'
                ? war.homeLeague.id
                : war.awayLeague.id,
            userIds:
              side ===
              'home'
                ? homeSelection
                : awaySelection,
          }),
      },
    );
  }

  async function setReady(
    side:
      'home' |
      'away',
    ready:
      boolean,
  ) {
    if (!war) {
      return;
    }

    await action(
      `ready-${side}`,
      `/league-wars/${war.id}/ready`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            leagueId:
              side ===
              'home'
                ? war.homeLeague.id
                : war.awayLeague.id,
            ready,
          }),
      },
    );
  }

  async function submitResult(
    match:
      WarMatch,
  ) {
    if (!war) {
      return;
    }

    const row =
      scores[
        match.id
      ];

    const home =
      Number(
        row?.home,
      );
    const away =
      Number(
        row?.away,
      );

    if (
      row?.home ===
        '' ||
      row?.away ===
        '' ||
      !Number.isInteger(
        home,
      ) ||
      !Number.isInteger(
        away,
      ) ||
      home <
        0 ||
      away <
        0
    ) {
      setError(
        'Enter valid non-negative scores.',
      );
      return;
    }

    await action(
      `match-${match.id}`,
      `/league-wars/${war.id}/matches/${match.id}/result`,
      {
        method:
          'PATCH',
        body:
          JSON.stringify({
            homeScore:
              home,
            awayScore:
              away,
            proofUrl:
              proofs[
                match.id
              ]?.trim() ||
              undefined,
          }),
      },
    );
  }

  async function disputeResult(
    match:
      WarMatch,
  ) {
    if (!war) {
      return;
    }

    const reason =
      disputes[
        match.id
      ]?.trim();

    if (
      !reason ||
      reason.length <
        3
    ) {
      setError(
        'Enter a dispute reason before disputing the result.',
      );
      return;
    }

    await action(
      `dispute-${match.id}`,
      `/league-wars/${war.id}/matches/${match.id}/dispute`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            reason,
          }),
      },
    );
  }

  async function submitWalkover(
    match:
      WarMatch,
    winnerLeagueId:
      string,
  ) {
    if (!war) {
      return;
    }

    await action(
      `walkover-${match.id}`,
      `/league-wars/${war.id}/matches/${match.id}/walkover`,
      {
        method:
          'POST',
        body:
          JSON.stringify({
            winnerLeagueId,
            proofUrl:
              proofs[
                match.id
              ]?.trim() ||
              undefined,
          }),
      },
    );
  }

  if (
    !user ||
    !war
  ) {
    return (
      <FcLoadingScreen label="Loading League War..." />
    );
  }

  const leader =
    war.summary
      .leaderLeagueId;

  const winner =
    war.winnerLeagueId;

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/league-war"
            className="text-sm font-black text-slate-500 transition hover:text-rose-300"
          >
            ← League Wars
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <FcStatusBadge
              label={
                war.status
              }
              tone={
                war.status ===
                'LIVE'
                  ? 'red'
                  : war.status ===
                      'COMPLETED'
                    ? 'emerald'
                    : [
                          'REJECTED',
                          'CANCELLED',
                          'EXPIRED',
                        ].includes(
                          war.status,
                        )
                      ? 'slate'
                      : 'amber'
              }
            />

            {war.status ===
            'LIVE' ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                ● Live · 10s
                {lastUpdated
                  ? ` · ${lastUpdated.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </span>
            ) : null}

            {war.permissions
              .canRematch ? (
              <button
                type="button"
                disabled={
                  Boolean(
                    busy,
                  )
                }
                onClick={() =>
                  void createRematch()
                }
                className="min-h-9 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 text-xs font-black text-rose-300 disabled:opacity-40"
              >
                {busy ===
                'rematch'
                  ? 'Creating...'
                  : '↻ Rematch'}
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
            {
              error
            }
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[30px] border border-rose-400/20 bg-[#0B0F14] p-5 sm:p-7">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-400/10 blur-3xl" />

          <div className="relative text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-300">
              ⚔ FC Arena League War
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-4xl">
              {
                war.name
              }
            </h1>

            <p className="mt-2 text-xs text-slate-500">
              {
                war.playerCount
              }v{
                war.playerCount
              } · {
                war.legType ===
                'HOME_AWAY'
                  ? 'Home & Away'
                  : 'One Leg'
              } · {
                war.pairingMode
              } Pairing · W{
                war.winPoints
              } / D{
                war.drawPoints
              } / L{
                war.lossPoints
              }
            </p>
          </div>

          <div className="relative mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="min-w-0 text-center">
              <div className="mx-auto flex justify-center">
                <FcCrest
                  name={
                    war.homeLeague
                      .name
                  }
                  imageUrl={
                    war.homeLeague
                      .logoUrl
                  }
                  size="lg"
                />
              </div>

              <p className="mt-3 truncate text-sm font-black sm:text-lg">
                {
                  war.homeLeague
                    .name
                }
              </p>

              <p className={
                leader ===
                  war.homeLeague
                    .id ||
                winner ===
                  war.homeLeague
                    .id
                  ? 'mt-3 text-5xl font-black text-rose-300'
                  : 'mt-3 text-5xl font-black text-white'
              }>
                {
                  war.summary
                    .home.points
                }
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                War Points
              </p>

              <p className={
                war.readiness
                  .home
                  ? 'mt-2 text-[10px] font-black uppercase text-emerald-400'
                  : 'mt-2 text-[10px] font-black uppercase text-slate-600'
              }>
                {war.readiness
                  .home
                  ? '✓ Ready & Locked'
                  : 'Not Ready'}
              </p>
            </div>

            <div className="text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/[0.07] text-xl">
                ⚔
              </span>

              <p className="mt-3 text-xs font-black text-slate-400">
                {
                  war.summary
                    .completedMatches
                } / {
                  war.summary
                    .totalMatches
                }
              </p>

              <p className="text-[9px] uppercase tracking-wider text-slate-600">
                confirmed
              </p>
            </div>

            <div className="min-w-0 text-center">
              <div className="mx-auto flex justify-center">
                <FcCrest
                  name={
                    war.awayLeague
                      .name
                  }
                  imageUrl={
                    war.awayLeague
                      .logoUrl
                  }
                  size="lg"
                />
              </div>

              <p className="mt-3 truncate text-sm font-black sm:text-lg">
                {
                  war.awayLeague
                    .name
                }
              </p>

              <p className={
                leader ===
                  war.awayLeague
                    .id ||
                winner ===
                  war.awayLeague
                    .id
                  ? 'mt-3 text-5xl font-black text-rose-300'
                  : 'mt-3 text-5xl font-black text-white'
              }>
                {
                  war.summary
                    .away.points
                }
              </p>

              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                War Points
              </p>

              <p className={
                war.readiness
                  .away
                  ? 'mt-2 text-[10px] font-black uppercase text-emerald-400'
                  : 'mt-2 text-[10px] font-black uppercase text-slate-600'
              }>
                {war.readiness
                  .away
                  ? '✓ Ready & Locked'
                  : 'Not Ready'}
              </p>
            </div>
          </div>

          {war.status ===
          'COMPLETED' ? (
            <div className="relative mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                Final Result
              </p>

              <p className="mt-2 text-lg font-black">
                {winner
                  ? `${
                      winner ===
                      war.homeLeague
                        .id
                        ? war.homeLeague
                            .name
                        : war.awayLeague
                            .name
                    } wins the League War 🏆`
                  : 'League War ends in a draw 🤝'}
              </p>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <FcPanel className="p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
              Challenge Expiry
            </p>
            <p className="mt-2 text-sm font-black">
              {
                dateLabel(
                  war.challengeExpiresAt,
                )
              }
            </p>
          </FcPanel>

          <FcPanel className="p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
              Scheduled Start
            </p>
            <p className="mt-2 text-sm font-black">
              {
                dateLabel(
                  war.scheduledStartAt,
                )
              }
            </p>
          </FcPanel>

          <FcPanel className={
            deadlinePassed &&
            war.status ===
              'LIVE'
              ? 'border-red-400/25 p-4'
              : 'p-4'
          }>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">
              War Deadline
            </p>
            <p className={
              deadlinePassed &&
              war.status ===
                'LIVE'
                ? 'mt-2 text-sm font-black text-red-300'
                : 'mt-2 text-sm font-black'
            }>
              {
                dateLabel(
                  war.deadlineAt,
                )
              }
              {deadlinePassed &&
              war.status ===
                'LIVE'
                ? ' · OVERDUE'
                : ''}
            </p>
          </FcPanel>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <FcStatCard
            label="Home Wins"
            value={
              war.summary
                .home.wins
            }
            tone="cyan"
          />

          <FcStatCard
            label="Away Wins"
            value={
              war.summary
                .away.wins
            }
            tone="amber"
          />

          <FcStatCard
            label="Draws"
            value={
              war.summary
                .home.draws
            }
          />

          <FcStatCard
            label="Home GD"
            value={
              war.summary
                .home
                .goalDifference
            }
            tone="emerald"
          />

          <FcStatCard
            label="Away GD"
            value={
              war.summary
                .away
                .goalDifference
            }
            tone="emerald"
          />

          <FcStatCard
            label="Remaining"
            value={
              war.summary
                .remainingMatches
            }
          />
        </section>

        {war.status ===
          'INVITED' ? (
          <FcPanel className="border-amber-400/20 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  Challenge
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Waiting for decision
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Opponent League owner/admin can Accept or Reject. Challenger can Cancel before the War starts.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {war.permissions
                  .canAccept ? (
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void action(
                        'accept',
                        `/league-wars/${war.id}/accept`,
                      )
                    }
                    className="min-h-11 rounded-xl bg-emerald-400 px-5 text-sm font-black text-[#04130d] disabled:opacity-40"
                  >
                    {busy ===
                    'accept'
                      ? 'Accepting...'
                      : '✓ Accept Challenge'}
                  </button>
                ) : null}

                {war.permissions
                  .canReject ? (
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void reasonAction(
                        'reject',
                      )
                    }
                    className="min-h-11 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-5 text-sm font-black text-red-300 disabled:opacity-40"
                  >
                    Reject
                  </button>
                ) : null}

                {war.permissions
                  .canCancel ? (
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void reasonAction(
                        'cancel',
                      )
                    }
                    className="min-h-11 rounded-xl border border-white/10 px-5 text-sm font-black text-slate-400 disabled:opacity-40"
                  >
                    Cancel Challenge
                  </button>
                ) : null}
              </div>
            </div>
          </FcPanel>
        ) : null}

        {[
          'REJECTED',
          'CANCELLED',
          'EXPIRED',
        ].includes(
          war.status,
        ) ? (
          <FcPanel className="p-5">
            <p className="text-sm font-black text-slate-300">
              This challenge is {
                war.status.toLowerCase()
              }.
            </p>

            {war.rejectionReason ||
            war.cancellationReason ? (
              <p className="mt-2 text-sm text-slate-500">
                Reason: {
                  war.rejectionReason ||
                  war.cancellationReason
                }
              </p>
            ) : null}
          </FcPanel>
        ) : null}

        {war.status ===
        'ACCEPTED' ? (
          <section className="grid gap-4 xl:grid-cols-2">
            {[
              {
                side:
                  'home' as const,
                league:
                  war.homeLeague,
                canManage:
                  war.permissions
                    .canManageHome,
                candidates:
                  war.candidates
                    .home,
                selection:
                  homeSelection,
                roster:
                  war.roster
                    .home,
                ready:
                  war.readiness
                    .home,
              },
              {
                side:
                  'away' as const,
                league:
                  war.awayLeague,
                canManage:
                  war.permissions
                    .canManageAway,
                candidates:
                  war.candidates
                    .away,
                selection:
                  awaySelection,
                roster:
                  war.roster
                    .away,
                ready:
                  war.readiness
                    .away,
              },
            ].map(
              (
                side,
              ) => (
                <FcPanel
                  key={
                    side.side
                  }
                  className={
                    side.ready
                      ? 'overflow-hidden border-emerald-400/20'
                      : 'overflow-hidden'
                  }
                >
                  <div className="border-b border-white/[0.07] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FcCrest
                          name={
                            side.league
                              .name
                          }
                          imageUrl={
                            side.league
                              .logoUrl
                          }
                        />

                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-black">
                            {
                              side.league
                                .name
                            }
                          </h2>

                          <p className="text-xs text-slate-500">
                            Roster {
                              side.roster
                                .length
                            }/{
                              war.playerCount
                            }
                          </p>
                        </div>
                      </div>

                      <span className={
                        side.ready
                          ? 'rounded-full bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase text-emerald-300'
                          : 'rounded-full bg-white/[0.04] px-3 py-1 text-[9px] font-black uppercase text-slate-600'
                      }>
                        {side.ready
                          ? '✓ Ready & Locked'
                          : 'Not Ready'}
                      </span>
                    </div>
                  </div>

                  {side.canManage ? (
                    <div className="p-5">
                      <p className="text-xs leading-5 text-slate-500">
                        {war.pairingMode ===
                        'RANDOM'
                          ? 'Select the roster. Opponent pairings will be randomized when the War starts.'
                          : war.pairingMode ===
                              'MANUAL'
                            ? 'Selection order is the manual pairing order: Slot 1 vs Slot 1, Slot 2 vs Slot 2.'
                            : 'Select players in slot order. Slot 1 faces Slot 1, Slot 2 faces Slot 2.'}
                      </p>

                      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                        {side.candidates.map(
                          (
                            player,
                          ) => {
                            const selected =
                              side.selection.includes(
                                player.id,
                              );

                            const slot =
                              side.selection.indexOf(
                                player.id,
                              ) +
                              1;

                            return (
                              <button
                                key={
                                  player.id
                                }
                                type="button"
                                disabled={
                                  side.ready
                                }
                                onClick={() =>
                                  togglePlayer(
                                    side.side,
                                    player.id,
                                  )
                                }
                                className={
                                  selected
                                    ? 'flex w-full items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-400/[0.08] p-3 text-left disabled:cursor-not-allowed disabled:opacity-60'
                                    : 'flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left disabled:cursor-not-allowed disabled:opacity-60'
                                }
                              >
                                <span className={
                                  selected
                                    ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-400 text-xs font-black text-[#18070b]'
                                    : 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-xs font-black text-slate-600'
                                }>
                                  {selected
                                    ? slot
                                    : '+'}
                                </span>

                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black">
                                    {displayName(
                                      player,
                                    )}
                                  </span>

                                  <span className="mt-0.5 block font-mono text-[9px] text-slate-600">
                                    {
                                      player.playerCode ||
                                      'FC Arena Player'
                                    }
                                  </span>
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>

                      {!side.ready ? (
                        <button
                          type="button"
                          disabled={
                            Boolean(
                              busy,
                            )
                          }
                          onClick={() =>
                            void saveRoster(
                              side.side,
                            )
                          }
                          className="mt-4 min-h-11 w-full rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-5 text-sm font-black text-rose-300 disabled:opacity-40"
                        >
                          {busy ===
                          `roster-${side.side}`
                            ? 'Saving...'
                            : `Save Roster (${side.selection.length}/${war.playerCount})`}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={
                          Boolean(
                            busy,
                          ) ||
                          (
                            !side.ready &&
                            side.roster
                              .length !==
                              war.playerCount
                          )
                        }
                        onClick={() =>
                          void setReady(
                            side.side,
                            !side.ready,
                          )
                        }
                        className={
                          side.ready
                            ? 'mt-2 min-h-11 w-full rounded-xl border border-white/10 px-5 text-sm font-black text-slate-400 disabled:opacity-40'
                            : 'mt-2 min-h-11 w-full rounded-xl bg-emerald-400 px-5 text-sm font-black text-[#04130d] disabled:opacity-40'
                        }
                      >
                        {busy ===
                        `ready-${side.side}`
                          ? 'Updating...'
                          : side.ready
                            ? 'Unlock / Not Ready'
                            : '✓ Lock Roster & Ready'}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {side.roster.map(
                        (
                          row,
                        ) => (
                          <div
                            key={
                              row.id
                            }
                            className="flex items-center gap-3 px-5 py-3"
                          >
                            <span className="w-8 text-center text-xs font-black text-rose-300">
                              #{
                                row.slot
                              }
                            </span>

                            <p className="truncate text-sm font-black">
                              {displayName(
                                row.user,
                              )}
                            </p>
                          </div>
                        ),
                      )}

                      {side.roster
                        .length ===
                      0 ? (
                        <p className="p-5 text-sm text-slate-500">
                          Waiting for opponent roster.
                        </p>
                      ) : null}
                    </div>
                  )}
                </FcPanel>
              ),
            )}

            <FcPanel className="p-5 xl:col-span-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
                    Both-Team Ready Check
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Start League War
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Home: {
                      war.readiness
                        .home
                        ? 'Ready ✅'
                        : 'Waiting'
                    } · Away: {
                      war.readiness
                        .away
                        ? 'Ready ✅'
                        : 'Waiting'
                    }. Start unlocks only when both rosters are locked and the scheduled start time has arrived.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {war.permissions
                    .canCancel ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          busy,
                        )
                      }
                      onClick={() =>
                        void reasonAction(
                          'cancel',
                        )
                      }
                      className="min-h-12 rounded-xl border border-white/10 px-5 text-sm font-black text-slate-500"
                    >
                      Cancel War
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      !war.permissions
                        .canStart ||
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void action(
                        'start',
                        `/league-wars/${war.id}/start`,
                      )
                    }
                    className="min-h-12 rounded-xl bg-rose-400 px-7 text-sm font-black text-[#18070b] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busy ===
                    'start'
                      ? 'Starting...'
                      : 'Start War ⚔'}
                  </button>
                </div>
              </div>
            </FcPanel>
          </section>
        ) : null}

        {[
          'LIVE',
          'COMPLETED',
        ].includes(
          war.status,
        ) ? (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                  Battles
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Match Pairings
                </h2>
              </div>

              <p className="text-xs font-semibold text-slate-500">
                Submitted result → opponent confirm → official War Points
              </p>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {war.matches.map(
                (
                  match,
                ) => {
                  const row =
                    scores[
                      match.id
                    ] ?? {
                      home: '',
                      away: '',
                    };

                  const homeLeague =
                    match.homeLeagueId ===
                    war.homeLeague.id
                      ? war.homeLeague
                      : war.awayLeague;

                  const awayLeague =
                    match.awayLeagueId ===
                    war.awayLeague.id
                      ? war.awayLeague
                      : war.homeLeague;

                  const editable =
                    match.permissions
                      .canSubmit &&
                    [
                      'NONE',
                      'DISPUTED',
                    ].includes(
                      match.resultStatus,
                    );

                  const pending =
                    [
                      'PENDING_CONFIRMATION',
                      'WALKOVER_PENDING',
                    ].includes(
                      match.resultStatus,
                    );

                  const confirmed =
                    match.status ===
                    'COMPLETED';

                  return (
                    <FcPanel
                      key={
                        match.id
                      }
                      className={
                        match.resultStatus ===
                        'DISPUTED'
                          ? 'border-red-400/25 p-4 sm:p-5'
                          : pending
                            ? 'border-amber-400/20 p-4 sm:p-5'
                            : confirmed
                              ? 'border-emerald-400/15 p-4 sm:p-5'
                              : 'p-4 sm:p-5'
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                          Match {
                            match.sequence
                          } · Leg {
                            match.leg
                          }
                        </p>

                        <FcStatusBadge
                          label={
                            match.resultStatus ===
                            'NONE'
                              ? match.status
                              : match.resultStatus
                          }
                          tone={
                            resultTone(
                              match.resultStatus,
                            )
                          }
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 text-right">
                          <p className="truncate text-sm font-black">
                            {displayName(
                              match.homePlayer,
                            )}
                          </p>

                          <p className="mt-1 truncate text-[9px] text-slate-600">
                            {
                              homeLeague.name
                            }
                          </p>
                        </div>

                        {editable ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={
                                row.home
                              }
                              onChange={(
                                event,
                              ) =>
                                setScores(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [match.id]: {
                                      ...row,
                                      home:
                                        event
                                          .target
                                          .value,
                                    },
                                  }),
                                )
                              }
                              className="h-11 w-14 rounded-lg border border-white/10 bg-black/20 text-center text-lg font-black outline-none focus:border-rose-400/40"
                            />

                            <span className="text-xs font-black text-slate-600">
                              –
                            </span>

                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={
                                row.away
                              }
                              onChange={(
                                event,
                              ) =>
                                setScores(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [match.id]: {
                                      ...row,
                                      away:
                                        event
                                          .target
                                          .value,
                                    },
                                  }),
                                )
                              }
                              className="h-11 w-14 rounded-lg border border-white/10 bg-black/20 text-center text-lg font-black outline-none focus:border-rose-400/40"
                            />
                          </div>
                        ) : (
                          <span className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-xl font-black">
                            {
                              match.homeScore ??
                              '—'
                            } – {
                              match.awayScore ??
                              '—'
                            }
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {displayName(
                              match.awayPlayer,
                            )}
                          </p>

                          <p className="mt-1 truncate text-[9px] text-slate-600">
                            {
                              awayLeague.name
                            }
                          </p>
                        </div>
                      </div>

                      {editable ? (
                        <div className="mt-4 space-y-3">
                          <input
                            value={
                              proofs[
                                match.id
                              ] ??
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setProofs(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [match.id]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                            placeholder="Screenshot / proof URL (optional)"
                            className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs outline-none focus:border-rose-400/40"
                          />

                          <button
                            type="button"
                            disabled={
                              Boolean(
                                busy,
                              )
                            }
                            onClick={() =>
                              void submitResult(
                                match,
                              )
                            }
                            className="min-h-10 w-full rounded-xl bg-rose-400 px-4 text-xs font-black text-[#18070b] disabled:opacity-40"
                          >
                            {busy ===
                            `match-${match.id}`
                              ? 'Submitting...'
                              : match.resultStatus ===
                                  'DISPUTED'
                                ? 'Resubmit Corrected Result'
                                : 'Submit Result for Confirmation'}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={
                                Boolean(
                                  busy,
                                )
                              }
                              onClick={() =>
                                void submitWalkover(
                                  match,
                                  match.homeLeagueId,
                                )
                              }
                              className="min-h-10 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-2 text-[10px] font-black text-amber-300"
                            >
                              {homeLeague.name} Walkover
                            </button>

                            <button
                              type="button"
                              disabled={
                                Boolean(
                                  busy,
                                )
                              }
                              onClick={() =>
                                void submitWalkover(
                                  match,
                                  match.awayLeagueId,
                                )
                              }
                              className="min-h-10 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-2 text-[10px] font-black text-amber-300"
                            >
                              {awayLeague.name} Walkover
                            </button>
                          </div>

                          <p className="text-[10px] leading-4 text-slate-600">
                            Walkover is recorded as 3–0 and still needs opponent confirmation.
                          </p>
                        </div>
                      ) : null}

                      {pending ? (
                        <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
                          <p className="text-xs font-black text-amber-300">
                            Waiting for opponent confirmation
                          </p>

                          {match.proofUrl ? (
                            <a
                              href={
                                match.proofUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-[11px] font-black text-cyan-300 underline"
                            >
                              View Match Proof ↗
                            </a>
                          ) : null}

                          {match.permissions
                            .canConfirm ? (
                            <div className="mt-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(
                                      busy,
                                    )
                                  }
                                  onClick={() =>
                                    void action(
                                      `confirm-${match.id}`,
                                      `/league-wars/${war.id}/matches/${match.id}/confirm`,
                                    )
                                  }
                                  className="min-h-10 rounded-xl bg-emerald-400 px-3 text-xs font-black text-[#04130d] disabled:opacity-40"
                                >
                                  ✓ Confirm
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    Boolean(
                                      busy,
                                    )
                                  }
                                  onClick={() =>
                                    void disputeResult(
                                      match,
                                    )
                                  }
                                  className="min-h-10 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-3 text-xs font-black text-red-300 disabled:opacity-40"
                                >
                                  ⚠ Dispute
                                </button>
                              </div>

                              <input
                                value={
                                  disputes[
                                    match.id
                                  ] ??
                                  ''
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setDisputes(
                                    (
                                      current,
                                    ) => ({
                                      ...current,
                                      [match.id]:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                                }
                                placeholder="Dispute reason (required only if disputing)"
                                className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs outline-none"
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {match.resultStatus ===
                      'DISPUTED' ? (
                        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3">
                          <p className="text-xs font-black text-red-300">
                            Result disputed
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {
                              match.disputeReason ||
                              'Opponent requested a corrected result.'
                            }
                          </p>
                        </div>
                      ) : null}

                      {confirmed ? (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[10px] font-bold text-slate-600">
                          <span>
                            ✓ Official confirmed result
                          </span>

                          {match.walkoverLeagueId ? (
                            <span className="text-amber-300">
                              Walkover
                            </span>
                          ) : null}

                          {match.proofUrl ? (
                            <a
                              href={
                                match.proofUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-300 underline"
                            >
                              Proof ↗
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </FcPanel>
                  );
                },
              )}
            </div>

            {war.status ===
              'LIVE' &&
            war.permissions
              .canComplete ? (
              <FcPanel className="mt-4 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                      Final Whistle
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Complete League War
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Every result must be opponent-confirmed first. Winner: War Points → GD → Goals Scored → Wins.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !allMatchesComplete ||
                      Boolean(
                        busy,
                      )
                    }
                    onClick={() =>
                      void action(
                        'complete',
                        `/league-wars/${war.id}/complete`,
                      )
                    }
                    className="min-h-12 rounded-xl bg-amber-300 px-7 text-sm font-black text-[#151006] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busy ===
                    'complete'
                      ? 'Completing...'
                      : 'Complete & Lock Winner 🏆'}
                  </button>
                </div>
              </FcPanel>
            ) : null}
          </section>
        ) : null}

        {war.playerStats.length >
        0 ? (
          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <FcPanel className="relative overflow-hidden border-amber-300/20 p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />

              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                  War MVP
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {war.mvp
                    ? war.mvp.inGameName ||
                      war.mvp.fullName
                    : '—'}
                </h2>

                {war.mvp ? (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-center">
                      <p className="text-xl font-black text-amber-300">
                        {
                          war.mvp.wins
                        }
                      </p>
                      <p className="mt-1 text-[8px] font-black uppercase text-slate-600">
                        Wins
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-center">
                      <p className="text-xl font-black">
                        {
                          war.mvp.goalDifference
                        }
                      </p>
                      <p className="mt-1 text-[8px] font-black uppercase text-slate-600">
                        GD
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-center">
                      <p className="text-xl font-black">
                        {
                          war.mvp.winRate
                        }%
                      </p>
                      <p className="mt-1 text-[8px] font-black uppercase text-slate-600">
                        Win Rate
                      </p>
                    </div>
                  </div>
                ) : null}

                <p className="mt-4 text-[10px] leading-5 text-slate-600">
                  MVP order: Wins → Goal Difference → Goals For → fewer losses.
                </p>
              </div>
            </FcPanel>

            <FcPanel className="overflow-hidden">
              <div className="border-b border-white/[0.07] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  Player War Stats
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Live Player Table
                </h2>
              </div>

              <div className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto">
                {war.playerStats.map(
                  (
                    row,
                  ) => (
                    <div
                      key={
                        row.userId
                      }
                      className="grid grid-cols-[32px_1fr_auto] items-center gap-3 px-5 py-3"
                    >
                      <span className={
                        row.position <=
                        3
                          ? 'text-center text-sm font-black text-emerald-300'
                          : 'text-center text-xs font-black text-slate-600'
                      }>
                        #{
                          row.position
                        }
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            row.inGameName ||
                            row.fullName
                          }
                        </p>

                        <p className="mt-0.5 text-[9px] text-slate-600">
                          {
                            row.matches
                          }P · {
                            row.wins
                          }W · {
                            row.draws
                          }D · {
                            row.losses
                          }L
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-black text-slate-300">
                          GD {
                            row.goalDifference
                          }
                        </p>

                        <p className="mt-0.5 text-[9px] text-slate-600">
                          {
                            row.winRate
                          }%
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          </section>
        ) : null}

        <FcPanel className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Rivalry
            </p>

            <h2 className="mt-1 text-xl font-black">
              {
                war.homeLeague
                  .name
              } vs {
                war.awayLeague
                  .name
              }
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 p-5 text-center">
            <div>
              <p className="text-2xl font-black text-cyan-300">
                {
                  war.rivalry
                    .homeWins
                }
              </p>
              <p className="mt-1 text-[9px] font-black uppercase text-slate-600">
                {
                  war.homeLeague
                    .name
                } Wins
              </p>
            </div>

            <div>
              <p className="text-2xl font-black">
                {
                  war.rivalry
                    .draws
                }
              </p>
              <p className="mt-1 text-[9px] font-black uppercase text-slate-600">
                Draws
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-amber-300">
                {
                  war.rivalry
                    .awayWins
                }
              </p>
              <p className="mt-1 text-[9px] font-black uppercase text-slate-600">
                {
                  war.awayLeague
                    .name
                } Wins
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.07] px-5 py-4 text-xs text-slate-500">
            Previous wars: <strong className="text-slate-300">{war.rivalry.previousWars}</strong> · Historical battle points: <strong className="text-slate-300">{war.rivalry.homeBattlePoints} – {war.rivalry.awayBattlePoints}</strong>
          </div>
        </FcPanel>

        <details className="rounded-2xl border border-white/[0.07] bg-white/[0.025]" open>
          <summary className="cursor-pointer px-5 py-4 text-sm font-black">
            How League War V2 works
          </summary>

          <div className="grid gap-3 border-t border-white/[0.07] p-5 md:grid-cols-2">
            {[
              [
                'Ready + Roster Lock',
                'Both admins select their roster, lock it and mark Ready. Start unlocks only after both sides are Ready.',
              ],
              [
                'Result Confirmation',
                'A submitted score does not count immediately. The opposing League admin must confirm it first.',
              ],
              [
                'Proof + Dispute',
                'Result proof URL is supported. Opponent can dispute and request a corrected resubmission.',
              ],
              [
                'Walkover',
                'Admin can submit a 3–0 walkover. It still requires opponent confirmation before points count.',
              ],
              [
                'Pairing',
                'Auto Slot, Manual Slot Order and Random Draw are supported. Home & Away reverses the actual second-leg home side.',
              ],
              [
                'Winner',
                `Win = ${war.winPoints}, Draw = ${war.drawPoints}, Loss = ${war.lossPoints}. Tie-break: War Points → GD → Goals Scored → Wins.`,
              ],
            ].map(
              (
                rule,
              ) => (
                <div
                  key={
                    rule[0]
                  }
                  className="rounded-xl border border-white/[0.07] bg-black/10 p-4"
                >
                  <p className="text-sm font-black text-slate-200">
                    {
                      rule[0]
                    }
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {
                      rule[1]
                    }
                  </p>
                </div>
              ),
            )}
          </div>
        </details>
      </div>
    </AppShell>
  );
}
