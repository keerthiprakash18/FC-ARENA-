'use client';

import {
  useEffect,
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
  features: string[];
}

interface Subscription {
  id: string;
  audience:
    | 'USER'
    | 'LEAGUE';
  status: string;
  provider: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceMinorSnapshot: number;
  currencySnapshot: string;
  active: boolean;

  plan: {
    id: string;
    code: string;
    name: string;
    audience: string;
    interval: string;
    features: string[];
  };

  league: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
}

interface CommercialData {
  plans: Plan[];

  membership: {
    subscriptions:
      Subscription[];
    activeUserSubscription:
      string | null;
    administeredLeagueIds:
      string[];
  };

  billing: {
    checkoutAvailable: boolean;
    mode: string;
    message: string;
  };
}

function money(
  priceMinor:
    number,
  currency:
    string,
) {
  try {
    const formatter =
      new Intl.NumberFormat(
        undefined,
        {
          style:
            'currency',
          currency,
        },
      );

    const digits =
      formatter
        .resolvedOptions()
        .maximumFractionDigits;

    return formatter.format(
      priceMinor /
        Math.pow(
          10,
          digits,
        ),
    );
  } catch {
    return (
      currency +
      ' ' +
      priceMinor
    );
  }
}

export default function MembershipPage() {
  const [
    data,
    setData,
  ] =
    useState<CommercialData | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void authenticatedRequest<{
      success: true;
      data: CommercialData;
      error: null;
    }>('/commercial')
      .then(
        (
          response,
        ) =>
          setData(
            response.data,
          ),
      )
      .catch(
        (
          err,
        ) =>
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load FC Arena Membership.',
          ),
      );
  }, []);

  const active =
    data?.membership
      .subscriptions
      .filter(
        (
          subscription,
        ) =>
          subscription.active,
      ) ??
    [];

  return (
    <SecondaryFeaturePage
      eyebrow="FC Arena V3.4"
      title="Membership"
      subtitle="Subscription plan catalog and your current FC Arena entitlements."
      backHref="/more"
      backLabel="More"
      action={
        <FcStatusBadge
          label={
            active.length >
            0
              ? active.length +
                ' Active'
              : 'Free Access'
          }
          tone={
            active.length >
            0
              ? 'emerald'
              : 'cyan'
          }
        />
      }
    >
      {error ? (
        <FcEmptyState
          title="Membership unavailable"
          description={
            error
          }
        />
      ) : null}

      {data ? (
        <>
          <FcPanel className="border-sky-400/15 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                  Billing Status
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Plan Catalog Ready
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {
                    data.billing
                      .message
                  }
                </p>
              </div>

              <FcStatusBadge
                label={
                  data.billing
                    .checkoutAvailable
                    ? 'Checkout Enabled'
                    : 'No Online Checkout'
                }
                tone={
                  data.billing
                    .checkoutAvailable
                    ? 'emerald'
                    : 'slate'
                }
              />
            </div>
          </FcPanel>

          <section>
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Your Access
              </p>

              <h2 className="mt-1 text-xl font-black">
                Active Entitlements
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {active.map(
                (
                  subscription,
                ) => (
                  <FcPanel
                    key={
                      subscription.id
                    }
                    className="border-emerald-400/15 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {
                            subscription
                              .plan
                              .name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            subscription.audience ===
                            'LEAGUE'
                              ? subscription
                                  .league
                                  ?.name ??
                                'League'
                              : 'Player membership'
                          }
                        </p>
                      </div>

                      <FcStatusBadge
                        label={
                          subscription.status
                        }
                        tone="emerald"
                      />
                    </div>

                    <p className="mt-4 text-sm font-black text-emerald-300">
                      {
                        money(
                          subscription
                            .priceMinorSnapshot,
                          subscription
                            .currencySnapshot,
                        )
                      }{' '}
                      snapshot
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      {subscription
                        .currentPeriodEnd
                        ? 'Valid until ' +
                          new Date(
                            subscription
                              .currentPeriodEnd,
                          ).toLocaleDateString()
                        : 'No fixed expiry'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {subscription
                        .plan
                        .features
                        .map(
                          (
                            feature,
                          ) => (
                            <span
                              key={
                                feature
                              }
                              className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-400"
                            >
                              {
                                feature
                              }
                            </span>
                          ),
                        )}
                    </div>
                  </FcPanel>
                ),
              )}

              {active.length ===
              0 ? (
                <FcPanel className="p-6 text-sm text-slate-500 md:col-span-2">
                  You currently use standard FC Arena access. No paid or complimentary entitlement is active.
                </FcPanel>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Plans
              </p>

              <h2 className="mt-1 text-xl font-black">
                Membership Catalog
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {data.plans.map(
                (
                  plan,
                ) => (
                  <FcPanel
                    key={
                      plan.id
                    }
                    className="h-full p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">
                          {
                            plan.name
                          }
                        </p>

                        <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                          {
                            plan.audience
                          }{' '}
                          ·{' '}
                          {
                            plan.interval
                          }
                        </p>
                      </div>

                      <span className="font-mono text-[10px] text-sky-400">
                        {
                          plan.code
                        }
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-black">
                      {
                        money(
                          plan.priceMinor,
                          plan.currency,
                        )
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      per{' '}
                      {
                        plan.interval ===
                        'MONTHLY'
                          ? 'month'
                          : 'year'
                      }
                    </p>

                    {plan.description ? (
                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        {
                          plan.description
                        }
                      </p>
                    ) : null}

                    <ul className="mt-4 space-y-2 text-sm text-slate-400">
                      {plan.features.map(
                        (
                          feature,
                        ) => (
                          <li
                            key={
                              feature
                            }
                          >
                            ✓ {
                              feature
                            }
                          </li>
                        ),
                      )}
                    </ul>

                    <button
                      type="button"
                      disabled
                      className="theme-secondary-button mt-5 min-h-11 w-full cursor-not-allowed rounded-xl border px-4 text-sm font-black opacity-60"
                    >
                      Online checkout not enabled
                    </button>
                  </FcPanel>
                ),
              )}

              {data.plans
                .length ===
                0 ? (
                <FcEmptyState
                  title="No membership plans published"
                  description="FC Arena standard access remains available. Plans will appear here only after an administrator publishes the catalog."
                />
              ) : null}
            </div>
          </section>
        </>
      ) : !error ? (
        <FcPanel className="p-8 text-center text-sm text-slate-500">
          Loading Membership...
        </FcPanel>
      ) : null}
    </SecondaryFeaturePage>
  );
}
