'use client';

import { useState, type FormEvent } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';
import { describeSavedPlayoffs } from '@/lib/saved-playoff-explainer';

/**
 * Admin-only, explicit format choice. Never convert an active tournament on
 * page load or quietly decide how many teams should qualify.
 */
export function LeaguePlayoffSetup({
  tournamentId,
  tournamentName,
  approvedEntries,
  onSaved,
  mode = 'create',
  savedQualifiers = null,
  savedFormat = null,
}: {
  tournamentId: string;
  tournamentName: string;
  approvedEntries: number;
  onSaved: () => Promise<void>;
  mode?: 'create' | 'edit';
  savedQualifiers?: number | null;
  savedFormat?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(savedQualifiers ? String(savedQualifiers) : '');
  const [bracket, setBracket] = useState(savedFormat ?? '');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const options = [4, 8, 16].filter(value => value <= approvedEntries);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = Number(count);
    if (busy || !options.includes(total) || !bracket || confirmation.trim() !== tournamentName ||
      (mode === 'edit' && total === savedQualifiers && bracket === savedFormat)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authenticatedRequest<{ data: { message: string } }>(
        mode === 'edit'
          ? `/tournaments/${tournamentId}/playoffs/league-settings`
          : `/tournaments/${tournamentId}/playoffs/enable-from-league`, {
          method: mode === 'edit' ? 'PATCH' : 'POST',
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
    <section className="theme-panel rounded-2xl border p-5" aria-label={mode === 'edit' ? 'Customize saved playoff format' : 'Change league winner format'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-lg font-black">{mode === 'edit' ? '⚙️ Customize Playoff Format' : 'Change to League + Playoffs'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === 'edit'
              ? 'You can change the qualifier count or bracket format while the tournament is active, but only before playoff fixtures are created. Existing league fixtures, scores and standings stay untouched.'
              : 'Currently, first place in the league wins. You can instead qualify a chosen number of teams from the final league standings and decide the champion through knockout playoffs. Existing scheduled matches and verified results are preserved.'}
          </p>
        </div>
        <button type="button" className="theme-secondary-button min-h-11 rounded-xl px-4 text-sm font-black"
          aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={busy}>
          {open ? 'Close setup' : mode === 'edit' ? 'Edit playoff settings' : 'Configure playoffs'}
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
          {options.includes(Number(count)) && bracket ? (() => {
            const guide = describeSavedPlayoffs({
              competitionFormat: 'GROUP_STAGE_KNOCKOUT',
              playoffSource: 'OVERALL_STANDINGS',
              playoffQualifiersTotal: Number(count),
              playoffFormat: bracket,
              approvedEntries,
              playoffSeedingBasis: 'OVERALL_PERFORMANCE',
            });
            return (
              <div aria-label="Your selected playoff format preview" className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-widest text-amber-300">Before you save · what happens next?</p>
                <h3 className="mt-2 text-lg font-bold">Top {count} → {guide.formatName}</h3>
                <p className="mt-2 text-sm leading-6">{guide.mechanism}</p>
                <p className="mt-2 text-sm font-semibold text-emerald-300">{guide.winnerRule}</p>
                <p className="mt-2 text-xs text-slate-400">{guide.reminder}</p>
              </div>
            );
          })() : null}
          <div className="sm:col-span-2">
            <p className="text-xs leading-5 text-amber-500">
              {mode === 'edit'
                ? 'Changes apply only to the saved rules. They do not redraw fixtures, and the server blocks edits once any playoff fixture exists. No existing league match is deleted or reset.'
                : 'This changes the official championship rule. It does not generate or reset fixtures. The playoff bracket can be generated only after all league matches finish.'}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
            Type the exact tournament name to confirm
            <input className="theme-input min-h-11 rounded-xl border px-3" value={confirmation}
              onChange={event => setConfirmation(event.target.value)} autoComplete="off"
              placeholder={tournamentName} required />
          </label>
          <button type="submit" className="theme-primary-button min-h-11 rounded-xl px-5 font-black disabled:opacity-40 sm:col-span-2"
            disabled={busy || !options.includes(Number(count)) || !bracket || confirmation.trim() !== tournamentName ||
              (mode === 'edit' && Number(count) === savedQualifiers && bracket === savedFormat)}>
            {busy ? 'Saving format…' : mode === 'edit' ? 'Save Playoff Changes' : 'Save League + Playoffs'}
          </button>
        </form>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-500">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm text-emerald-500">{message}</p> : null}
    </section>
  );
}
