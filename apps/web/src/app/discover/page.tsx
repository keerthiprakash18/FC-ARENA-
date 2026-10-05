'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

type DiscoverType =
  | 'all'
  | 'players'
  | 'leagues'
  | 'tournaments'
  | 'seasons';

interface PlayerResult {
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string;
  profileImageUrl: string | null;
  honours: number;
}

interface LeagueResult {
  id: string;
  name: string;
  logoUrl: string | null;
  region: string | null;
  description: string | null;
  members: number;
  tournaments: number;
  joined: boolean;
}

interface TournamentResult {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  mode: string;
  format: string;
  status: string;
  visibility: string;
  startAt: string | null;
  endAt: string | null;
  approvedEntries: number;
  leagueJoined: boolean;

  league: {
    id: string;
    name: string;
    logoUrl: string | null;
    region: string | null;
  };
}

interface SeasonResult {
  id: string;
  name: string;
  status: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  finalWinnerUserId: string | null;
}

interface SearchData {
  query: string;
  type: DiscoverType;
  minimumQueryLength: number;
  total: number;
  players: PlayerResult[];
  leagues: LeagueResult[];
  tournaments: TournamentResult[];
  seasons: SeasonResult[];
}

interface FeaturedData {
  tournaments: TournamentResult[];
  leagues: LeagueResult[];
  seasons: SeasonResult[];

  recentHonours: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    awardedAt: string;

    season: {
      id: string;
      name: string;
      status: string;
    };

    player: {
      userId: string;
      fullName: string;
      inGameName: string | null;
      playerCode: string;
      profileImageUrl: string | null;
    };
  }>;
}

const filters: Array<{
  type: DiscoverType;
  label: string;
}> = [
  {
    type: 'all',
    label: 'All',
  },
  {
    type: 'players',
    label: 'Players',
  },
  {
    type: 'leagues',
    label: 'Leagues',
  },
  {
    type: 'tournaments',
    label: 'Tournaments',
  },
  {
    type: 'seasons',
    label: 'Seasons',
  },
];

function displayName(
  player: {
    fullName: string;
    inGameName: string | null;
  },
) {
  return (
    player.inGameName ||
    player.fullName
  );
}

function tournamentHref(
  tournament:
    TournamentResult,
) {
  if (
    tournament
      .leagueJoined
  ) {
    return `/tournaments/${tournament.id}`;
  }

  if (
    tournament.visibility ===
    'PUBLIC'
  ) {
    return `/public/tournaments/${tournament.code}`;
  }

  return null;
}

function PlayerAvatar({
  player,
  size = 'h-11 w-11',
}: {
  player: {
    fullName: string;
    inGameName: string | null;
    profileImageUrl: string | null;
  };
  size?: string;
}) {
  const name =
    displayName(
      player,
    );

  return (
    <span
      className={`theme-avatar grid shrink-0 place-items-center overflow-hidden rounded-xl border text-xs font-black ${size}`}
    >
      {player.profileImageUrl ? (
        <img
          src={
            player.profileImageUrl
          }
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        name
          .slice(
            0,
            2,
          )
          .toUpperCase()
      )}
    </span>
  );
}

function LeagueLogo({
  league,
}: {
  league:
    LeagueResult;
}) {
  return (
    <span className="theme-avatar grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border text-xs font-black">
      {league.logoUrl ? (
        <img
          src={
            league.logoUrl
          }
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        league.name
          .slice(
            0,
            2,
          )
          .toUpperCase()
      )}
    </span>
  );
}

export default function DiscoverPage() {
  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    type,
    setType,
  ] =
    useState<DiscoverType>(
      'all',
    );

  const [
    results,
    setResults,
  ] =
    useState<SearchData | null>(
      null,
    );

  const [
    featured,
    setFeatured,
  ] =
    useState<FeaturedData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    const initial =
      new URLSearchParams(
        window.location.search,
      )
        .get('q')
        ?.trim() ??
      '';

    if (
      initial
    ) {
      setQuery(
        initial,
      );
    }

    void authenticatedRequest<{
      success: true;
      data: FeaturedData;
      error: null;
    }>('/discover/featured')
      .then(
        (
          response,
        ) => {
          setFeatured(
            response.data,
          );
        },
      )
      .catch(
        (
          err,
        ) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Discover.',
          );
        },
      );
  }, []);

  useEffect(() => {
    const value =
      query.trim();

    if (
      value.length <
      2
    ) {
      setResults(
        null,
      );
      setLoading(
        false,
      );
      return;
    }

    setLoading(
      true,
    );

    const timer =
      window.setTimeout(
        () => {
          const params =
            new URLSearchParams({
              q:
                value,
              type,
              limit:
                '10',
            });

          void authenticatedRequest<{
            success: true;
            data: SearchData;
            error: null;
          }>(
            `/discover?${params.toString()}`,
          )
            .then(
              (
                response,
              ) => {
                setResults(
                  response.data,
                );
                setError(
                  '',
                );
              },
            )
            .catch(
              (
                err,
              ) => {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Search is unavailable.',
                );
              },
            )
            .finally(
              () => {
                setLoading(
                  false,
                );
              },
            );
        },
        280,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    query,
    type,
  ]);

  const searching =
    query.trim().length >=
    2;

  const sections =
    useMemo(
      () => ({
        players:
          results
            ?.players ??
          [],
        leagues:
          results
            ?.leagues ??
          [],
        tournaments:
          results
            ?.tournaments ??
          [],
        seasons:
          results
            ?.seasons ??
          [],
      }),
      [
        results,
      ],
    );

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena"
      title="Discover"
      subtitle="Search the FC Arena ecosystem — players, leagues, tournaments and Ballon seasons."
      backHref="/dashboard"
      backLabel="Home"
      action={
        <Link
          href="/awards/hall-of-fame"
          className="theme-secondary-button inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-black"
        >
          Hall of Fame →
        </Link>
      }
    >
      <FcPanel className="p-4 sm:p-5">
        <label className="theme-search flex min-h-12 items-center gap-3 rounded-xl border px-4">
          <span
            className="theme-muted text-lg"
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            value={
              query
            }
            onChange={(
              event,
            ) =>
              setQuery(
                event
                  .target
                  .value,
              )
            }
            autoComplete="off"
            placeholder="Search player name, player code, league, tournament or season..."
            className="theme-search-input min-w-0 flex-1 bg-transparent text-sm outline-none"
            aria-label="Search FC Arena"
          />

          {query ? (
            <button
              type="button"
              onClick={() =>
                setQuery(
                  '',
                )
              }
              className="theme-muted rounded-lg px-2 py-1 text-xs font-black"
            >
              Clear
            </button>
          ) : null}
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filters.map(
            (
              filter,
            ) => (
              <button
                key={
                  filter.type
                }
                type="button"
                aria-pressed={
                  type ===
                  filter.type
                }
                onClick={() =>
                  setType(
                    filter.type,
                  )
                }
                className={
                  type ===
                  filter.type
                    ? 'theme-primary-button min-h-9 shrink-0 rounded-lg px-4 text-xs font-black'
                    : 'theme-secondary-button min-h-9 shrink-0 rounded-lg border px-4 text-xs font-semibold'
                }
              >
                {
                  filter.label
                }
              </button>
            ),
          )}
        </div>

        <p className="theme-muted mt-3 text-xs">
          Search uses public competition identity only. Email, phone number and game UID are never shown here.
        </p>
      </FcPanel>

      {error ? (
        <FcPanel className="border-red-400/20 p-4 text-sm text-red-300">
          {
            error
          }
        </FcPanel>
      ) : null}

      {searching ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Global Search
              </p>

              <h2 className="mt-1 text-xl font-black">
                {loading
                  ? 'Searching...'
                  : `${results?.total ?? 0} result${results?.total === 1 ? '' : 's'}`}
              </h2>
            </div>

            {results ? (
              <FcStatusBadge
                label={
                  type ===
                  'all'
                    ? 'ALL'
                    : type
                }
                tone="cyan"
              />
            ) : null}
          </div>

          {(
            type ===
              'all' ||
            type ===
              'players'
          ) &&
          sections.players.length >
            0 ? (
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Players
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {sections.players.map(
                  (
                    player,
                  ) => (
                    <Link
                      key={
                        player.userId
                      }
                      href={
                        `/discover/players/${player.userId}`
                      }
                      className="group"
                    >
                      <FcPanel className="flex h-full items-center gap-3 p-4 transition group-hover:border-sky-400/25">
                        <PlayerAvatar
                          player={
                            player
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black">
                            {
                              displayName(
                                player,
                              )
                            }
                          </p>

                          <p className="mt-1 font-mono text-[10px] text-sky-400">
                            {
                              player.playerCode
                            }
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black">
                            {
                              player.honours
                            }
                          </p>

                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                            Honours
                          </p>
                        </div>
                      </FcPanel>
                    </Link>
                  ),
                )}
              </div>
            </section>
          ) : null}

          {(
            type ===
              'all' ||
            type ===
              'leagues'
          ) &&
          sections.leagues.length >
            0 ? (
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Leagues
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {sections.leagues.map(
                  (
                    league,
                  ) => {
                    const content = (
                      <FcPanel className="flex h-full items-center gap-3 p-4">
                        <LeagueLogo
                          league={
                            league
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-black">
                              {
                                league.name
                              }
                            </p>

                            {league.joined ? (
                              <FcStatusBadge
                                label="Joined"
                                tone="emerald"
                              />
                            ) : null}
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {
                              league.region ||
                              'FC Arena League'
                            }{' '}
                            ·{' '}
                            {
                              league.members
                            }{' '}
                            members ·{' '}
                            {
                              league.tournaments
                            }{' '}
                            tournaments
                          </p>
                        </div>
                      </FcPanel>
                    );

                    return league.joined ? (
                      <Link
                        key={
                          league.id
                        }
                        href={
                          `/leagues/${league.id}`
                        }
                        className="group"
                      >
                        {
                          content
                        }
                      </Link>
                    ) : (
                      <div
                        key={
                          league.id
                        }
                      >
                        {
                          content
                        }
                      </div>
                    );
                  },
                )}
              </div>

              <p className="mt-2 text-xs text-slate-600">
                Non-member leagues are discoverable by name, but joining still requires the League invite code.
              </p>
            </section>
          ) : null}

          {(
            type ===
              'all' ||
            type ===
              'tournaments'
          ) &&
          sections
            .tournaments
            .length >
            0 ? (
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Tournaments
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {sections.tournaments.map(
                  (
                    tournament,
                  ) => {
                    const href =
                      tournamentHref(
                        tournament,
                      );

                    const card = (
                      <FcPanel className="h-full p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate font-black">
                              {
                                tournament.name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {
                                tournament
                                  .league
                                  .name
                              }{' '}
                              ·{' '}
                              {
                                tournament.mode
                              }{' '}
                              ·{' '}
                              {
                                tournament.approvedEntries
                              }{' '}
                              entries
                            </p>
                          </div>

                          <FcStatusBadge
                            label={
                              tournament.status
                            }
                            tone={
                              tournament.status ===
                              'ACTIVE'
                                ? 'emerald'
                                : 'cyan'
                            }
                          />
                        </div>
                      </FcPanel>
                    );

                    return href ? (
                      <Link
                        key={
                          tournament.id
                        }
                        href={
                          href
                        }
                        className="group"
                      >
                        {
                          card
                        }
                      </Link>
                    ) : (
                      <div
                        key={
                          tournament.id
                        }
                      >
                        {
                          card
                        }
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          ) : null}

          {(
            type ===
              'all' ||
            type ===
              'seasons'
          ) &&
          sections.seasons.length >
            0 ? (
            <section>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Ballon Seasons
              </h3>

              <div className="grid gap-3 md:grid-cols-2">
                {sections.seasons.map(
                  (
                    season,
                  ) => (
                    <Link
                      key={
                        season.id
                      }
                      href={
                        `/awards/ballon/${season.id}`
                      }
                    >
                      <FcPanel className="h-full p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">
                              {
                                season.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(
                                season.startAt,
                              ).toLocaleDateString()}{' '}
                              →{' '}
                              {new Date(
                                season.endAt,
                              ).toLocaleDateString()}
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
                                : 'cyan'
                            }
                          />
                        </div>
                      </FcPanel>
                    </Link>
                  ),
                )}
              </div>
            </section>
          ) : null}

          {!loading &&
          results &&
          results.total ===
            0 ? (
            <FcEmptyState
              title="No matching FC Arena records"
              description="Try an in-game name, Player Code, League name, Tournament name or Ballon season."
            />
          ) : null}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Happening Now
              </p>

              <h2 className="mt-1 text-xl font-black">
                Active Competitions
              </h2>

              <div className="mt-5 space-y-2">
                {featured
                  ?.tournaments
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    (
                      tournament,
                    ) => {
                      const href =
                        tournamentHref(
                          tournament,
                        );

                      const content = (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {
                                tournament.name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {
                                tournament
                                  .league
                                  .name
                              }{' '}
                              ·{' '}
                              {
                                tournament.approvedEntries
                              }{' '}
                              entries
                            </p>
                          </div>

                          <FcStatusBadge
                            label={
                              tournament.status
                            }
                            tone={
                              tournament.status ===
                              'ACTIVE'
                                ? 'emerald'
                                : 'cyan'
                            }
                          />
                        </div>
                      );

                      return href ? (
                        <Link
                          key={
                            tournament.id
                          }
                          href={
                            href
                          }
                        >
                          {
                            content
                          }
                        </Link>
                      ) : (
                        <div
                          key={
                            tournament.id
                          }
                        >
                          {
                            content
                          }
                        </div>
                      );
                    },
                  )}

                {featured &&
                featured
                  .tournaments
                  .length ===
                  0 ? (
                  <p className="text-sm text-slate-500">
                    No active competitions are visible right now.
                  </p>
                ) : null}
              </div>
            </FcPanel>

            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Legacy
              </p>

              <h2 className="mt-1 text-xl font-black">
                Hall of Fame
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Explore Ballon winners, season podiums, tournament champions and major award history.
              </p>

              <Link
                href="/awards/hall-of-fame"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-5 text-sm font-black text-[#151006]"
              >
                Enter Hall of Fame →
              </Link>

              <Link
                href="/awards/ballon"
                className="theme-secondary-button ml-2 mt-5 inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-black"
              >
                Seasons
              </Link>
            </FcPanel>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">
                FC Arena Leagues
              </h2>

              <span className="text-xs text-slate-600">
                Discoverable · invite-only joining
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {featured
                ?.leagues
                .map(
                  (
                    league,
                  ) => (
                    <div
                      key={
                        league.id
                      }
                    >
                      <FcPanel className="h-full p-4">
                        <div className="flex items-center gap-3">
                          <LeagueLogo
                            league={
                              league
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black">
                              {
                                league.name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {
                                league.region ||
                                'FC Arena League'
                              }
                            </p>
                          </div>

                          {league.joined ? (
                            <Link
                              href={
                                `/leagues/${league.id}`
                              }
                              className="text-xs font-black text-sky-400"
                            >
                              Open →
                            </Link>
                          ) : null}
                        </div>

                        <div className="mt-4 flex gap-4 text-xs text-slate-500">
                          <span>
                            <b className="text-slate-200">
                              {
                                league.members
                              }
                            </b>{' '}
                            members
                          </span>

                          <span>
                            <b className="text-slate-200">
                              {
                                league.tournaments
                              }
                            </b>{' '}
                            tournaments
                          </span>
                        </div>
                      </FcPanel>
                    </div>
                  ),
                )}
            </div>
          </section>

          {featured
            ?.recentHonours
            .length ? (
            <section>
              <h2 className="mb-3 text-xl font-black">
                Recent Honours
              </h2>

              <div className="grid gap-3 md:grid-cols-2">
                {featured
                  .recentHonours
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (
                      honour,
                    ) => (
                      <Link
                        key={
                          honour.id
                        }
                        href={
                          `/discover/players/${honour.player.userId}`
                        }
                      >
                        <FcPanel className="flex items-center gap-3 p-4">
                          <PlayerAvatar
                            player={
                              honour.player
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black">
                              {
                                displayName(
                                  honour.player,
                                )
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-amber-300">
                              {
                                honour.title
                              }{' '}
                              ·{' '}
                              {
                                honour
                                  .season
                                  .name
                              }
                            </p>
                          </div>
                        </FcPanel>
                      </Link>
                    ),
                  )}
              </div>
            </section>
          ) : null}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
