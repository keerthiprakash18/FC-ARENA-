'use client';

import { useState, type FormEvent } from 'react';
import { FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';

export interface EntryLimitTournament {
  id: string;
  maxEntries: number;
  approvedEntries?: number;
  pendingEntries?: number;
  canManageSettings?: boolean;
  canEditEntryLimit?: boolean;
  canExtendEntryLimit?: boolean;
  canPrepareFixtures?: boolean;
  entryLimitLockedReason?: string | null;
}

export function TournamentEntryLimit({ tournament, onUpdated }: {
  tournament: EntryLimitTournament;
  onUpdated: (maxEntries: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!tournament.canManageSettings) return null;

  const canEdit = tournament.canEditEntryLimit ?? tournament.canExtendEntryLimit;
  const minimum = Math.max(2, tournament.approvedEntries ?? 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    const maxEntries = Number(new FormData(event.currentTarget).get('maxEntries'));
    setError('');
    setMessage('');
    if (!Number.isInteger(maxEntries) || maxEntries < minimum || maxEntries > 128) {
      setError(`Choose a whole number from ${minimum} to 128. The limit must cover all approved entries.`);
      return;
    }
    setBusy(true);
    try {
      const response = await authenticatedRequest<{
        data: { maxEntries: number; message: string };
      }>(`/tournaments/${tournament.id}/entry-limit`, {
        method: 'PATCH', body: JSON.stringify({ maxEntries }),
      });
      onUpdated(response.data.maxEntries);
      setMessage(response.data.message);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the entry limit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FcPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">Entry Limit</h2>
          <p className="mt-1 text-sm text-slate-400">
            Current limit: <strong className="text-slate-200">{tournament.maxEntries}</strong> player or team entries.
          </p>
        </div>
        {canEdit && !editing ? (
          <button type="button" onClick={() => { setEditing(true); setMessage(''); setError(''); }}
            className="min-h-11 rounded-xl border border-sky-400/30 px-4 py-3 text-sm font-black text-sky-300">
            Edit Entry Limit
          </button>
        ) : null}
      </div>
      {canEdit ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Increase or reduce the limit before generating fixtures. Minimum: {minimum}, based on approved entries. Existing entries stay in place.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-amber-300">
          {tournament.entryLimitLockedReason || 'Entry limit changes are currently unavailable.'}
        </p>
      )}
      {editing && canEdit ? (
        <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid gap-2 sm:max-w-xs">
            <span className="text-xs font-black text-slate-400">New entry limit</span>
            <input name="maxEntries" type="number" inputMode="numeric" required step="1"
              min={minimum} max={128} defaultValue={tournament.maxEntries}
              disabled={busy} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy}
              className="min-h-11 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40">
              {busy ? 'Saving...' : 'Save Entry Limit'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(''); }}
              className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-black disabled:opacity-40">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {message ? <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
    </FcPanel>
  );
}
