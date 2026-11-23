'use client';

import { useRef, useState, type FormEvent } from 'react';
import { authenticatedRequest } from '@/lib/auth-client';
import { ApiError } from '@/lib/api';
import type { DuoEntry, DuoGame } from './duo-aggregate-inputs';
import { PenaltyInputs, readPenaltyScores } from './penalty-inputs';

type SavedGame = DuoGame & { version: number };
export type DuoProgress = {
  revision: number; games: SavedGame[]; completedGames: number; requiredGames: number;
  homeScore: number; awayScore: number; complete: boolean;
};
export type DuoProgressContext = { home: DuoEntry | null; away: DuoEntry | null; gameCount: number; penaltiesAllowed?: boolean; progress: DuoProgress };
type Edit = { home: string; away: string; version: number };
const name = (player: NonNullable<DuoEntry['members']>[number]) => player.inGameName || player.fullName;
const keyOf = (game: Pick<DuoGame, 'homePlayerId' | 'awayPlayerId'>) => `${game.homePlayerId}:${game.awayPlayerId}`;
const validScore = (value: string) => /^\d{1,2}$/.test(value);

export function DuoResultPanel({ matchId, context, canSave = true, canVerify = false, disabled = false, allowPenalties = false, homeName = 'Home', awayName = 'Away', onCompleted }: {
  matchId: string; context: DuoProgressContext; canSave?: boolean; canVerify?: boolean; disabled?: boolean;
  allowPenalties?: boolean; homeName?: string; awayName?: string; onCompleted: () => Promise<void> | void;
}) {
  const [responseProgress, setResponseProgress] = useState<DuoProgress | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const writing = useRef(false);
  const progress = responseProgress && responseProgress.revision > context.progress.revision ? responseProgress : context.progress;
  const home = [...(context.home?.members ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const away = [...(context.away?.members ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const savedSwap = progress.games.some(game => home.findIndex(player => player.id === game.homePlayerId) !== away.findIndex(player => player.id === game.awayPlayerId));
  const [swap, setSwap] = useState(false);
  const pairings = home.length === 2 && away.length === 2 ? home.flatMap((player, index) =>
    (context.gameCount === 4 ? away : [away[(progress.games.length ? savedSwap : swap) ? 1 - index : index]!]).map(opponent => ({ player, opponent }))) : [];
  const rows = pairings.map(({ player, opponent }) => {
    const key = keyOf({ homePlayerId: player.id, awayPlayerId: opponent.id });
    const saved = progress.games.find(game => keyOf(game) === key);
    const edit = edits[key] ?? { home: saved?.homeGoals.toString() ?? '', away: saved?.awayGoals.toString() ?? '', version: saved?.version ?? 0 };
    const clean = Boolean(saved && validScore(edit.home) && validScore(edit.away) && Number(edit.home) === saved.homeGoals && Number(edit.away) === saved.awayGoals);
    return { player, opponent, key, saved, edit, clean };
  });
  const ready = progress.complete && rows.length === context.gameCount && rows.every(row => row.clean);
  const locked = disabled || !canSave || Boolean(busy);

  async function reloadSaved() {
    const result = await authenticatedRequest<{ data: { duoContext?: DuoProgressContext | null } }>(`/matches/${matchId}/results`, { cache: 'no-store' });
    if (result.data.duoContext) setResponseProgress(result.data.duoContext.progress);
  }
  function update(key: string, current: Edit, field: 'home' | 'away', value: string) {
    setEdits(values => ({ ...values, [key]: { ...current, [field]: value } }));
  }
  async function saveGame(row: typeof rows[number]) {
    if (writing.current || locked) return;
    setError(''); setNotice('');
    if (!validScore(row.edit.home) || !validScore(row.edit.away)) { setError('Enter both scores for this game, from 0 to 99.'); return; }
    writing.current = true; setBusy(row.key);
    try {
      const result = await authenticatedRequest<{ data: { progress: DuoProgress } }>(`/matches/${matchId}/duo-games`, {
        method: 'PUT', body: JSON.stringify({ homePlayerId: row.player.id, awayPlayerId: row.opponent.id,
          homeGoals: Number(row.edit.home), awayGoals: Number(row.edit.away), expectedVersion: row.edit.version }),
      });
      setResponseProgress(result.data.progress);
      setEdits(current => { const next = { ...current }; delete next[row.key]; return next; });
      setNotice(`Game saved. ${result.data.progress.completedGames} of ${context.gameCount} games saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this game. Your scores are kept; retry when connected.');
      await reloadSaved().catch(() => {}); // Reconcile a lost response; never replay a write automatically.
    } finally { writing.current = false; setBusy(''); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || locked || writing.current) return;
    const penalties = readPenaltyScores(new FormData(event.currentTarget));
    writing.current = true; setBusy('fixture'); setError(''); setNotice('');
    try {
      const result = await authenticatedRequest<{ data: { submission: { id: string }; message: string } }>(`/matches/${matchId}/results`, {
        method: 'POST', body: JSON.stringify({ homeScore: progress.homeScore, awayScore: progress.awayScore,
          duoGames: progress.games.map(({ homePlayerId, awayPlayerId, homeGoals, awayGoals }) => ({ homePlayerId, awayPlayerId, homeGoals, awayGoals })), ...penalties }),
      });
      if (canVerify) await authenticatedRequest(`/results/${result.data.submission.id}/confirm`, { method: 'POST' });
      setNotice(canVerify ? 'Fixture verified. Statistics and standings updated.' : result.data.message);
      await onCompleted();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not finish this fixture. Saved games are kept.');
      await Promise.resolve(onCompleted()).catch(() => {});
    } finally { writing.current = false; setBusy(''); }
  }
  if (pairings.length !== context.gameCount) return <p role="alert">Both Duo entries need exactly two players before games can be saved.</p>;
  return <form onSubmit={submit} className="grid min-w-0 gap-4 rounded-2xl border border-amber-400/20 p-4 sm:p-5" aria-label="Individual Duo results">
    <header className="space-y-2">
      <h3 className="theme-text text-lg font-semibold">Save each game as it finishes</h3>
      <p className="theme-secondary-text text-sm">Saved scores stay here when you return. Fixture points, player statistics and awards update after all {context.gameCount} games are verified together.</p>
    </header>
    {context.gameCount === 2 && !progress.games.length ? <button type="button" disabled={locked} className="theme-secondary-button min-h-11 justify-self-start rounded-xl border px-4 py-2" onClick={() => { setSwap(value => !value); setEdits({}); }}>Swap opponent pairings</button> : null}
    {rows.map((row, index) => <fieldset key={row.key} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3">
      <legend className="max-w-full break-words px-1 text-sm font-bold">Game {index + 1}: {name(row.player)} vs {name(row.opponent)}</legend>
      <div className="grid min-w-0 grid-cols-2 gap-3">
        {(['home', 'away'] as const).map(side => <label key={side} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 text-xs font-semibold">
          <span className="min-w-0 [overflow-wrap:anywhere]">{name(side === 'home' ? row.player : row.opponent)} goals</span>
          <input type="number" inputMode="numeric" min={0} max={99} disabled={locked} value={row.edit[side]}
            aria-label={`Game ${index + 1} ${side === 'home' ? 'home' : 'away'} goals`}
            onChange={event => update(row.key, row.edit, side, event.target.value)}
            className="theme-input min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-center text-lg font-semibold tabular-nums" />
        </label>)}
      </div>
      <p className="theme-secondary-text text-xs">{row.clean ? 'Saved' : row.saved ? `Saved score: ${row.saved.homeGoals} – ${row.saved.awayGoals} · unsaved changes` : 'Not saved yet'}</p>
      {canSave ? <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void saveGame(row)} disabled={locked || row.clean} className="theme-secondary-button min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy === row.key ? 'Saving...' : `Save game ${index + 1}`}
        </button>
        {row.saved && !row.clean ? <button type="button" disabled={locked} className="text-link min-h-11 px-2 text-sm" onClick={() => setEdits(current => { const next = { ...current }; delete next[row.key]; return next; })}>Use saved score for game {index + 1}</button> : null}
      </div> : null}
    </fieldset>)}
    <div role="status" className="flex flex-wrap justify-between gap-3 rounded-xl border border-amber-400/30 p-4">
      <span>{progress.completedGames} of {context.gameCount} games saved</span>
      <strong className="text-lg tabular-nums">Saved total: {progress.homeScore} – {progress.awayScore}</strong>
    </div>
    {allowPenalties ? <div className="min-w-0"><PenaltyInputs home={homeName} away={awayName} /></div> : null}
    {error ? <p role="alert" className="theme-danger text-sm">{error}</p> : null}
    {notice ? <p role="status" className="theme-secondary-text text-sm">{notice}</p> : null}
    {canSave ? <button type="submit" disabled={locked || !ready} className="theme-primary-button min-h-12 rounded-xl border px-4 py-3 font-bold disabled:opacity-50">
      {busy === 'fixture' ? 'Finishing fixture...' : canVerify ? 'Verify fixture & update stats' : 'Submit fixture for verification'}
    </button> : null}
  </form>;
}
