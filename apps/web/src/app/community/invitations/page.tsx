'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

interface Membership {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
    pendingApplications: number;
  };
}

export default function InvitationsPage() {
  const [
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  useEffect(() => {
    void authenticatedRequest<any>(
      '/leagues/my',
    )
      .then(
        (
          response,
        ) =>
          setMemberships(
            response
              .data
              .leagues,
          ),
      )
      .catch(
        () =>
          setMemberships(
            [],
          ),
      );
  }, []);

  const adminLeagues =
    memberships.filter(
      (
        membership,
      ) =>
        Boolean(
          membership.adminRole,
        ),
    );

  return (
    <SecondaryFeaturePage
      eyebrow="Community"
      title="Invitations & Join Requests"
      subtitle="League join requests are managed within each League because the current backend does not expose a global invitation inbox."
    >
      {adminLeagues.length === 0 ? (
        <FcEmptyState
          title="No admin League requests"
          description="Player League joining still happens through a unique League code from the main League screen."
          actionLabel="Open Leagues"
          actionHref="/leagues"
        />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {adminLeagues.map(
            (
              membership,
            ) => (
              <Link
                key={
                  membership.league.id
                }
                href={
                  `/leagues/${membership.league.id}/settings`
                }
                className="group"
              >
                <FcPanel className="p-5 transition group-hover:border-sky-400/25">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-black">
                        {
                          membership.league.name
                        }
                      </h2>

                      <p className="mt-1 text-xs text-slate-600">
                        Open League Settings to review requests
                      </p>
                    </div>

                    <FcStatusBadge
                      label={
                        `${membership.league.pendingApplications} Pending`
                      }
                      tone={
                        membership.league.pendingApplications >
                        0
                          ? 'amber'
                          : 'slate'
                      }
                    />
                  </div>
                </FcPanel>
              </Link>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
