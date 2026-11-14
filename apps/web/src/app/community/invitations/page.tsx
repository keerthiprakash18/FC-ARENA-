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
  canManageMembers?: boolean;
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
    code: string;
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

  const [copyStatus, setCopyStatus] = useState('');

  const [copying, setCopying] = useState(false);

  async function copyInvite(leagueId: string, leagueName: string) {
    if (copying) return;
    setCopying(true);
    try {
      const { data } = await authenticatedRequest<{ data: { token: string } }>(
        `/leagues/${leagueId}/invites`, { method: 'POST' },
      );
      const url = new URL('/leagues', window.location.origin);
      url.searchParams.set('invite', data.token);
      await navigator.clipboard.writeText(url.toString());
      setCopyStatus(`Copied 7-day invite link for ${leagueName}.`);
    } catch (error) {
      setCopyStatus(error instanceof Error ? error.message : 'Unable to copy the league invitation.');
    } finally {
      setCopying(false);
    }
  }

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
      subtitle="Review pending membership requests and welcome players to your leagues."
    >
      {copyStatus ? <p role="status" className="theme-secondary-text mb-3 text-sm">{copyStatus}</p> : null}
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
              <FcPanel key={membership.league.id} className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="theme-text text-base font-bold">{membership.league.name}</h2>
                    <p className="theme-secondary-text mt-1 text-xs">Invite links only open the join preview. Joining still needs league approval where configured.</p>
                  </div>
                  <FcStatusBadge
                    label={`${membership.league.pendingApplications} Pending`}
                    tone={membership.league.pendingApplications > 0 ? 'amber' : 'slate'}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/leagues/${membership.league.id}/settings`}
                    className="theme-secondary-button inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold"
                  >
                    Review requests
                  </Link>
                  {(membership.canManageMembers ?? membership.adminRole === 'OWNER') ? (
                    <button
                      type="button"
                      className="theme-primary-button min-h-11 rounded-lg px-4 text-sm font-semibold"
                      disabled={copying}
                      onClick={() => void copyInvite(membership.league.id, membership.league.name)}
                    >
                      Copy 7-day invite link
                    </button>
                  ) : null}
                </div>
              </FcPanel>
            ),
          )}
        </section>
      )}
    </SecondaryFeaturePage>
  );
}
