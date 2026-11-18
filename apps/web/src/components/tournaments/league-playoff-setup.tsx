'use client';

import { useState, type FormEvent } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';

/**
 * Admin-only, explicit format choice. Never convert an active tournament on
 * page load or quietly decide how many teams should qualify.
 */
export function LeaguePlayoffSetup({
  tournamentId,
  tournamentName,
  approvedEntries,
  onSaved,
}: {
  tournamentId: string;
  tournamentName: string;
  approvedEntries: number;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState('');
  const [bracket, setBracket] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const options = [4, 8, 16].filter(value => value <= approvedEntries);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = Number(count);
    if (busy || !options.includes(total) || !bracket || confirmation.trim() !== tournamentName) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authenticatedRequest<{ data: { message: string } }>(
        `/tournaments/${tournamentId}/playoffs/enable-from-league`, {
          method: 'POST',
          body: JSON.stringify({
            playoffQualifiersTotal: total,
            playoffFormat: bracket,
            confirmation: confirmation.trim(),
          }),
        },
      );
      setMessage(result.data.message);
      window.dispatchEvent(new CustomEvent('fcarena:tournament-updated', { detail: { tournamentId } }));
      await onSaved();
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update the winner format.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="theme-panel rounded-2xl border p-5" aria-label="Change league winner format">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-black">Change to League + Playoffs</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Currently, first place in the league wins. You can instead qualify a chosen number
            of teams from the final league standings and decide the champion through knockout playoffs.
            Existing scheduled matches and verified results are preserved.
          </p>
        </div>
        <button type="button" className="theme-secondary-button min-h-11 rounded-xl px-4 text-sm font-black"
          aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={busy}>
          {open ? 'Close setup' : 'Configure playoffs'}
        </button>
      </div>
      {open && (
        <form className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2" onSubmit={event => void submit(event)}>
          <label className="grid gap-2 text-sm font-semibold">
            Qualifiers from final league table
            <select className="theme-input min-h-11 rounded-xl border px-3" value={count} onChange={event => setCount(event.target.value)} required>
              <option value="">Choose number of teams</option>
              {options.map(option => <option value={option} key={option}>Top {option} teams</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Playoff bracket format
            <select className="theme-input min-h-11 rounded-xl border px-3" value={bracket} onChange={event => setBracket(event.target.value)} required>
              <option value="">Choose playoff format</option>
              <option value="PROTECTED_SEED">Protected Seed Knockout</option>
              <option value="GLOBAL_SEEDED">Global Seeded Knockout</option>
              <option value="DOUBLE_CHANCE">Double-Chance Playoffs</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs leading-5 text-amber-500">
              This changes the official championship rule. It does not generate or reset fixtures.
              The playoff bracket can be generated only after all league matches finish.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Type the exact tournament name to confirm
            <input className="theme-input min-h-11 rounded-xl border px-3" value={confirmation}
              onChange={event => setConfirmation(event.target.value)} autoComplete="off"
              placeholder={tournamentName} required />
          </label>
          <button type="submit" className="theme-primary-button min-h-11 rounded-xl px-5 font-black disabled:opacity-40 sm:col-span-2"
            disabled={busy || !options.includes(Number(count)) || !bracket || confirmation.trim() !== tournamentName}>
            {busy ? 'Saving format…' : 'Save League + Playoffs'}
          </button>
        </form>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-500">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm text-emerald-500">{message}</p> : null}
    </section>
  );
}
