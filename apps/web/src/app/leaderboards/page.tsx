'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  FcEmptyState,
  FcErrorState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
  getCurrentUser,
} from '@/lib/auth-client';

interface Membership {
  league: {
    id: string;
    name: string;
  };
}

interface RankingRow {
  position: number;
  userId: string;
  fullName: string;
  playerCode: string | null;
  inGameName: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
  performancePoints: number;
  form: string;
}

export default function LeaderboardsPage() {
  const [
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    selectedLeague,
    setSelectedLeague,
  ] =
    useState('');

  const [
    mode,
    setMode,
  ] =
    useState('');

  const [
    rankings,
    setRankings,
  ] =
    useState<RankingRow[]>(
      [],
    );

  const [
    userId,
    setUserId,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagues,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              '/leagues/my',
            ),
          ]);

        const list:
          Membership[] =
          leagues.data.leagues;

        setUserId(
          current.id,
        );

        setMemberships(
          list,
        );

        setSelectedLeague(
          list[0]?.league.id ||
            '',
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Leaderboards.',
        );

        setLoading(
          false,
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (
      !selectedLeague
    ) {
      setLoading(
        false,
      );

      return;
    }

    setLoading(
      true,
    );

    const suffix =
      mode
        ? '?mode=' +
          encodeURIComponent(
            mode,
          )
        : '';

    void authenticatedRequest<any>(
      '/leagues/' +
        selectedLeague +
        '/rankings' +
        suffix,
    )
      .then(
        (
          response,
        ) => {
          setRankings(
            response.data
              .rankings,
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
              : 'Unable to load rankings.',
          );

          setRankings(
            [],
          );
        },
      )
      .finally(
        () =>
          setLoading(
            false,
          ),
      );
  }, [
    selectedLeague,
    mode,
  ]);

  const myPosition =
    rankings.find(
      (
        row,
      ) =>
        row.userId ===
        userId,
    )?.position ??
    null;

  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="Leaderboards"
      subtitle="League-wide rankings calculated from verified Tournament statistics."
      action={
        myPosition ? (
          <FcStatusBadge
            label={
              'Your Rank #' +
              myPosition
            }
            tone="cyan"
          />
        ) : null
      }
    >
      {error ? (
        <FcErrorState
          message={
            error
          }
        />
      ) : null}

      <FcPanel className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            <span className="theme-muted">
              League
            </span>

            <select
              value={
                selectedLeague
              }
              onChange={(
                event,
              ) =>
                setSelectedLeague(
                  event.target
                    .value,
                )
              }
              className="theme-input min-h-11 rounded-xl border px-3 outline-none"
            >
              {memberships.map(
                (
                  membership,
                ) => (
                  <option
                    key={
                      membership
                        .league.id
                    }
                    value={
                      membership
                        .league.id
                    }
                  >
                    {
                      membership
                        .league.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            <span className="theme-muted">
              Competition mode
            </span>

            <select
              value={
                mode
              }
              onChange={(
                event,
              ) =>
                setMode(
                  event.target
                    .value,
                )
              }
              className="theme-input min-h-11 rounded-xl border px-3 outline-none"
            >
              <option value="">
                All modes
              </option>

              <option value="SOLO">
                Solo
              </option>

              <option value="DUO">
                Duo
              </option>

              <option value="TEAM">
                Team
              </option>
            </select>
          </label>
        </div>
      </FcPanel>

      {loading ? (
        <FcPanel className="p-8 text-center">
          <p className="theme-secondary-text text-sm">
            Calculating rankings...
          </p>
        </FcPanel>
      ) : rankings.length ===
        0 ? (
        <FcEmptyState
          title="No ranking data yet"
          description="Verified Tournament results will build this leaderboard automatically."
        />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            {rankings
              .slice(
                0,
                3,
              )
              .map(
                (
                  row,
                ) => (
                  <FcPanel
                    key={
                      row.userId
                    }
                    className={
                      'p-5 ' +
                      (
                        row.position ===
                        1
                          ? 'theme-soft-accent'
                          : ''
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="theme-tone-premium grid h-10 w-10 place-items-center rounded-xl border font-bold">
                        #
                        {
                          row.position
                        }
                      </span>

                      <span className="theme-muted text-xs">
                        {
                          row.playerCode ||
                          'FC Player'
                        }
                      </span>
                    </div>

                    <h2 className="theme-text mt-4 text-lg font-semibold">
                      {
                        row.inGameName ||
                        row.fullName
                      }
                    </h2>

                    <p className="theme-secondary-text mt-2 text-xs">
                      {
                        row.performancePoints
                      }{' '}
                      performance pts ·{' '}
                      {
                        row.winRate
                      }
                      % win rate
                    </p>
                  </FcPanel>
                ),
              )}
          </section>

          <FcPanel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="theme-soft-accent text-left">
                  <tr className="theme-muted">
                    <th className="px-4 py-3">
                      Rank
                    </th>
                    <th className="px-4 py-3">
                      Player
                    </th>
                    <th className="px-4 py-3 text-center">
                      MP
                    </th>
                    <th className="px-4 py-3 text-center">
                      W
                    </th>
                    <th className="px-4 py-3 text-center">
                      D
                    </th>
                    <th className="px-4 py-3 text-center">
                      L
                    </th>
                    <th className="px-4 py-3 text-center">
                      GF
                    </th>
                    <th className="px-4 py-3 text-center">
                      GD
                    </th>
                    <th className="px-4 py-3 text-center">
                      Win %
                    </th>
                    <th className="px-4 py-3 text-center">
                      Rating Pts
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rankings.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.userId
                        }
                        className={
                          'border-t theme-divider ' +
                          (
                            row.userId ===
                            userId
                              ? 'theme-soft-accent'
                              : ''
                          )
                        }
                      >
                        <td className="theme-text px-4 py-3 font-bold">
                          #
                          {
                            row.position
                          }
                        </td>

                        <td className="px-4 py-3">
                          <p className="theme-text font-semibold">
                            {
                              row.inGameName ||
                              row.fullName
                            }
                          </p>

                          <p className="theme-muted mt-0.5 text-xs">
                            {
                              row.playerCode ||
                              row.fullName
                            }
                          </p>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.matches
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.wins
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.draws
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.losses
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.goalsFor
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.goalDifference >
                          0
                            ? '+' +
                              row.goalDifference
                            : row.goalDifference}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {
                            row.winRate
                          }
                          %
                        </td>

                        <td className="theme-text-link px-4 py-3 text-center font-bold">
                          {
                            row.performancePoints
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </FcPanel>
        </>
      )}
    </SecondaryFeaturePage>
  );
}
