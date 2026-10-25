'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { LeagueNavigation } from '@/components/leagues/league-navigation';
import { AdminManagementPanel } from '@/components/admin-management/admin-management-panel';
import { FcErrorState, FcLoadingScreen } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

export default function LeagueAdminsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [leagueName, setLeagueName] = useState('League');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { league: { name: string } } }>(`/leagues/${leagueId}`),
        ]);
        setUser(current);
        setLeagueName(response.data.league.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'League admin management could not be loaded.');
      }
    })();
  }, [leagueId]);

  if (error) return <FcErrorState message={error} />;
  if (!user) return <FcLoadingScreen label="Loading League Admin Management..." />;

  return <AppShell playerName={user.player?.identity?.inGameName || user.fullName}><div className="space-y-6"><BackHeader backHref={`/leagues/${leagueId}/settings`} backLabel="League Settings" eyebrow={leagueName} title="Manage Admins" subtitle="Assign, replace and remove League Admins with backend-enforced scoped permissions." /><LeagueNavigation leagueId={leagueId} /><AdminManagementPanel scopeType="LEAGUE" scopeId={leagueId} scopeName={leagueName} /></div></AppShell>;
}
