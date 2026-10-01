'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

export type SponsorPlacementKey =
  | 'DASHBOARD'
  | 'AWARDS'
  | 'LEAGUE_WAR'
  | 'DISCOVER';

interface Placement {
  id: string;
  key: SponsorPlacementKey;
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

export function SponsoredPlacement({
  placementKey,
}: {
  placementKey:
    SponsorPlacementKey;
}) {
  const [
    placement,
    setPlacement,
  ] =
    useState<Placement | null>(
      null,
    );

  useEffect(() => {
    let active =
      true;

    const params =
      new URLSearchParams({
        key:
          placementKey,
      });

    void authenticatedRequest<{
      success: true;

      data: {
        placements:
          Placement[];
      };

      error: null;
    }>(
      '/commercial/placements?' +
        params.toString(),
    )
      .then(
        (
          response,
        ) => {
          if (
            active
          ) {
            setPlacement(
              response.data
                .placements[0] ??
              null,
            );
          }
        },
      )
      .catch(
        () => {
          if (
            active
          ) {
            setPlacement(
              null,
            );
          }
        },
      );

    return () => {
      active =
        false;
    };
  }, [
    placementKey,
  ]);

  if (
    !placement
  ) {
    return null;
  }

  return (
    <FcPanel className="overflow-hidden border-amber-400/15 p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
              {
                placement
                  .disclosureLabel
              }
            </span>

            <span className="truncate text-xs font-semibold text-slate-500">
              {
                placement
                  .sponsor
                  .name
              }
            </span>
          </div>

          <p className="mt-2 text-base font-black">
            {
              placement.headline
            }
          </p>

          {placement.body ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {
                placement.body
              }
            </p>
          ) : null}

          {placement.rewardText ? (
            <p className="mt-2 text-xs font-black text-amber-300">
              🎁 {
                placement.rewardText
              }
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
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
              Terms
            </a>
          ) : null}
        </div>
      </div>
    </FcPanel>
  );
}
