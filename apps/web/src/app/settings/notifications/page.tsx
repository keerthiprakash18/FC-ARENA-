'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { FcErrorState, FcLoadingScreen, FcPageHeader, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

type PreferenceKey = 'matchReminders' | 'leagueActivity' | 'tournamentActivity' | 'resultUpdates' | 'disputeUpdates' | 'achievements' | 'fairPlayUpdates';
type Preferences = Record<PreferenceKey, boolean>;

const ITEMS: Array<{ key: PreferenceKey; title: string; description: string }> = [
  { key: 'matchReminders', title: 'Match reminders', description: 'Upcoming matches, ready-to-play alerts and result deadlines.' },
  { key: 'leagueActivity', title: 'League activity', description: 'Join requests and league membership decisions.' },
  { key: 'tournamentActivity', title: 'Tournament activity', description: 'Tournament creation, registration and fixture changes.' },
  { key: 'resultUpdates', title: 'Results and statistics', description: 'Submitted, confirmed or rejected results and updated statistics.' },
  { key: 'disputeUpdates', title: 'Disputes', description: 'Opened and resolved match disputes.' },
  { key: 'achievements', title: 'Achievements', description: 'Tournament achievements and seasonal awards.' },
  { key: 'fairPlayUpdates', title: 'Fair Play', description: 'Fair Play reviews, commendations and warnings.' },
];

const DEFAULTS: Preferences = Object.fromEntries(ITEMS.map(({ key }) => [key, true])) as Preferences;

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [saving, setSaving] = useState<PreferenceKey | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [current, response] = await Promise.all([
          getCurrentUser(),
          authenticatedRequest<{ data: { preferences: Preferences } }>('/notifications/preferences'),
        ]);
        setUser(current);
        setPreferences({ ...DEFAULTS, ...response.data.preferences });
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('Unable to load notification preferences.');
      }
    })();
  }, [router]);

  async function toggle(key: PreferenceKey) {
    const next = !preferences[key];
    setSaving(key);
    setError('');
    setMessage('');
    setPreferences((current) => ({ ...current, [key]: next }));
    try {
      const response = await authenticatedRequest<{ data: { preferences: Preferences } }>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: next }),
      });
      setPreferences({ ...DEFAULTS, ...response.data.preferences });
      setMessage('Notification preferences saved.');
    } catch (err) {
      setPreferences((current) => ({ ...current, [key]: !next }));
      setError(err instanceof Error ? err.message : 'Unable to save notification preferences.');
    } finally {
      setSaving(null);
    }
  }

  if (!user) return <FcLoadingScreen label="Loading Notification Preferences..." />;
  const playerName = user.player?.identity?.inGameName || user.fullName;

  return (
    <AppShell playerName={playerName}>
      <div className="space-y-6">
        <FcPageHeader eyebrow="Account" title="Notification Preferences" subtitle="Choose which categories create new FC ARENA inbox and phone alerts. Existing notifications stay available in your inbox." />
        {error ? <FcErrorState message={error} onRetry={() => window.location.reload()} /> : null}
        {message ? <p role="status" className="theme-success rounded-xl border p-4 text-sm">{message}</p> : null}
        <FcPanel className="divide-y p-2 sm:p-3">
          {ITEMS.map(({ key, title, description }) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4 transition hover:bg-white/[0.03]">
              <span>
                <span className="theme-text block text-sm font-semibold">{title}</span>
                <span className="theme-muted mt-1 block text-sm leading-6">{description}</span>
              </span>
              <input
                type="checkbox"
                checked={preferences[key]}
                disabled={saving !== null}
                onChange={() => void toggle(key)}
                className="h-5 w-5 accent-[#A06B13]"
                aria-label={title}
              />
            </label>
          ))}
        </FcPanel>
      </div>
    </AppShell>
  );
}
