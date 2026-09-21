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
  FcStatCard,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awardedAt: string;

  tournament: {
    id: string;
    name: string;
  };
}

export default function AwardsPage() {
  const [
    awards,
    setAwards,
  ] =
    useState<Achievement[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    void authenticatedRequest<any>(
      '/players/me/career',
    )
      .then(
        (
          response,
        ) => {
          setAwards(
            response.data
              .achievements,
          );
        },
      )
      .catch(
        () =>
          setAwards(
            [],
          ),
      )
      .finally(
        () =>
          setLoading(
            false,
          ),
      );
  }, []);

  const champions =
    useMemo(
      () =>
        awards.filter(
          (
            award,
          ) =>
            award.type ===
            'TOURNAMENT_CHAMPION',
        ).length,
      [
        awards,
      ],
    );

  const individual =
    useMemo(
      () =>
        awards.filter(
          (
            award,
          ) =>
            [
              'GOLDEN_BOOT',
              'BEST_PLAYER',
            ].includes(
              award.type,
            ),
        ).length,
      [
        awards,
      ],
    );

  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="Awards"
      subtitle="Verified FC ARENA honours generated from completed Tournament results."
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <FcStatCard
          label="Total Awards"
          value={
            awards.length
          }
          detail="Verified honours"
          tone="amber"
        />

        <FcStatCard
          label="Championships"
          value={
            champions
          }
          detail="Tournament titles"
          tone="emerald"
        />

        <div className="col-span-2 lg:col-span-1">
          <FcStatCard
            label="Individual Awards"
            value={
              individual
            }
            detail="Golden Boot / Best Player"
            tone="cyan"
          />
        </div>
      </section>

      {loading ? (
        <FcPanel className="p-8 text-center">
          <p className="theme-secondary-text text-sm">
            Loading honours...
          </p>
        </FcPanel>
      ) : awards.length ===
        0 ? (
        <FcEmptyState
          title="No awards yet"
          description="Finish verified Tournaments and earn FC ARENA achievements to build your trophy cabinet."
          actionLabel="Open Tournaments"
          actionHref="/tournaments"
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {awards.map(
            (
              award,
            ) => (
              <Link
                key={
                  award.id
                }
                href={
                  '/tournaments/' +
                  award.tournament
                    .id +
                  '/achievements'
                }
                className="group"
              >
                <FcPanel className="theme-action-row h-full p-5 transition group-hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="theme-tone-premium grid h-12 w-12 place-items-center rounded-xl border text-xl">
                      🏆
                    </span>

                    <span className="theme-muted text-xs">
                      {new Date(
                        award.awardedAt,
                      ).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="theme-text-link mt-4 text-[10px] font-semibold uppercase tracking-[0.15em]">
                    {award.type.replaceAll(
                      '_',
                      ' ',
                    )}
                  </p>

                  <h2 className="theme-text mt-2 text-lg font-semibold">
                    {
                      award.title
                    }
                  </h2>

                  <p className="theme-secondary-text mt-1 text-sm font-medium">
                    {
                      award.tournament
                        .name
                    }
                  </p>

                  {award.description ? (
                    <p className="theme-muted mt-3 text-sm leading-6">
                      {
                        award.description
                      }
                    </p>
                  ) : null}

                  <span className="theme-text-link mt-4 inline-flex text-sm font-semibold">
                    View Tournament →
                  </span>
                </FcPanel>
              </Link>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
