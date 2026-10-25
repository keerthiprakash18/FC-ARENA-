'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { TournamentNavigation } from '@/components/tournaments/tournament-navigation';
import { AdminManagementPanel } from '@/components/admin-management/admin-management-panel';
import { FcErrorState, FcLoadingScreen } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

export default function TournamentAdminsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tournamentName, setTournamentName] = useState('Tournament');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { tournament: { name: string } } }>(`/tournaments/${tournamentId}`),
        ]);
        setUser(current);
        setTournamentName(response.data.tournament.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tournament admin management could not be loaded.');
      }
    })();
  }, [tournamentId]);

  if (error) return <FcErrorState message={error} />;
  if (!user) return <FcLoadingScreen label="Loading Tournament Admin Management..." />;

  return <AppShell playerName={user.player?.identity?.inGameName || user.fullName}><div className="space-y-6"><BackHeader backHref={`/tournaments/${tournamentId}/settings`} backLabel="Tournament Settings" eyebrow={tournamentName} title="Manage Admins" subtitle="Tournament admins are separate from League Admins and can only operate within this Tournament." /><TournamentNavigation tournamentId={tournamentId} /><AdminManagementPanel scopeType="TOURNAMENT" scopeId={tournamentId} scopeName={tournamentName} /></div></AppShell>;
}
