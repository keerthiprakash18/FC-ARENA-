'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { FcErrorState, FcLoadingScreen, FcPageHeader, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

type DashboardSection = 'nextMatch' | 'league' | 'activeTournament' | 'stats' | 'quickActions' | 'activity';
type DashboardPreferences = { hiddenSections: DashboardSection[] };
const ITEMS: Array<{ key: DashboardSection; title: string; description: string }> = [
  { key: 'nextMatch', title: 'Next Match', description: 'Your next open fixture and opponent details.' },
  { key: 'league', title: 'My League', description: 'Selected league membership and context.' },
  { key: 'activeTournament', title: 'Active Tournament', description: 'Current competition progress and next fixture.' },
  { key: 'stats', title: 'Career Stats', description: 'Matches, wins, goals and win rate.' },
  { key: 'quickActions', title: 'Quick Actions', description: 'Shortcuts to awards, fixtures, leagues and profile.' },
  { key: 'activity', title: 'Latest Activity', description: 'Recent verified match results.' },
];

export default function DashboardPreferencesPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [hiddenSections, setHiddenSections] = useState<DashboardSection[]>([]);
  const [saving, setSaving] = useState<DashboardSection | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { preferences: DashboardPreferences } }>('/auth/preferences/dashboard'),
        ]);
        setUser(current);
        setHiddenSections(response.data.preferences.hiddenSections ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard preferences.');
      }
    })();
  }, []);

  async function toggle(key: DashboardSection) {
    const next = hiddenSections.includes(key)
      ? hiddenSections.filter((section) => section !== key)
      : [...hiddenSections, key];
    setSaving(key);
    setError('');
    setMessage('');
    setHiddenSections(next);
    try {
      await authenticatedRequest('/auth/preferences/dashboard', {
        method: 'PATCH',
        body: JSON.stringify({ hiddenSections: next }),
      });
      setMessage('Dashboard preferences saved.');
    } catch (err) {
      setHiddenSections(hiddenSections);
      setError(err instanceof Error ? err.message : 'Unable to save dashboard preferences.');
    } finally {
      setSaving(null);
    }
  }

  if (!user) return <FcLoadingScreen label="Loading Dashboard Preferences..." />;
  const playerName = user.player?.identity?.inGameName || user.fullName;
  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <FcPageHeader eyebrow="Account" title="Dashboard Preferences" subtitle="Choose which dashboard sections appear. This keeps customization safe and portable without changing dashboard data or card ordering." />
        {error ? <FcErrorState message={error} onRetry={() => window.location.reload()} /> : null}
        {message ? <p role="status" className="theme-success rounded-xl border p-4 text-sm">{message}</p> : null}
        <FcPanel className="divide-y p-2 sm:p-3">
          {ITEMS.map(({ key, title, description }) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4 transition hover:bg-white/[0.03]">
              <span><span className="theme-text block text-sm font-semibold">{title}</span><span className="theme-muted mt-1 block text-sm leading-6">{description}</span></span>
              <input type="checkbox" checked={!hiddenSections.includes(key)} disabled={saving !== null} onChange={() => void toggle(key)} className="h-5 w-5 accent-[#A06B13]" aria-label={`${title} visible`} />
            </label>
          ))}
        </FcPanel>
      </div>
    </AppShell>
  );
}
