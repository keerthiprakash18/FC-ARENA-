'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AdminNavigation } from '@/components/admin/admin-navigation';
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
    code: string;
    members: number;
    pendingApplications: number;
  };
}

export default function AdminLeaguesPage() {
  const [
    leagues,
    setLeagues,
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
          setLeagues(
            response
              .data
              .leagues
              .filter(
                (
                  membership:
                    Membership,
                ) =>
                  Boolean(
                    membership.adminRole,
                  ),
              ),
          ),
      )
      .catch(
        () =>
          setLeagues(
            [],
          ),
      );
  }, []);

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="League Management"
      subtitle="Open a specific League for member, application and competition administration."
    >
      <AdminNavigation />

      {leagues.length === 0 ? (
        <FcEmptyState
          title="No League admin access"
          description="Admin tools appear only for Leagues where you are OWNER or ADMIN."
          actionLabel="Open Leagues"
          actionHref="/leagues"
        />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {leagues.map(
            (
              membership,
            ) => (
              <FcPanel
                key={
                  membership.league.id
                }
                className="p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] text-sky-400">
                      {
                        membership.league.code
                      }
                    </p>

                    <h2 className="mt-2 text-lg font-black">
                      {
                        membership.league.name
                      }
                    </h2>

                    <p className="mt-2 text-xs text-slate-600">
                      {
                        membership.league.members
                      }{' '}
                      members ·{' '}
                      {
                        membership.league.pendingApplications
                      }{' '}
                      pending
                    </p>
                  </div>

                  <FcStatusBadge
                    label={
                      membership.adminRole ||
                      'ADMIN'
                    }
                    tone="amber"
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={
                      `/leagues/${membership.league.id}/settings`
                    }
                    className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
                  >
                    Settings
                  </Link>

                  <Link
                    href={
                      `/leagues/${membership.league.id}/members`
                    }
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-300"
                  >
                    Members
                  </Link>
                </div>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
