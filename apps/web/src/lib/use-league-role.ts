'use client';

import { useEffect, useState } from 'react';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from './auth-client';
import { useActiveLeague } from './active-league';

interface Membership {
  membershipType: string;
  adminRole: 'OWNER' | 'ADMIN' | null;
  league: { id: string };
}

/** Presentation only; actions continue to use the server's resource permissions. */
export function useLeagueRole(currentUser?: CurrentUser, explicitRole?: string | null) {
  const [context, setContext] = useState<{ userId: string; memberships: Membership[] } | null>(null);
  const visible = currentUser && currentUser.id !== context?.userId ? null : context;
  const [leagueId] = useActiveLeague(currentUser?.id ?? visible?.userId, visible?.memberships ?? []);

  useEffect(() => {
    if (explicitRole) return;
    let active = true, pending = false;
    async function load() {
      if (pending || navigator.onLine === false) return;
      pending = true;
      try {
        const identity = currentUser ?? await getCurrentUser();
        const response = await authenticatedRequest<{ data: { leagues: Membership[] } }>('/leagues/my');
        // A response started under a previous login must not supply the next account's role.
        const latest = await getCurrentUser();
        if (active && latest.id === identity.id) setContext({ userId: identity.id, memberships: response.data.leagues });
      } catch { /* Keep the page usable; an unknown role is never presented as Player. */ }
      finally { pending = false; }
    }
    void load();
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    return () => { active = false; window.removeEventListener('focus', load); window.removeEventListener('online', load); };
  }, [currentUser, explicitRole]);

  if (explicitRole) return explicitRole;
  const membership = visible?.memberships.find(item => item.league.id === leagueId);
  return membership ? membership.adminRole ?? 'Player' : 'Account';
}
