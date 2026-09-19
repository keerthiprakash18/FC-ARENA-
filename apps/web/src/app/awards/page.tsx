'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  FcEmptyState,
  FcPanel,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

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

  useEffect(() => {
    void authenticatedRequest<any>(
      '/players/me/career',
    )
      .then(
        (
          response,
        ) => {
          setAwards(
            response
              .data
              .achievements,
          );
        },
      )
      .catch(
        () =>
          setAwards(
            [],
          ),
      );
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="Awards"
      subtitle="Your real FC ARENA Tournament honours and milestones."
    >
      {awards.length === 0 ? (
        <FcEmptyState
          title="No awards yet"
          description="Awards are generated from completed Tournament achievements."
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
                  `/tournaments/${award.tournament.id}/achievements`
                }
                className="group"
              >
                <FcPanel className="h-full border-amber-400/15 p-5 transition group-hover:border-amber-400/30">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                    {
                      award.type.replaceAll(
                        '_',
                        ' ',
                      )
                    }
                  </p>

                  <h2 className="mt-3 text-lg font-black">
                    {
                      award.title
                    }
                  </h2>

                  <p className="mt-2 text-sm font-black text-sky-300">
                    {
                      award.tournament.name
                    }
                  </p>

                  {award.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {
                        award.description
                      }
                    </p>
                  ) : null}

                  <p className="mt-4 text-xs text-slate-600">
                    {new Date(
                      award.awardedAt,
                    ).toLocaleDateString()}
                  </p>
                </FcPanel>
              </Link>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
