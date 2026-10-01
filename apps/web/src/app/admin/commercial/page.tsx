'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AdminNavigation,
} from '@/components/admin/admin-navigation';

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

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  disclosureLabel: string;
  status:
    | 'DRAFT'
    | 'ACTIVE'
    | 'PAUSED'
    | 'ARCHIVED';
  placements: number;
}

interface Placement {
  id: string;
  sponsorId: string;
  key:
    | 'DASHBOARD'
    | 'AWARDS'
    | 'LEAGUE_WAR'
    | 'DISCOVER';
  headline: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  rewardText: string | null;
  termsUrl: string | null;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  currentlyVisible: boolean;

  sponsor: {
    id: string;
    name: string;
    logoUrl: string | null;
    status: string;
    disclosureLabel: string;
  };
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  audience:
    | 'USER'
    | 'LEAGUE';
  interval:
    | 'MONTHLY'
    | 'YEARLY';
  priceMinor: number;
  currency: string;
  features: unknown;
  isActive: boolean;
  subscriptions: number;
}

interface Subscription {
  id: string;
  audience:
    | 'USER'
    | 'LEAGUE';
  provider: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  active: boolean;

  plan: {
    id: string;
    code: string;
    name: string;
    audience: string;
  };

  owner: {
    type: string;
    id: string | null;
    name: string;
    playerCode: string | null;
  };
}

interface AdminCommercialData {
  sponsors:
    Sponsor[];
  placements:
    Placement[];
  plans:
    Plan[];
  subscriptions:
    Subscription[];

  totals: {
    sponsors: number;
    activeSponsors: number;
    placements: number;
    visiblePlacements: number;
    plans: number;
    activePlans: number;
    activeSubscriptions: number;
  };

  billing: {
    checkoutAvailable: boolean;
    provider: string | null;
    mode: string;
  };
}

export default function AdminCommercialPage() {
  const [
    data,
    setData,
  ] =
    useState<AdminCommercialData | null>(
      null,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    sponsorName,
    setSponsorName,
  ] =
    useState('');

  const [
    sponsorLogo,
    setSponsorLogo,
  ] =
    useState('');

  const [
    sponsorWebsite,
    setSponsorWebsite,
  ] =
    useState('');

  const [
    sponsorDescription,
    setSponsorDescription,
  ] =
    useState('');

  const [
    placementSponsorId,
    setPlacementSponsorId,
  ] =
    useState('');

  const [
    placementKey,
    setPlacementKey,
  ] =
    useState<
      Placement[
        'key'
      ]
    >(
      'DASHBOARD',
    );

  const [
    placementHeadline,
    setPlacementHeadline,
  ] =
    useState('');

  const [
    placementBody,
    setPlacementBody,
  ] =
    useState('');

  const [
    placementReward,
    setPlacementReward,
  ] =
    useState('');

  const [
    placementCtaLabel,
    setPlacementCtaLabel,
  ] =
    useState('');

  const [
    placementCtaUrl,
    setPlacementCtaUrl,
  ] =
    useState('');

  const [
    placementTermsUrl,
    setPlacementTermsUrl,
  ] =
    useState('');

  const [
    planCode,
    setPlanCode,
  ] =
    useState('');

  const [
    planName,
    setPlanName,
  ] =
    useState('');

  const [
    planDescription,
    setPlanDescription,
  ] =
    useState('');

  const [
    planAudience,
    setPlanAudience,
  ] =
    useState<
      Plan[
        'audience'
      ]
    >(
      'USER',
    );

  const [
    planInterval,
    setPlanInterval,
  ] =
    useState<
      Plan[
        'interval'
      ]
    >(
      'MONTHLY',
    );

  const [
    planPrice,
    setPlanPrice,
  ] =
    useState('');

  const [
    planCurrency,
    setPlanCurrency,
  ] =
    useState(
      'INR',
    );

  const [
    planFeatures,
    setPlanFeatures,
  ] =
    useState('');

  const [
    grantPlanId,
    setGrantPlanId,
  ] =
    useState('');

  const [
    grantAudience,
    setGrantAudience,
  ] =
    useState<
      Plan[
        'audience'
      ]
    >(
      'USER',
    );

  const [
    grantTargetId,
    setGrantTargetId,
  ] =
    useState('');

  const [
    grantDays,
    setGrantDays,
  ] =
    useState('');

  const [
    grantNote,
    setGrantNote,
  ] =
    useState('');

  async function load() {
    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: AdminCommercialData;
          error: null;
        }>(
          '/admin/commercial',
        );

      setData(
        response.data,
      );

      setError(
        '',
      );

      if (
        !placementSponsorId &&
        response.data
          .sponsors[0]
      ) {
        setPlacementSponsorId(
          response.data
            .sponsors[0]
            .id,
        );
      }

      if (
        !grantPlanId &&
        response.data
          .plans[0]
      ) {
        setGrantPlanId(
          response.data
            .plans[0]
            .id,
        );

        setGrantAudience(
          response.data
            .plans[0]
            .audience,
        );
      }
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Commercial admin.',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedGrantPlan =
    useMemo(
      () =>
        data?.plans.find(
          (
            plan,
          ) =>
            plan.id ===
            grantPlanId,
        ) ??
        null,
      [
        data,
        grantPlanId,
      ],
    );

  useEffect(() => {
    if (
      selectedGrantPlan
    ) {
      setGrantAudience(
        selectedGrantPlan
          .audience,
      );
    }
  }, [
    selectedGrantPlan,
  ]);

  async function action(
    operation:
      () =>
        Promise<unknown>,
    successMessage:
      string,
  ) {
    if (
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );
    setError(
      '',
    );
    setMessage(
      '',
    );

    try {
      await operation();

      setMessage(
        successMessage,
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Commercial admin action failed.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  function createSponsor(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void action(
      async () => {
        await authenticatedRequest(
          '/admin/commercial/sponsors',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                name:
                  sponsorName
                    .trim(),

                ...(
                  sponsorLogo
                    .trim()
                    ? {
                        logoUrl:
                          sponsorLogo
                            .trim(),
                      }
                    : {}
                ),

                ...(
                  sponsorWebsite
                    .trim()
                    ? {
                        websiteUrl:
                          sponsorWebsite
                            .trim(),
                      }
                    : {}
                ),

                ...(
                  sponsorDescription
                    .trim()
                    ? {
                        description:
                          sponsorDescription
                            .trim(),
                      }
                    : {}
                ),

                disclosureLabel:
                  'Sponsored',

                status:
                  'DRAFT',
              }),
          },
        );

        setSponsorName(
          '',
        );
        setSponsorLogo(
          '',
        );
        setSponsorWebsite(
          '',
        );
        setSponsorDescription(
          '',
        );
      },
      'Sponsor created as DRAFT.',
    );
  }

  function createPlacement(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void action(
      async () => {
        await authenticatedRequest(
          '/admin/commercial/placements',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                sponsorId:
                  placementSponsorId,
                key:
                  placementKey,
                headline:
                  placementHeadline
                    .trim(),

                ...(
                  placementBody
                    .trim()
                    ? {
                        body:
                          placementBody
                            .trim(),
                      }
                    : {}
                ),

                ...(
                  placementReward
                    .trim()
                    ? {
                        rewardText:
                          placementReward
                            .trim(),
                      }
                    : {}
                ),

                ...(
                  placementCtaLabel
                    .trim() &&
                  placementCtaUrl
                    .trim()
                    ? {
                        ctaLabel:
                          placementCtaLabel
                            .trim(),
                        ctaUrl:
                          placementCtaUrl
                            .trim(),
                      }
                    : {}
                ),

                ...(
                  placementTermsUrl
                    .trim()
                    ? {
                        termsUrl:
                          placementTermsUrl
                            .trim(),
                      }
                    : {}
                ),

                isActive:
                  false,
              }),
          },
        );

        setPlacementHeadline(
          '',
        );
        setPlacementBody(
          '',
        );
        setPlacementReward(
          '',
        );
        setPlacementCtaLabel(
          '',
        );
        setPlacementCtaUrl(
          '',
        );
        setPlacementTermsUrl(
          '',
        );
      },
      'Sponsor placement created inactive for review.',
    );
  }

  function createPlan(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const features =
      planFeatures
        .split(
          /\r?\n/,
        )
        .map(
          (
            value,
          ) =>
            value.trim(),
        )
        .filter(
          Boolean,
        );

    void action(
      async () => {
        await authenticatedRequest(
          '/admin/commercial/plans',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                code:
                  planCode
                    .trim()
                    .toUpperCase(),
                name:
                  planName
                    .trim(),
                audience:
                  planAudience,
                interval:
                  planInterval,
                priceMinor:
                  Number(
                    planPrice,
                  ),
                currency:
                  planCurrency
                    .trim()
                    .toUpperCase(),
                features,
                isActive:
                  false,

                ...(
                  planDescription
                    .trim()
                    ? {
                        description:
                          planDescription
                            .trim(),
                      }
                    : {}
                ),
              }),
          },
        );

        setPlanCode(
          '',
        );
        setPlanName(
          '',
        );
        setPlanDescription(
          '',
        );
        setPlanPrice(
          '',
        );
        setPlanFeatures(
          '',
        );
      },
      'Subscription plan created inactive for review.',
    );
  }

  function grantSubscription(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void action(
      () =>
        authenticatedRequest(
          '/admin/commercial/subscriptions/grant',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                planId:
                  grantPlanId,
                audience:
                  grantAudience,

                ...(
                  grantAudience ===
                  'USER'
                    ? {
                        targetUserId:
                          grantTargetId
                            .trim(),
                      }
                    : {
                        targetLeagueId:
                          grantTargetId
                            .trim(),
                      }
                ),

                ...(
                  grantDays
                    ? {
                        durationDays:
                          Number(
                            grantDays,
                          ),
                      }
                    : {}
                ),

                ...(
                  grantNote
                    .trim()
                    ? {
                        note:
                          grantNote
                            .trim(),
                      }
                    : {}
                ),
              }),
          },
        ),
      'Complimentary entitlement granted.',
    );
  }

  return (
    <SecondaryFeaturePage
      eyebrow="SUPER_ADMIN · V3.4"
      title="Commercial Infrastructure"
      subtitle="Sponsor registry, disclosed placements, subscription catalog and manual complimentary entitlements."
      backHref="/more"
      backLabel="More"
      action={
        data ? (
          <FcStatusBadge
            label={
              data.billing
                .checkoutAvailable
                ? 'Payments Live'
                : 'Catalog Only'
            }
            tone={
              data.billing
                .checkoutAvailable
                ? 'emerald'
                : 'slate'
            }
          />
        ) : null
      }
    >
      <AdminNavigation />

      {error ? (
        <FcPanel className="border-red-400/20 p-4 text-sm text-red-300">
          {
            error
          }
        </FcPanel>
      ) : null}

      {message ? (
        <FcPanel className="border-emerald-400/20 p-4 text-sm font-black text-emerald-300">
          ✓ {
            message
          }
        </FcPanel>
      ) : null}

      {data ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [
                'Active Sponsors',
                data.totals
                  .activeSponsors,
              ],
              [
                'Visible Placements',
                data.totals
                  .visiblePlacements,
              ],
              [
                'Active Plans',
                data.totals
                  .activePlans,
              ],
              [
                'Active Entitlements',
                data.totals
                  .activeSubscriptions,
              ],
            ].map(
              (
                item,
              ) => (
                <FcPanel
                  key={
                    item[0]
                  }
                  className="p-4"
                >
                  <p className="text-2xl font-black">
                    {
                      item[1]
                    }
                  </p>

                  <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-slate-600">
                    {
                      item[0]
                    }
                  </p>
                </FcPanel>
              ),
            )}
          </section>

          <FcPanel className="border-sky-400/15 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Payment Boundary
            </p>

            <h2 className="mt-1 text-lg font-black">
              Online checkout intentionally disabled
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              V3.4 stores plans and entitlements but does not pretend a payment has happened. Connect and verify a real payment provider in a later release before enabling checkout or recurring billing.
            </p>
          </FcPanel>

          <section className="grid gap-4 xl:grid-cols-2">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Sponsor Registry
              </p>

              <h2 className="mt-1 text-xl font-black">
                Create Sponsor
              </h2>

              <form
                onSubmit={
                  createSponsor
                }
                className="mt-4 grid gap-3"
              >
                <input
                  required
                  value={
                    sponsorName
                  }
                  onChange={(
                    event,
                  ) =>
                    setSponsorName(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Sponsor name"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <input
                  type="url"
                  value={
                    sponsorLogo
                  }
                  onChange={(
                    event,
                  ) =>
                    setSponsorLogo(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Logo URL · optional"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <input
                  type="url"
                  value={
                    sponsorWebsite
                  }
                  onChange={(
                    event,
                  ) =>
                    setSponsorWebsite(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Website URL · optional"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <textarea
                  value={
                    sponsorDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    setSponsorDescription(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={2}
                  placeholder="Description · optional"
                  className="theme-input rounded-xl border px-3 py-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    busy
                  }
                  className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-50"
                >
                  Create Sponsor Draft
                </button>
              </form>

              <div className="mt-5 space-y-2">
                {data.sponsors.map(
                  (
                    sponsor,
                  ) => (
                    <div
                      key={
                        sponsor.id
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            sponsor.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          {
                            sponsor.placements
                          }{' '}
                          placements
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <FcStatusBadge
                          label={
                            sponsor.status
                          }
                          tone={
                            sponsor.status ===
                            'ACTIVE'
                              ? 'emerald'
                              : sponsor.status ===
                                  'DRAFT'
                                ? 'amber'
                                : 'slate'
                          }
                        />

                        {sponsor.status !==
                        'ARCHIVED' ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void action(
                                () =>
                                  authenticatedRequest(
                                    '/admin/commercial/sponsors/' +
                                      sponsor.id,
                                    {
                                      method:
                                        'PATCH',
                                      body:
                                        JSON.stringify({
                                          status:
                                            sponsor.status ===
                                            'ACTIVE'
                                              ? 'PAUSED'
                                              : 'ACTIVE',
                                        }),
                                    },
                                  ),
                                sponsor.status ===
                                'ACTIVE'
                                  ? 'Sponsor paused.'
                                  : 'Sponsor activated.',
                              )
                            }
                            className="theme-secondary-button min-h-9 rounded-lg border px-3 text-[10px] font-black"
                          >
                            {sponsor.status ===
                            'ACTIVE'
                              ? 'Pause'
                              : 'Activate'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Sponsored Surfaces
              </p>

              <h2 className="mt-1 text-xl font-black">
                Create Placement
              </h2>

              <form
                onSubmit={
                  createPlacement
                }
                className="mt-4 grid gap-3"
              >
                <select
                  required
                  value={
                    placementSponsorId
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementSponsorId(
                      event
                        .target
                        .value,
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                >
                  <option value="">
                    Select sponsor
                  </option>

                  {data.sponsors.map(
                    (
                      sponsor,
                    ) => (
                      <option
                        key={
                          sponsor.id
                        }
                        value={
                          sponsor.id
                        }
                      >
                        {
                          sponsor.name
                        }
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={
                    placementKey
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementKey(
                      event
                        .target
                        .value as
                        Placement[
                          'key'
                        ],
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                >
                  <option value="DASHBOARD">
                    Dashboard
                  </option>
                  <option value="AWARDS">
                    Awards
                  </option>
                  <option value="LEAGUE_WAR">
                    League War
                  </option>
                  <option value="DISCOVER">
                    Discover
                  </option>
                </select>

                <input
                  required
                  value={
                    placementHeadline
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementHeadline(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Headline"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <textarea
                  value={
                    placementBody
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementBody(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={2}
                  placeholder="Body · optional"
                  className="theme-input rounded-xl border px-3 py-3 text-sm outline-none"
                />

                <input
                  value={
                    placementReward
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementReward(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Reward text · optional"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={
                      placementCtaLabel
                    }
                    onChange={(
                      event,
                    ) =>
                      setPlacementCtaLabel(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="CTA label"
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  />

                  <input
                    type="url"
                    value={
                      placementCtaUrl
                    }
                    onChange={(
                      event,
                    ) =>
                      setPlacementCtaUrl(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="CTA https://..."
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                  />
                </div>

                <input
                  type="url"
                  value={
                    placementTermsUrl
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlacementTermsUrl(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Reward terms URL · optional"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    busy ||
                    !placementSponsorId
                  }
                  className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-50"
                >
                  Create Inactive Placement
                </button>
              </form>

              <div className="mt-5 space-y-2">
                {data.placements
                  .slice(
                    0,
                    10,
                  )
                  .map(
                    (
                      placement,
                    ) => (
                      <div
                        key={
                          placement.id
                        }
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {
                                placement.headline
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-600">
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

                          <FcStatusBadge
                            label={
                              placement.currentlyVisible
                                ? 'VISIBLE'
                                : placement.isActive
                                  ? 'SCHEDULED'
                                  : 'OFF'
                            }
                            tone={
                              placement.currentlyVisible
                                ? 'emerald'
                                : placement.isActive
                                  ? 'cyan'
                                  : 'slate'
                            }
                          />
                        </div>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void action(
                              () =>
                                authenticatedRequest(
                                  '/admin/commercial/placements/' +
                                    placement.id,
                                  {
                                    method:
                                      'PATCH',
                                    body:
                                      JSON.stringify({
                                        isActive:
                                          !placement.isActive,
                                      }),
                                  },
                                ),
                              placement.isActive
                                ? 'Placement disabled.'
                                : 'Placement enabled.',
                            )
                          }
                          className="theme-secondary-button mt-3 min-h-9 rounded-lg border px-3 text-[10px] font-black"
                        >
                          {placement.isActive
                            ? 'Disable'
                            : 'Enable'}
                        </button>
                      </div>
                    ),
                  )}
              </div>
            </FcPanel>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Subscription Catalog
              </p>

              <h2 className="mt-1 text-xl font-black">
                Create Plan
              </h2>

              <form
                onSubmit={
                  createPlan
                }
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <input
                  required
                  value={
                    planCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanCode(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="PLAN_CODE"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <input
                  required
                  value={
                    planName
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanName(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Plan name"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <select
                  value={
                    planAudience
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanAudience(
                      event
                        .target
                        .value as
                        Plan[
                          'audience'
                        ],
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                >
                  <option value="USER">
                    Player
                  </option>
                  <option value="LEAGUE">
                    League
                  </option>
                </select>

                <select
                  value={
                    planInterval
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanInterval(
                      event
                        .target
                        .value as
                        Plan[
                          'interval'
                        ],
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                >
                  <option value="MONTHLY">
                    Monthly
                  </option>
                  <option value="YEARLY">
                    Yearly
                  </option>
                </select>

                <input
                  required
                  inputMode="numeric"
                  value={
                    planPrice
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanPrice(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Price in minor unit, e.g. 19900"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <input
                  required
                  maxLength={3}
                  value={
                    planCurrency
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanCurrency(
                      event
                        .target
                        .value
                        .toUpperCase(),
                    )
                  }
                  placeholder="INR"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <textarea
                  value={
                    planDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanDescription(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={2}
                  placeholder="Plan description"
                  className="theme-input rounded-xl border px-3 py-3 text-sm outline-none sm:col-span-2"
                />

                <textarea
                  required
                  value={
                    planFeatures
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanFeatures(
                      event
                        .target
                        .value,
                    )
                  }
                  rows={4}
                  placeholder={"One feature per line\nAdvanced analytics\nCustom tournament branding"}
                  className="theme-input rounded-xl border px-3 py-3 text-sm outline-none sm:col-span-2"
                />

                <button
                  type="submit"
                  disabled={
                    busy
                  }
                  className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-50 sm:col-span-2"
                >
                  Create Inactive Plan
                </button>
              </form>

              <div className="mt-5 space-y-2">
                {data.plans.map(
                  (
                    plan,
                  ) => (
                    <div
                      key={
                        plan.id
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {
                            plan.name
                          }
                        </p>

                        <p className="mt-1 font-mono text-[10px] text-slate-600">
                          {
                            plan.code
                          }{' '}
                          ·{' '}
                          {
                            plan.audience
                          }{' '}
                          ·{' '}
                          {
                            plan.subscriptions
                          }{' '}
                          records
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <FcStatusBadge
                          label={
                            plan.isActive
                              ? 'ACTIVE'
                              : 'DRAFT'
                          }
                          tone={
                            plan.isActive
                              ? 'emerald'
                              : 'slate'
                          }
                        />

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void action(
                              () =>
                                authenticatedRequest(
                                  '/admin/commercial/plans/' +
                                    plan.id,
                                  {
                                    method:
                                      'PATCH',
                                    body:
                                      JSON.stringify({
                                        isActive:
                                          !plan.isActive,
                                      }),
                                  },
                                ),
                              plan.isActive
                                ? 'Plan unpublished.'
                                : 'Plan published.',
                            )
                          }
                          className="theme-secondary-button min-h-9 rounded-lg border px-3 text-[10px] font-black"
                        >
                          {plan.isActive
                            ? 'Unpublish'
                            : 'Publish'}
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Complimentary Access
              </p>

              <h2 className="mt-1 text-xl font-black">
                Grant Entitlement
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Manual grants are intended for testing, sponsor benefits or approved complimentary access. They are explicitly stored as MANUAL_COMP, not as a paid transaction.
              </p>

              <form
                onSubmit={
                  grantSubscription
                }
                className="mt-4 grid gap-3"
              >
                <select
                  required
                  value={
                    grantPlanId
                  }
                  onChange={(
                    event,
                  ) =>
                    setGrantPlanId(
                      event
                        .target
                        .value,
                    )
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                >
                  <option value="">
                    Select plan
                  </option>

                  {data.plans.map(
                    (
                      plan,
                    ) => (
                      <option
                        key={
                          plan.id
                        }
                        value={
                          plan.id
                        }
                      >
                        {
                          plan.name
                        }{' '}
                        ·{' '}
                        {
                          plan.audience
                        }
                      </option>
                    ),
                  )}
                </select>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs text-slate-500">
                  Owner type:{' '}
                  <b className="text-slate-300">
                    {
                      grantAudience
                    }
                  </b>
                </div>

                <input
                  required
                  value={
                    grantTargetId
                  }
                  onChange={(
                    event,
                  ) =>
                    setGrantTargetId(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder={
                    grantAudience ===
                    'USER'
                      ? 'Target User UUID'
                      : 'Target League UUID'
                  }
                  className="theme-input min-h-11 rounded-xl border px-3 font-mono text-xs outline-none"
                />

                <input
                  inputMode="numeric"
                  value={
                    grantDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setGrantDays(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Duration days · blank uses plan interval"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <input
                  value={
                    grantNote
                  }
                  onChange={(
                    event,
                  ) =>
                    setGrantNote(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Grant reason · optional"
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
                />

                <button
                  type="submit"
                  disabled={
                    busy ||
                    !grantPlanId
                  }
                  className="min-h-11 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#04130d] disabled:opacity-50"
                >
                  Grant Complimentary Access
                </button>
              </form>

              <div className="mt-5 space-y-2">
                {data.subscriptions
                  .slice(
                    0,
                    12,
                  )
                  .map(
                    (
                      subscription,
                    ) => (
                      <div
                        key={
                          subscription.id
                        }
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {
                                subscription
                                  .owner
                                  .name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-600">
                              {
                                subscription
                                  .plan
                                  .name
                              }{' '}
                              ·{' '}
                              {
                                subscription.provider
                              }
                            </p>
                          </div>

                          <FcStatusBadge
                            label={
                              subscription.active
                                ? 'ACTIVE'
                                : subscription.status
                            }
                            tone={
                              subscription.active
                                ? 'emerald'
                                : 'slate'
                            }
                          />
                        </div>

                        {subscription.active ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void action(
                                () =>
                                  authenticatedRequest(
                                    '/admin/commercial/subscriptions/' +
                                      subscription.id +
                                      '/cancel',
                                    {
                                      method:
                                        'POST',
                                    },
                                  ),
                                'Subscription canceled.',
                              )
                            }
                            className="mt-3 min-h-9 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 text-[10px] font-black text-red-300 disabled:opacity-50"
                          >
                            End Access
                          </button>
                        ) : null}
                      </div>
                    ),
                  )}
              </div>
            </FcPanel>
          </section>
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading Commercial administration...
        </FcPanel>
      ) : (
        <FcEmptyState
          title="Commercial admin unavailable"
          description={
            error
          }
        />
      )}
    </SecondaryFeaturePage>
  );
}
