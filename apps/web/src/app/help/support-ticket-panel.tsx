'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authenticatedRequest, getCurrentUser } from '@/lib/auth-client';
import { ApiError } from '@/lib/api';

type TicketMessage = { id: string; body: string; createdAt: string; author: { fullName: string } };
type Ticket = { id: string; subject: string; status: string; createdAt: string; updatedAt: string; createdBy: { fullName: string }; messages: TicketMessage[] };

export function SupportTicketPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});
  const [statusByTicket, setStatusByTicket] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  async function load() {
    try {
      await getCurrentUser();
      setSignedIn(true);
      const response = await authenticatedRequest<{ success: true; data: { tickets: Ticket[]; isManager: boolean } }>('/support-tickets');
      setTickets(response.data.tickets);
      setIsManager(response.data.isManager);
      setStatusByTicket(Object.fromEntries(response.data.tickets.map(ticket => [ticket.id, ticket.status])));
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) setError('Please sign in to use support tickets.');
      else setError(caught instanceof Error ? caught.message : 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (!signedIn && !loading && error.includes('sign in')) {
    return <section className="theme-panel rounded-2xl border p-5 sm:p-6"><h2 className="theme-text text-lg font-semibold">Sign in to contact support</h2><p className="theme-secondary-text mt-2 text-sm leading-7">Your support tickets are private to your account. Sign in to create a ticket or view replies.</p><a href="/login" className="theme-primary-button mt-4 inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold">Sign in to FC ARENA</a></section>;
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await authenticatedRequest('/support-tickets', { method: 'POST', body: JSON.stringify({ subject, message }) });
      setSubject('');
      setMessage('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create support ticket.');
    } finally {
      setSaving(false);
    }
  }

  async function reply(ticketId: string) {
    const body = replyByTicket[ticketId]?.trim();
    if (!body) return;
    setSaving(true);
    try {
      await authenticatedRequest(`/support-tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
      setReplyByTicket(current => ({ ...current, [ticketId]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send the reply.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(ticketId: string) {
    setSaving(true);
    try {
      await authenticatedRequest(`/support-tickets/${ticketId}`, { method: 'PATCH', body: JSON.stringify({ status: statusByTicket[ticketId] }) });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update ticket status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
      <section className="theme-panel rounded-2xl border p-5 sm:p-6">
        <h2 className="theme-text text-lg font-semibold">Create a support ticket</h2>
        <p className="theme-secondary-text mt-2 text-sm leading-7">Tell the FC ARENA team what happened. Keep passwords, OTPs and other secrets out of support messages.</p>
        <form onSubmit={createTicket} className="mt-4 space-y-3">
          <input required minLength={3} maxLength={180} value={subject} onChange={event => setSubject(event.target.value)} className="theme-input min-h-11 w-full rounded-[10px] border px-3 text-sm" placeholder="What do you need help with?" />
          <textarea required minLength={10} maxLength={10000} rows={4} value={message} onChange={event => setMessage(event.target.value)} className="theme-input w-full rounded-[10px] border px-3 py-3 text-sm" placeholder="Include the relevant League, Tournament or Match context" />
          <button type="submit" disabled={saving} className="theme-primary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50">{saving ? 'Submitting...' : 'Submit ticket'}</button>
        </form>
      </section>

      <section className="space-y-3" aria-live="polite">
        <h2 className="theme-text text-lg font-semibold">{isManager ? 'Support queue' : 'Your support tickets'}</h2>
        {loading ? <div className="theme-panel rounded-2xl border p-5"><p className="theme-secondary-text text-sm">Loading tickets...</p></div> : tickets.length === 0 ? <div className="theme-panel rounded-2xl border p-5"><p className="theme-secondary-text text-sm">No support tickets yet.</p></div> : tickets.map(ticket => (
          <article key={ticket.id} className="theme-panel rounded-2xl border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="theme-text font-semibold">{ticket.subject}</h3><p className="theme-muted mt-1 text-xs">Opened {new Date(ticket.createdAt).toLocaleDateString()} · {ticket.createdBy.fullName}</p></div>
              <span className="theme-soft-accent rounded-full border px-3 py-1 text-xs font-semibold">{ticket.status.replace('_', ' ')}</span>
            </div>
            <div className="mt-4 space-y-3">
              {ticket.messages.map(item => <div key={item.id} className="rounded-xl border border-white/10 p-3"><p className="theme-muted text-xs">{item.author.fullName} · {new Date(item.createdAt).toLocaleString()}</p><p className="theme-secondary-text mt-2 whitespace-pre-wrap text-sm leading-6">{item.body}</p></div>)}
            </div>
            {ticket.status !== 'CLOSED' ? <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={replyByTicket[ticket.id] ?? ''} onChange={event => setReplyByTicket(current => ({ ...current, [ticket.id]: event.target.value }))} maxLength={10000} className="theme-input min-h-11 min-w-0 flex-1 rounded-[10px] border px-3 text-sm" placeholder="Add a reply" /><button type="button" disabled={saving} onClick={() => void reply(ticket.id)} className="theme-secondary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50">Reply</button></div> : null}
            {isManager ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"><label htmlFor={`status-${ticket.id}`} className="theme-muted text-xs">Update status</label><select id={`status-${ticket.id}`} value={statusByTicket[ticket.id] ?? ticket.status} onChange={event => setStatusByTicket(current => ({ ...current, [ticket.id]: event.target.value }))} className="theme-input min-h-10 rounded-[10px] border px-3 text-sm"><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select><button type="button" disabled={saving} onClick={() => void updateStatus(ticket.id)} className="theme-secondary-button min-h-10 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-50">Save status</button></div> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
