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

interface AdminTournament {
  id: string;
  leagueId: string;
  name: string;
  status: string;
  mode: string;
}

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  status: string;
  eligibleLeagueIds: string[];
  eligibleTournamentIds: string[];
  scoringConfig: Record<string, number>;
  finalWinnerUserId: string | null;
  risingStarUserId: string | null;
  lockedAt: string | null;
}

type ScopeMode =
  | 'LEAGUES'
  | 'TOURNAMENTS';

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

function todayDate() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function defaultEndDate(
  startAt: string,
) {
  const start =
    new Date(
      startAt +
        'T00:00:00Z',
    );

  start.setUTCMonth(
    start.getUTCMonth() +
      3,
  );

  start.setUTCDate(
    start.getUTCDate() -
      1,
  );

  return start
    .toISOString()
    .slice(
      0,
      10,
    );
}

export default function AdminBallonPage() {
  const defaultStart =
    todayDate();

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
    tournaments,
    setTournaments,
  ] =
    useState<
      AdminTournament[]
    >([]);

  const [
    scopeMode,
    setScopeMode,
  ] =
    useState<ScopeMode>(
      'LEAGUES',
    );

  const [
    selectedLeagueIds,
    setSelectedLeagueIds,
  ] =
    useState<string[]>(
      [],
    );

  const [
    selectedTournamentIds,
    setSelectedTournamentIds,
  ] =
    useState<string[]>(
      [],
    );

  const [
    editingSeasonId,
    setEditingSeasonId,
  ] =
    useState<
      string | null
    >(null);

  const [
    name,
    setName,
  ] =
    useState(
      'FC Arena Ballon Season 01',
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
      defaultEndDate(
        defaultStart,
      ),
    );

  const [
    minimumMatches,
    setMinimumMatches,
  ] =
    useState(15);

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
          '/admin/ballon/seasons',
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

    setSelectedLeagueIds(
      (
        current,
      ) =>
        current.length >
        0
          ? current
          : adminLeagues[0]
              ?.league.id
            ? [
                adminLeagues[0]
                  .league.id,
              ]
            : [],
    );
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

  useEffect(() => {
    if (
      leagues.length ===
      0
    ) {
      setTournaments(
        [],
      );
      return;
    }

    let cancelled =
      false;

    void Promise.all(
      leagues.map(
        (
          item,
        ) =>
          authenticatedRequest<any>(
            `/leagues/${item.league.id}/tournaments`,
          ),
      ),
    )
      .then(
        (
          responses,
        ) => {
          if (
            cancelled
          ) {
            return;
          }

          const unique =
            new Map<
              string,
              AdminTournament
            >();

          for (
            const response
            of responses
          ) {
            for (
              const tournament
              of response
                .data
                .tournaments ??
              []
            ) {
              if (
                tournament.mode !==
                'SOLO'
              ) {
                continue;
              }

              unique.set(
                tournament.id,
                tournament,
              );
            }
          }

          setTournaments(
            [
              ...unique.values(),
            ].sort(
              (
                first,
                second,
              ) =>
                first.name.localeCompare(
                  second.name,
                ),
            ),
          );
        },
      )
      .catch(
        (
          err,
        ) => {
          if (
            !cancelled
          ) {
            setError(
              err instanceof Error
                ? err.message
                : 'Unable to load eligible SOLO tournaments.',
            );
          }
        },
      );

    return () => {
      cancelled =
        true;
    };
  }, [
    leagues,
  ]);

  const canSave =
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
        (
          scopeMode ===
            'LEAGUES'
            ? selectedLeagueIds
                .length >
              0
            : selectedTournamentIds
                .length >
              0
        ),
      [
        endAt,
        name,
        scopeMode,
        selectedLeagueIds,
        selectedTournamentIds,
        startAt,
      ],
    );

  function applyPeriodPreset(
    months:
      | 1
      | 2
      | 3,
  ) {
    const start =
      new Date(
        startAt +
          'T00:00:00Z',
      );

    const end =
      new Date(
        start,
      );

    end.setUTCMonth(
      end.getUTCMonth() +
        months,
    );

    end.setUTCDate(
      end.getUTCDate() -
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
      months ===
        1
        ? 6
        : months ===
            2
          ? 10
          : 15,
    );
  }

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

  function toggleTournament(
    tournamentId:
      string,
  ) {
    setSelectedTournamentIds(
      (
        current,
      ) =>
        current.includes(
          tournamentId,
        )
          ? current.filter(
              (
                id,
              ) =>
                id !==
                tournamentId,
            )
          : [
              ...current,
              tournamentId,
            ],
    );
  }

  function resetForm() {
    const nextStart =
      todayDate();

    setEditingSeasonId(
      null,
    );

    setName(
      'FC Arena Ballon Season 01',
    );

    setStartAt(
      nextStart,
    );

    setEndAt(
      defaultEndDate(
        nextStart,
      ),
    );

    setMinimumMatches(
      15,
    );

    setRankingLimit(
      20,
    );

    setScopeMode(
      'LEAGUES',
    );

    setSelectedTournamentIds(
      [],
    );

    setSelectedLeagueIds(
      leagues[0]?.league.id
        ? [
            leagues[0]
              .league.id,
          ]
        : [],
    );
  }

  function editSeason(
    season: Season,
  ) {
    if (
      season.status !==
      'DRAFT'
    ) {
      return;
    }

    const tournamentScope =
      (
        season
          .eligibleTournamentIds ??
        []
      ).length >
      0 &&
      (
        season
          .eligibleLeagueIds ??
        []
      ).length ===
      0;

    setEditingSeasonId(
      season.id,
    );

    setName(
      season.name,
    );

    setStartAt(
      isoDate(
        season.startAt,
      ),
    );

    setEndAt(
      isoDate(
        season.endAt,
      ),
    );

    setMinimumMatches(
      season.minimumMatches,
    );

    setRankingLimit(
      (
        [
          10,
          20,
          50,
        ].includes(
          season.rankingLimit,
        )
          ? season.rankingLimit
          : 20
      ) as
        | 10
        | 20
        | 50,
    );

    setScopeMode(
      tournamentScope
        ? 'TOURNAMENTS'
        : 'LEAGUES',
    );

    setSelectedLeagueIds(
      season
        .eligibleLeagueIds ??
        [],
    );

    setSelectedTournamentIds(
      season
        .eligibleTournamentIds ??
        [],
    );

    window.scrollTo({
      top: 0,
      behavior:
        'smooth',
    });
  }

  async function saveSeason() {
    if (
      !canSave
    ) {
      return;
    }

    const operation =
      editingSeasonId
        ? 'update'
        : 'create';

    setBusy(
      operation,
    );

    setMessage(
      '',
    );

    setError(
      '',
    );

    try {
      const payload = {
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
          scopeMode ===
          'LEAGUES'
            ? selectedLeagueIds
            : [],
        eligibleTournamentIds:
          scopeMode ===
          'TOURNAMENTS'
            ? selectedTournamentIds
            : [],
      };

      if (
        editingSeasonId
      ) {
        await authenticatedRequest(
          `/admin/ballon/seasons/${editingSeasonId}`,
          {
            method:
              'PATCH',
            body:
              JSON.stringify(
                payload,
              ),
          },
        );
      } else {
        await authenticatedRequest(
          '/admin/ballon/seasons',
          {
            method:
              'POST',
            body:
              JSON.stringify(
                payload,
              ),
          },
        );
      }

      setMessage(
        editingSeasonId
          ? 'Draft Ballon season updated.'
          : 'Ballon season created as DRAFT.',
      );

      resetForm();
      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save Ballon season.',
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

      if (
        editingSeasonId ===
        seasonId
      ) {
        resetForm();
      }

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

  const selectedTournamentCount =
    selectedTournamentIds.length;

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="FC Arena Ballon"
      subtitle="Create and control seasonal ranking periods. Draft rules can be edited; once LIVE, scoring and scope are frozen."
    >
      <AdminNavigation />

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm font-semibold text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm font-semibold text-red-300">
          {error}
        </div>
      ) : null}

      <FcPanel className="p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          {editingSeasonId
            ? 'Edit Draft'
            : 'New Season'}
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">
            {editingSeasonId
              ? 'Update Ballon Period'
              : 'Create Ballon Period'}
          </h2>

          {editingSeasonId ? (
            <button
              type="button"
              onClick={
                resetForm
              }
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-slate-400"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

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
                {months}{' '}
                Month{
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
              value={name}
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

        <div className="mt-6">
          <p className="text-sm font-bold text-slate-300">
            Competition Scope
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setScopeMode(
                  'LEAGUES',
                )
              }
              className={
                scopeMode ===
                'LEAGUES'
                  ? 'rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-200'
                  : 'rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-black text-slate-500'
              }
            >
              Entire League Scope
            </button>

            <button
              type="button"
              onClick={() =>
                setScopeMode(
                  'TOURNAMENTS',
                )
              }
              className={
                scopeMode ===
                'TOURNAMENTS'
                  ? 'rounded-xl border border-sky-300/30 bg-sky-300/10 px-4 py-2.5 text-xs font-black text-sky-200'
                  : 'rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-black text-slate-500'
              }
            >
              Selected Tournaments
            </button>
          </div>
        </div>

        {scopeMode ===
        'LEAGUES' ? (
          <div className="mt-5">
            <p className="text-sm font-bold text-slate-300">
              Eligible Leagues
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Every eligible SOLO tournament inside the selected leagues can contribute during the Ballon period.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-300">
                  Eligible SOLO Tournaments
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Only the tournaments selected here contribute to this Ballon season.
                </p>
              </div>

              <p className="text-xs font-black text-sky-300">
                {selectedTournamentCount}{' '}
                selected
              </p>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {tournaments.map(
                (
                  tournament,
                ) => {
                  const selected =
                    selectedTournamentIds.includes(
                      tournament.id,
                    );

                  const league =
                    leagues.find(
                      (
                        item,
                      ) =>
                        item
                          .league.id ===
                        tournament.leagueId,
                    );

                  return (
                    <button
                      key={
                        tournament.id
                      }
                      type="button"
                      onClick={() =>
                        toggleTournament(
                          tournament.id,
                        )
                      }
                      className={
                        selected
                          ? 'rounded-xl border border-sky-300/30 bg-sky-300/10 p-4 text-left'
                          : 'rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-left'
                      }
                    >
                      <span className="block text-sm font-black">
                        {
                          tournament.name
                        }
                      </span>

                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {
                          league
                            ?.league
                            .name ??
                          'League'
                        }{' '}
                        ·{' '}
                        {
                          tournament.status
                        }
                      </span>
                    </button>
                  );
                },
              )}

              {tournaments.length ===
              0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                  No SOLO tournaments are available in your administered leagues.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {leagues.length ===
        0 ? (
          <p className="mt-5 text-sm text-slate-500">
            You need League admin access to create a scoped Ballon season. Global seasons remain Super Admin only.
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-xs leading-6 text-slate-500">
          Default rating: Match Performance 30 · Attack 20 · Defence 15 · Goal Difference 15 · Big Matches 15 · Consistency 5. These weights are server-validated and become immutable after Start.
        </div>

        <button
          type="button"
          disabled={
            !canSave ||
            busy ===
              'create' ||
            busy ===
              'update'
          }
          onClick={() =>
            void saveSeason()
          }
          className="mt-5 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#151006] disabled:opacity-40"
        >
          {
            busy ===
              'create' ||
            busy ===
              'update'
              ? 'Saving...'
              : editingSeasonId
                ? 'Save Draft Changes'
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
            ) => {
              const tournamentScope =
                (
                  season
                    .eligibleTournamentIds ??
                  []
                ).length >
                0 &&
                (
                  season
                    .eligibleLeagueIds ??
                  []
                ).length ===
                0;

              return (
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

                      <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                        {tournamentScope
                          ? `${season.eligibleTournamentIds.length} selected tournament(s)`
                          : `${season.eligibleLeagueIds.length} league scope(s)`}
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
                      <>
                        <button
                          type="button"
                          disabled={
                            Boolean(
                              busy,
                            )
                          }
                          onClick={() =>
                            editSeason(
                              season,
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-slate-300"
                        >
                          Edit Draft
                        </button>

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
                      </>
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
              );
            },
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
