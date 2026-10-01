'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  FcEmptyState,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface Placement {
  id: string;
  key: string;
  headline: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  rewardText: string | null;
  termsUrl: string | null;
  disclosureLabel: string;

  sponsor: {
    id: string;
    name: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    disclosureLabel: string;
  };
}

export default function PartnersPage() {
  const [
    placements,
    setPlacements,
  ] =
    useState<Placement[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void authenticatedRequest<{
      success: true;

      data: {
        placements:
          Placement[];
      };

      error: null;
    }>(
      '/commercial/placements',
    )
      .then(
        (
          response,
        ) =>
          setPlacements(
            response.data
              .placements,
          ),
      )
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load FC Arena partners.',
          ),
      )
      .finally(
        () =>
          setLoading(
            false,
          ),
      );
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena Partners"
      title="Sponsors & Rewards"
      subtitle="Active FC Arena commercial partnerships, reward campaigns and clearly disclosed sponsored placements."
      backHref="/more"
      backLabel="More"
    >
      <FcPanel className="p-5 text-sm leading-6 text-slate-500">
        Sponsored content is always labeled. A sponsor does not control competition results, rankings, awards or FC Arena moderation decisions.
      </FcPanel>

      {error ? (
        <FcEmptyState
          title="Partners unavailable"
          description={
            error
          }
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {placements.map(
          (
            placement,
          ) => (
            <FcPanel
              key={
                placement.id
              }
              className="h-full border-amber-400/15 p-5"
            >
              <div className="flex items-start gap-4">
                <span className="theme-avatar grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border text-xs font-black">
                  {placement
                    .sponsor
                    .logoUrl ? (
                    <img
                      src={
                        placement
                          .sponsor
                          .logoUrl
                      }
                      alt=""
                      className="h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    placement
                      .sponsor
                      .name
                      .slice(
                        0,
                        2,
                      )
                      .toUpperCase()
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
                    {
                      placement
                        .disclosureLabel
                    }
                  </span>

                  <p className="mt-3 text-lg font-black">
                    {
                      placement.headline
                    }
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {
                      placement
                        .sponsor
                        .name
                    }{' '}
                    ·{' '}
                    {
                      placement.key
                    }
                  </p>
                </div>
              </div>

              {placement.body ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {
                    placement.body
                  }
                </p>
              ) : null}

              {placement.rewardText ? (
                <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-300/[0.04] p-3 text-sm font-black text-amber-300">
                  🎁 {
                    placement.rewardText
                  }
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {placement.ctaUrl &&
                placement.ctaLabel ? (
                  <a
                    href={
                      placement.ctaUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex min-h-10 items-center rounded-xl bg-amber-300 px-4 text-xs font-black text-[#151006]"
                  >
                    {
                      placement.ctaLabel
                    }
                  </a>
                ) : null}

                {placement.termsUrl ? (
                  <a
                    href={
                      placement.termsUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="theme-secondary-button inline-flex min-h-10 items-center rounded-xl border px-4 text-xs font-black"
                  >
                    Reward Terms
                  </a>
                ) : null}
              </div>
            </FcPanel>
          ),
        )}
      </div>

      {!loading &&
      placements.length ===
        0 &&
      !error ? (
        <FcEmptyState
          title="No active sponsor campaigns"
          description="FC Arena currently has no active sponsored placement to display."
        />
      ) : null}

      {loading ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading partners...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
