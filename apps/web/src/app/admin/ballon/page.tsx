'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AdminNavigation,
} from '@/components/admin/admin-navigation';
import {
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface AdminLeague {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
  league: {
    id: string;
    name: string;
  };
}

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  status: string;
  eligibleLeagueIds:
    string[];
  scoringConfig:
    Record<string, number>;
  finalWinnerUserId:
    string | null;
  risingStarUserId:
    string | null;
  lockedAt: string | null;
}

function isoDate(
  value: string,
) {
  return new Date(
    value,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function AdminBallonPage() {
  const [
    seasons,
    setSeasons,
  ] =
    useState<Season[]>(
      [],
    );

  const [
    leagues,
    setLeagues,
  ] =
    useState<
      AdminLeague[]
    >([]);

  const [
    selectedLeagueIds,
    setSelectedLeagueIds,
  ] =
    useState<string[]>(
      [],
    );

  const [
    name,
    setName,
  ] =
    useState(
      'FC Arena Ballon Season 01',
    );

  const today =
    new Date();

  const defaultStart =
    today
      .toISOString()
      .slice(
        0,
        10,
      );

  const plusThree =
    new Date(
      today,
    );

  plusThree.setMonth(
    plusThree.getMonth() +
      3,
  );

  const [
    startAt,
    setStartAt,
  ] =
    useState(
      defaultStart,
    );

  const [
    endAt,
    setEndAt,
  ] =
    useState(
      plusThree
        .toISOString()
        .slice(
          0,
          10,
        ),
    );

  const [
    minimumMatches,
    setMinimumMatches,
  ] =
    useState(15);

  function applyPeriodPreset(
    months: 1 | 2 | 3,
  ) {
    const start =
      new Date(
        startAt +
          'T00:00:00',
      );

    const end =
      new Date(
        start,
      );

    end.setMonth(
      end.getMonth() +
        months,
    );

    end.setDate(
      end.getDate() -
        1,
    );

    setEndAt(
      end
        .toISOString()
        .slice(
          0,
          10,
        ),
    );

    setMinimumMatches(
      months === 1
        ? 6
        : months === 2
          ? 10
          : 15,
    );
  }

  const [
    rankingLimit,
    setRankingLimit,
  ] =
    useState<
      10 | 20 | 50
    >(20);

  const [
    busy,
    setBusy,
  ] =
    useState('');

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

  async function load() {
    const [
      leagueResponse,
      seasonResponse,
    ] =
      await Promise.all([
        authenticatedRequest<any>(
          '/leagues/my',
        ),
        authenticatedRequest<any>(
          '/ballon/seasons',
        ),
      ]);

    const adminLeagues:
      AdminLeague[] =
      (
        leagueResponse
          .data
          .leagues ??
        []
      ).filter(
        (
          item:
            AdminLeague,
        ) =>
          Boolean(
            item.adminRole,
          ),
      );

    setLeagues(
      adminLeagues,
    );

    setSeasons(
      seasonResponse
        .data
        .seasons ??
        [],
    );

    if (
      selectedLeagueIds.length ===
        0 &&
      adminLeagues.length >
        0
    ) {
      setSelectedLeagueIds(
        [
          adminLeagues[0]
            .league.id,
        ],
      );
    }
  }

  useEffect(() => {
    void load().catch(
      (
        err,
      ) =>
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Ballon admin.',
        ),
    );
  }, []);

  const canCreate =
    useMemo(
      () =>
        name.trim()
          .length >=
          3 &&
        Boolean(
          startAt,
        ) &&
        Boolean(
          endAt,
        ) &&
        selectedLeagueIds
          .length >
          0,
      [
        endAt,
        name,
        selectedLeagueIds,
        startAt,
      ],
    );

  function toggleLeague(
    leagueId: string,
  ) {
    setSelectedLeagueIds(
      (
        current,
      ) =>
        current.includes(
          leagueId,
        )
          ? current.filter(
              (
                id,
              ) =>
                id !==
                leagueId,
            )
          : [
              ...current,
              leagueId,
            ],
    );
  }

  async function createSeason() {
    if (
      !canCreate
    ) {
      return;
    }

    setBusy(
      'create',
    );
    setMessage(
      '',
    );
    setError(
      '',
    );

    try {
      await authenticatedRequest(
        '/admin/ballon/seasons',
        {
          method:
            'POST',
          body:
            JSON.stringify({
              name:
                name.trim(),
              startAt:
                new Date(
                  startAt +
                    'T00:00:00',
                ).toISOString(),
              endAt:
                new Date(
                  endAt +
                    'T23:59:59',
                ).toISOString(),
              minimumMatches,
              rankingLimit,
              eligibleLeagueIds:
                selectedLeagueIds,
              eligibleTournamentIds:
                [],
            }),
        },
      );

      setMessage(
        'Ballon season created as DRAFT.',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create Ballon season.',
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  async function transition(
    seasonId: string,
    action:
      | 'start'
      | 'finalize'
      | 'lock'
      | 'archive',
  ) {
    setBusy(
      seasonId +
        action,
    );
    setMessage(
      '',
    );
    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/admin/ballon/seasons/${seasonId}/${action}`,
        {
          method:
            'POST',
        },
      );

      setMessage(
        `Season ${action} completed.`,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} season.`,
      );
    } finally {
      setBusy(
        '',
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="FC Arena Ballon"
      subtitle="Create, start, finalize, lock and archive seasonal player ranking periods. Scoring rules freeze when a season goes LIVE."
    >
      <AdminNavigation />

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm font-semibold text-emerald-300">
          {
            message
          }
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
          {
            error
          }
        </div>
      ) : null}

      <FcPanel className="p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          New Season
        </p>

        <h2 className="mt-1 text-xl font-black">
          Create Ballon Period
        </h2>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              1,
              2,
              3,
            ] as const
          ).map(
            (
              months,
            ) => (
              <button
                key={
                  months
                }
                type="button"
                onClick={() =>
                  applyPeriodPreset(
                    months,
                  )
                }
                className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2.5 text-xs font-black text-amber-200"
              >
                {
                  months
                } Month{
                  months >
                  1
                    ? 's'
                    : ''
                }
              </button>
            ),
          )}

          <span className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-xs font-bold text-slate-500">
            Or choose custom dates below
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-300">
            Season Name
            <input
              value={
                name
              }
              onChange={
                (
                  event,
                ) =>
                  setName(
                    event
                      .target
                      .value,
                  )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none focus:border-amber-300/40"
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Ranking Size
            <select
              value={
                rankingLimit
              }
              onChange={
                (
                  event,
                ) =>
                  setRankingLimit(
                    Number(
                      event
                        .target
                        .value,
                    ) as
                      | 10
                      | 20
                      | 50,
                  )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#121821] px-4 py-3 text-sm outline-none"
            >
              <option value="10">
                Top 10
              </option>
              <option value="20">
                Top 20
              </option>
              <option value="50">
                Top 50
              </option>
            </select>
          </label>

          <label className="text-sm font-bold text-slate-300">
            Start Date
            <input
              type="date"
              value={
                startAt
              }
              onChange={
                (
                  event,
                ) =>
                  setStartAt(
                    event
                      .target
                      .value,
                  )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            End Date
            <input
              type="date"
              value={
                endAt
              }
              onChange={
                (
                  event,
                ) =>
                  setEndAt(
                    event
                      .target
                      .value,
                  )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none"
            />
          </label>

          <label className="text-sm font-bold text-slate-300">
            Minimum Matches
            <input
              type="number"
              min={1}
              max={100}
              value={
                minimumMatches
              }
              onChange={
                (
                  event,
                ) =>
                  setMinimumMatches(
                    Math.max(
                      1,
                      Number(
                        event
                          .target
                          .value,
                      ) ||
                        1,
                    ),
                  )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none"
            />
          </label>
        </div>

        <div className="mt-5">
          <p className="text-sm font-bold text-slate-300">
            Eligible Leagues
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {leagues.map(
              (
                item,
              ) => {
                const selected =
                  selectedLeagueIds.includes(
                    item
                      .league.id,
                  );

                return (
                  <button
                    key={
                      item
                        .league.id
                    }
                    type="button"
                    onClick={() =>
                      toggleLeague(
                        item
                          .league.id,
                      )
                    }
                    className={
                      selected
                        ? 'rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-sm font-black text-amber-200'
                        : 'rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm font-black text-slate-500'
                    }
                  >
                    {
                      item
                        .league
                        .name
                    }
                  </button>
                );
              },
            )}
          </div>

          {leagues.length ===
          0 ? (
            <p className="mt-2 text-sm text-slate-500">
              You need League admin access to create a scoped Ballon season. Global seasons require Super Admin access.
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs leading-6 text-slate-500">
          Default rating: Match Performance 30 · Attack 20 · Defence 15 · Goal Difference 15 · Big Matches 15 · Consistency 5. These weights are server-validated and become immutable after Start.
        </div>

        <button
          type="button"
          disabled={
            !canCreate ||
            busy ===
              'create'
          }
          onClick={() =>
            void createSeason()
          }
          className="mt-5 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#151006] disabled:opacity-40"
        >
          {
            busy ===
            'create'
              ? 'Creating...'
              : 'Create Draft Season'
          }
        </button>
      </FcPanel>

      <section>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Ballon Seasons
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {seasons.map(
            (
              season,
            ) => (
              <FcPanel
                key={
                  season.id
                }
                className="p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black">
                      {
                        season.name
                      }
                    </h2>

                    <p className="mt-2 text-xs text-slate-500">
                      {isoDate(
                        season.startAt,
                      )}{' '}
                      →{' '}
                      {isoDate(
                        season.endAt,
                      )}
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      Minimum{' '}
                      {
                        season.minimumMatches
                      }{' '}
                      matches · Top{' '}
                      {
                        season.rankingLimit
                      }
                    </p>
                  </div>

                  <FcStatusBadge
                    label={
                      season.status
                    }
                    tone={
                      season.status ===
                        'LOCKED' ||
                      season.status ===
                        'ARCHIVED'
                        ? 'emerald'
                        : season.status ===
                            'LIVE'
                          ? 'cyan'
                          : 'amber'
                    }
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {season.status ===
                  'DRAFT' ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          busy,
                        )
                      }
                      onClick={() =>
                        void transition(
                          season.id,
                          'start',
                        )
                      }
                      className="rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-black text-[#031019]"
                    >
                      Start Season
                    </button>
                  ) : null}

                  {season.status ===
                  'LIVE' ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          busy,
                        )
                      }
                      onClick={() =>
                        void transition(
                          season.id,
                          'finalize',
                        )
                      }
                      className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-200"
                    >
                      Finalize
                    </button>
                  ) : null}

                  {season.status ===
                  'FINALIZING' ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          busy,
                        )
                      }
                      onClick={() =>
                        void transition(
                          season.id,
                          'lock',
                        )
                      }
                      className="rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-[#151006]"
                    >
                      Lock Final Ranking
                    </button>
                  ) : null}

                  {season.status ===
                  'LOCKED' ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          busy,
                        )
                      }
                      onClick={() =>
                        void transition(
                          season.id,
                          'archive',
                        )
                      }
                      className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-slate-300"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </FcPanel>
            ),
          )}

          {seasons.length ===
          0 ? (
            <FcPanel className="p-8 text-center text-sm text-slate-500">
              No Ballon seasons created yet.
            </FcPanel>
          ) : null}
        </div>
      </section>
    </SecondaryFeaturePage>
  );
}
