'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';
import { FcEmptyState, FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

type Announcement = { id: string; title: string; body: string; publishedAt: string; createdBy: { fullName: string } };

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [canPublish, setCanPublish] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const response = await authenticatedRequest<{ success: true; data: { announcements: Announcement[]; canPublish: boolean } }>('/announcements');
      setAnnouncements(response.data.announcements);
      setCanPublish(response.data.canPublish);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await authenticatedRequest('/announcements', { method: 'POST', body: JSON.stringify({ title, body }) });
      setTitle('');
      setBody('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish announcement.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Community"
      title="Announcements"
      subtitle="A dedicated space for community notices."
    >
      {error ? <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
      {canPublish ? (
        <FcPanel className="p-5">
          <h2 className="theme-text text-lg font-semibold">Publish an announcement</h2>
          <form onSubmit={publish} className="mt-4 space-y-3">
            <input required minLength={3} maxLength={180} value={title} onChange={event => setTitle(event.target.value)} className="theme-input min-h-11 w-full rounded-[10px] border px-3 text-sm" placeholder="Announcement title" />
            <textarea required minLength={10} maxLength={10000} rows={4} value={body} onChange={event => setBody(event.target.value)} className="theme-input w-full rounded-[10px] border px-3 py-3 text-sm" placeholder="Share a clear update with the FC ARENA community" />
            <button type="submit" disabled={submitting} className="theme-primary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50">{submitting ? 'Publishing...' : 'Publish announcement'}</button>
          </form>
        </FcPanel>
      ) : null}

      {loading ? <FcPanel className="p-5"><p className="theme-secondary-text text-sm">Loading announcements...</p></FcPanel> : announcements.length === 0 ? (
        <FcEmptyState title="No announcements yet" description="Published FC ARENA notices will appear here." actionLabel="Open Notifications" actionHref="/notifications" />
      ) : announcements.map(announcement => (
        <FcPanel key={announcement.id} className="p-5">
          <p className="theme-muted text-xs uppercase tracking-[0.12em]">{new Date(announcement.publishedAt).toLocaleDateString()}</p>
          <h2 className="theme-text mt-2 text-xl font-semibold">{announcement.title}</h2>
          <p className="theme-secondary-text mt-3 whitespace-pre-wrap text-sm leading-7">{announcement.body}</p>
          <p className="theme-muted mt-4 text-xs">Published by {announcement.createdBy.fullName}</p>
        </FcPanel>
      ))}
    </SecondaryFeaturePage>
  );
}
