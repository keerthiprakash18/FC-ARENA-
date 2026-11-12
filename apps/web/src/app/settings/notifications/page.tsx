'use client';

import { useState } from 'react';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { AppShell } from '@/components/app/app-shell';
import { FcErrorState, FcLoadingScreen, FcPageHeader, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';

type PreferenceKey = 'matchReminders' | 'leagueActivity' | 'tournamentActivity' | 'resultUpdates' | 'disputeUpdates' | 'achievements' | 'fairPlayUpdates';
type QuietHours = { enabled: boolean; startHour: number; endHour: number };
type Preferences = Record<PreferenceKey, boolean> & { quietHours: QuietHours };

const ITEMS: Array<{ key: PreferenceKey; title: string; description: string }> = [
  { key: 'matchReminders', title: 'Match reminders', description: 'Upcoming matches, ready-to-play alerts and result deadlines.' },
  { key: 'leagueActivity', title: 'League activity', description: 'Join requests and league membership decisions.' },
  { key: 'tournamentActivity', title: 'Tournament activity', description: 'Tournament creation, registration and fixture changes.' },
  { key: 'resultUpdates', title: 'Results and statistics', description: 'Submitted, confirmed or rejected results and updated statistics.' },
  { key: 'disputeUpdates', title: 'Disputes', description: 'Opened and resolved match disputes.' },
  { key: 'achievements', title: 'Achievements', description: 'Tournament achievements and seasonal awards.' },
  { key: 'fairPlayUpdates', title: 'Fair Play', description: 'Fair Play reviews, commendations and warnings.' },
];

const DEFAULTS: Preferences = {
  ...(Object.fromEntries(ITEMS.map(({ key }) => [key, true])) as Record<PreferenceKey, boolean>),
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
};

export default function NotificationPreferencesPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [saving, setSaving] = useState<PreferenceKey | 'quietHours' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const initialLoad = useRecoverableLoad(async signal => {
    const [current, response] = await Promise.all([
      getCurrentUser({ signal }),
      authenticatedRequest<{ data: { preferences: Preferences } }>('/notifications/preferences', { signal }),
    ]);
    if (signal.aborted) return;
    setUser(current);
    setPreferences({ ...DEFAULTS, ...response.data.preferences });
  });

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

  async function saveQuietHours(next: QuietHours) {
    const previous = preferences.quietHours;
    setSaving('quietHours');
    setError('');
    setMessage('');
    setPreferences(current => ({ ...current, quietHours: next }));
    try {
      const response = await authenticatedRequest<{ data: { preferences: Preferences } }>('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          quietHoursEnabled: next.enabled,
          quietHoursStartHour: next.startHour,
          quietHoursEndHour: next.endHour,
        }),
      });
      setPreferences({ ...DEFAULTS, ...response.data.preferences });
      setMessage('Phone notification quiet hours saved.');
    } catch (err) {
      setPreferences(current => ({ ...current, quietHours: previous }));
      setError(err instanceof Error ? err.message : 'Unable to save quiet hours.');
    } finally {
      setSaving(null);
    }
  }

  if (initialLoad.error) return <AppShell currentUser={user ?? undefined}><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user) return <FcLoadingScreen label="Loading Notification Preferences..." />;
  const playerName = user.player?.identity?.inGameName || user.fullName;

  return (
    <AppShell currentUser={user} playerName={playerName}>
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

        <FcPanel className="p-5 sm:p-6">
          <h2 className="theme-text text-lg font-bold">Phone push quiet hours</h2>
          <p className="theme-secondary-text mt-2 text-sm leading-6">
            Optional quiet hours are calculated in India Standard Time. Non-urgent phone pushes
            wait until the window ends; urgent match and dispute alerts continue.
            Your in-app notification inbox always remains available.
          </p>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              aria-label="Enable phone push quiet hours"
              type="checkbox"
              checked={preferences.quietHours.enabled}
              disabled={saving !== null}
              onChange={event => void saveQuietHours({ ...preferences.quietHours, enabled: event.target.checked })}
              className="h-5 w-5 accent-[#A06B13]"
            />
            <span className="theme-text font-semibold">Enable quiet hours (IST)</span>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(['startHour', 'endHour'] as const).map(field => (
              <label key={field} className="grid gap-2">
                <span className="theme-secondary-text text-sm">{field === 'startHour' ? 'Start' : 'End'} (IST)</span>
                <select
                  aria-label={field === 'startHour' ? 'Quiet hours start IST' : 'Quiet hours end IST'}
                  className="theme-input min-h-11 rounded-xl border px-3"
                  value={preferences.quietHours[field]}
                  disabled={saving !== null}
                  onChange={event => void saveQuietHours({
                    ...preferences.quietHours, [field]: Number(event.target.value),
                  })}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="theme-secondary-text mt-3 text-xs">
            The end time is exclusive. Setting the same start and end time disables the quiet window.
            This controls phone push only, not match deadlines or inbox history.
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
