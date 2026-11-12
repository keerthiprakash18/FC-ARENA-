'use client';

import { useCallback, useEffect, useState } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';

type Proposal = {
  id: string;
  proposedSide: string;
  startsAt: string;
  note: string | null;
  status: string;
  canAccept: boolean;
  canCancel: boolean;
  confirmedAt: string | null;
};
type Coordination = {
  enabled: boolean;
  officialScheduledAt?: string | null;
  proposals: Proposal[];
};

export function MatchTimeCoordination({
  matchId,
  isParticipant,
  status,
}: {
  matchId: string;
  isParticipant: boolean;
  status: string;
}) {
  const [data, setData] = useState<Coordination | null>(null);
  const [proposedLocal, setProposedLocal] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await authenticatedRequest<{ data: Coordination }>(
        `/matches/${matchId}/scheduling`, { signal },
      );
      if (!signal?.aborted) setData(response.data);
      if (!signal?.aborted) setError('');
    } catch (err) {
      if (!signal?.aborted) setError(
        err instanceof Error ? err.message : 'Unable to load match time proposals.',
      );
    }
  }, [matchId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!data?.enabled) return null;
  if (!['UNSCHEDULED', 'SCHEDULED', 'POSTPONED'].includes(status)) return null;

  async function mutate(action: 'create' | 'accept' | 'cancel', proposalId?: string) {
    if (busy) return;
    const startsAt = new Date(proposedLocal).getTime();
    if (action === 'create' && (!proposedLocal || !Number.isFinite(startsAt))) {
      setError('Select a date and time before proposing.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const endpoint = action === 'create'
        ? `/matches/${matchId}/scheduling`
        : `/matches/${matchId}/scheduling/${encodeURIComponent(proposalId ?? '')}/${action === 'accept' ? 'accept' : 'cancel'}`;
      await authenticatedRequest(endpoint, {
        method: 'POST',
        ...(action === 'create' ? {
          body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), note: note.trim() }),
        } : {}),
      });
      if (action === 'create') {
        setProposedLocal('');
        setNote('');
      }
      setMessage(action === 'accept'
        ? 'Accepted. Ask a league admin to update the official fixture schedule.'
        : action === 'cancel'
          ? 'Time proposal cancelled.'
          : 'Time proposal shared with the other side.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the time proposal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="match-time-coordination-title" className="theme-panel mt-5 rounded-2xl border border-[var(--theme-border)] p-4 sm:p-5">
      <div>
        <h2 id="match-time-coordination-title" className="theme-text text-lg font-bold">
          Match time coordination
        </h2>
        <p className="theme-secondary-text mt-1 text-sm leading-6">
          Suggest and agree on a time with the other side. This does not change the official
          fixture, match deadline, results or statistics. Only an authorized admin can reschedule the fixture.
          Times below are shown in Indian Standard Time (IST).
        </p>
        {data?.officialScheduledAt ? (
          <p className="theme-text mt-2 text-sm">
            Official match time: {new Date(data.officialScheduledAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
            })} IST
          </p>
        ) : null}
      </div>

      {error ? <p role="alert" className="theme-danger mt-3 text-sm">{error}</p> : null}
      {message ? <p role="status" className="theme-success mt-3 text-sm">{message}</p> : null}

      {isParticipant ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={event => { event.preventDefault(); void mutate('create'); }}
        >
          <label className="grid gap-1 text-sm">
            <span className="theme-text font-semibold">Your device-local time</span>
            <input
              type="datetime-local"
              className="theme-input min-h-11 rounded-lg border px-3"
              value={proposedLocal}
              onChange={event => setProposedLocal(event.target.value)}
              required
              disabled={busy}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="theme-text font-semibold">Optional note</span>
            <input
              className="theme-input min-h-11 rounded-lg border px-3"
              maxLength={240}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="e.g. Available after 8 PM"
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={busy || !proposedLocal} className="theme-primary-button min-h-11 self-end rounded-lg px-4 text-sm font-semibold disabled:opacity-50">
            Propose time
          </button>
        </form>
      ) : null}

      {data?.proposals.length ? (
        <ul className="mt-4 space-y-2" aria-label="Recent proposed match times">
          {data.proposals.map(proposal => (
            <li key={proposal.id} className="rounded-xl border border-[var(--theme-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="theme-text text-sm font-semibold">
                    {new Date(proposal.startsAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
                    })} IST
                  </p>
                  <p className="theme-secondary-text mt-1 text-xs">
                    {proposal.proposedSide} proposed · {proposal.status}
                    {proposal.note ? ` · ${proposal.note}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {proposal.canAccept ? (
                    <button type="button" disabled={busy} onClick={() => void mutate('accept', proposal.id)}
                      className="theme-primary-button min-h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50">
                      Accept
                    </button>
                  ) : null}
                  {proposal.canCancel ? (
                    <button type="button" disabled={busy} onClick={() => void mutate('cancel', proposal.id)}
                      className="theme-secondary-button min-h-11 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50">
                      Withdraw
                    </button>
                  ) : null}
                </div>
              </div>
              {proposal.status === 'ACCEPTED' ? (
                <p className="theme-secondary-text mt-2 text-xs">
                  Both sides agreed; the official match schedule is unchanged until admin action.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="theme-secondary-text mt-4 text-sm">No time proposals yet.</p>}
    </section>
  );
}
