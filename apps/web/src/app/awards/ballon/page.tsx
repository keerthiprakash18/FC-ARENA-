'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

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

interface SeasonWinner {
  userId: string;
  fullName: string;
  inGameName: string | null;
  playerCode: string | null;
  profileImageUrl: string | null;
}

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minimumMatches: number;
  rankingLimit: number;
  status: string;
  finalWinnerUserId: string | null;
  risingStarUserId: string | null;
  winner: SeasonWinner | null;
  risingStar: SeasonWinner | null;
}

function nameFor(
  player:
    | SeasonWinner
    | null,
) {
  if (!player) {
    return 'To be decided';
  }

  return (
    player.inGameName ||
    player.fullName
  );
}

export default function BallonSeasonsPage() {
  const [
    seasons,
    setSeasons,
  ] =
    useState<Season[]>(
      [],
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    filter,
    setFilter,
  ] =
    useState<
      'ALL' |
      'LIVE' |
      'PAST'
    >(
      'ALL',
    );

  const visibleSeasons =
    useMemo(
      () =>
        seasons.filter(
          (
            season,
          ) =>
            filter ===
            'ALL'
              ? true
              : filter ===
                  'LIVE'
                ? season.status ===
                    'LIVE' ||
                  season.status ===
                    'FINALIZING'
                : season.status ===
                    'LOCKED' ||
                  season.status ===
                    'ARCHIVED',
        ),
      [
        seasons,
        filter,
      ],
    );

  const liveCount =
    seasons.filter(
      (
        season,
      ) =>
        season.status ===
          'LIVE' ||
        season.status ===
          'FINALIZING',
    ).length;

  const pastCount =
    seasons.filter(
      (
        season,
      ) =>
        season.status ===
          'LOCKED' ||
        season.status ===
          'ARCHIVED',
    ).length;

  useEffect(() => {
    void authenticatedRequest<any>(
      '/ballon/seasons',
    )
      .then(
        (
          response,
        ) =>
          setSeasons(
            response
              .data
              .seasons ??
              [],
          ),
      )
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Ballon seasons.',
          ),
      );
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Hall of Honours"
      title="FC Arena Ballon Seasons"
      subtitle="Live, locked and archived seasonal player honours."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/awards"
            className="text-sm font-black text-slate-500 transition hover:text-amber-300"
          >
            ← Awards
          </Link>

          <Link
            href="/awards/hall-of-fame"
            className="text-sm font-black text-amber-300 transition hover:text-amber-200"
          >
            Hall of Fame →
          </Link>
        </div>

        <Image
          src="/awards/fc-arena-ballon-mark.svg"
          alt="FC Arena Ballon"
          width={52}
          height={52}
          className="h-12 w-12"
        />
      </div>

      <FcPanel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ['ALL', `All ${seasons.length}`],
              ['LIVE', `Live ${liveCount}`],
              ['PAST', `Past ${pastCount}`],
            ].map(
              (
                item,
              ) => (
                <button
                  key={
                    item[0]
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      item[0] as
                        | 'ALL'
                        | 'LIVE'
                        | 'PAST',
                    )
                  }
                  className={
                    filter ===
                    item[0]
                      ? 'theme-primary-button min-h-9 rounded-lg px-4 text-xs font-black'
                      : 'theme-secondary-button min-h-9 rounded-lg border px-4 text-xs font-semibold'
                  }
                >
                  {
                    item[1]
                  }
                </button>
              ),
            )}
          </div>

          <span className="text-xs text-slate-600">
            Locked seasons preserve immutable final rankings.
          </span>
        </div>
      </FcPanel>

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleSeasons.map(
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
              className="group"
            >
              <FcPanel className="h-full p-5 transition group-hover:border-amber-400/25">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                      Seasonal Player Honour
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {
                        season.name
                      }
                    </h2>
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

                <p className="mt-3 text-xs text-slate-500">
                  {new Date(
                    season.startAt,
                  ).toLocaleDateString()}{' '}
                  →{' '}
                  {new Date(
                    season.endAt,
                  ).toLocaleDateString()}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Ballon Winner
                    </p>

                    <p className="mt-2 truncate text-sm font-black">
                      👑{' '}
                      {nameFor(
                        season.winner,
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Rising Star
                    </p>

                    <p className="mt-2 truncate text-sm font-black">
                      🚀{' '}
                      {nameFor(
                        season.risingStar,
                      )}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-600">
                  Minimum{' '}
                  {
                    season.minimumMatches
                  }{' '}
                  matches · Top{' '}
                  {
                    season.rankingLimit
                  }
                </p>
              </FcPanel>
            </Link>
          ),
        )}

        {visibleSeasons.length ===
        0 ? (
          <FcPanel className="p-10 text-center text-sm text-slate-500">
            {seasons.length === 0
              ? 'No FC Arena Ballon seasons have been created yet.'
              : 'No seasons match this archive filter.'}
          </FcPanel>
        ) : null}
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
