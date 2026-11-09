'use client';

import { useRef, useState } from 'react';
import { FcDialog } from '@/components/fc/fc-dialog';
import { authenticatedRequest } from '@/lib/auth-client';

interface Member {
  user: { id: string; fullName: string; player: { playerCode: string; identity: { inGameName: string } | null } | null };
}
interface Preview {
  entry: { id: string; name: string | null; groupName: string | null };
  outgoing: { id: string; name: string; playerCode: string | null };
  replacement: { id: string; name: string; playerCode: string };
  fixtureCount: number;
  confirmedMatchCount: number;
}

export function ReplaceTournamentPlayer({ tournamentId, entry, onReplaced }: {
  tournamentId: string;
  entry: { id: string; entryName: string | null; members: Member[] };
  onReplaced: (message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [outgoingUserId, setOutgoingUserId] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [reason, setReason] = useState('Player unavailable');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const [committed, setCommitted] = useState('');
  const basePath = `/tournaments/${tournamentId}/entries/${entry.id}`;

  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (committed) {
        await onReplaced(committed);
        setOpen(false);
      } else if (!preview) {
        const response = await authenticatedRequest<{ data: Preview }>(`${basePath}/replacement-preview`, {
          method: 'POST', body: JSON.stringify({ outgoingUserId, replacementPlayerCode: playerCode.trim() }),
        });
        setPreview(response.data);
      } else {
        const response = await authenticatedRequest<{ data: { message: string } }>(`${basePath}/replace-player`, {
          method: 'POST', body: JSON.stringify({ outgoingUserId: preview.outgoing.id, replacementPlayerCode: preview.replacement.playerCode, reason: reason.trim() }),
        });
        setCommitted(response.data.message);
        await onReplaced(response.data.message);
        setOpen(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to replace this player.');
      // A failed or ambiguous write must be rechecked before another attempt.
      setPreview(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="theme-secondary-button mt-4 min-h-11 w-full rounded-xl border px-3 text-sm font-semibold"
      onClick={() => { setOutgoingUserId(entry.members[0]?.user.id ?? ''); setPlayerCode(''); setReason('Player unavailable'); setPreview(null); setError(''); setCommitted(''); setOpen(true); }}>
      Replace player
    </button>
    <FcDialog open={open} title="Replace tournament player" description={`Replace a player in ${entry.entryName || 'this entry'} while keeping the same group, fixtures, scores and team points.`}
      busy={busy} confirmLabel={committed ? 'Refresh teams' : preview ? 'Confirm replacement' : 'Preview replacement'}
      confirmDisabled={!committed && !preview && (!outgoingUserId || !playerCode.trim())}
      onConfirm={() => void submit()} onCancel={() => setOpen(false)} className="w-[calc(100%-2rem)] max-w-lg">
      <div className="mt-5 space-y-4">
        {committed ? <p role="status" className="theme-secondary-text text-sm">Replacement saved. Refresh the team list to see the new player.</p> : preview ? <>
          <div className="theme-panel space-y-2 rounded-xl border p-4 text-sm" aria-label="Replacement preview">
            <p><span className="theme-muted">Replacing:</span> <strong>{preview.outgoing.name}</strong> · {preview.outgoing.playerCode}</p>
            <p><span className="theme-muted">With:</span> <strong>{preview.replacement.name}</strong> · {preview.replacement.playerCode}</p>
            <p>{preview.entry.groupName || 'Same tournament entry'} · {preview.fixtureCount} fixtures kept · {preview.confirmedMatchCount} confirmed results kept</p>
          </div>
          <p className="theme-secondary-text text-sm leading-6">The new player takes this slot for upcoming matches. Completed match statistics stay with the players who played them.</p>
          <label className="grid gap-2 text-sm font-semibold">Reason (optional)
            <input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={busy} className="theme-input min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm" />
          </label>
          <button type="button" disabled={busy} onClick={() => setPreview(null)} className="theme-secondary-button min-h-11 rounded-xl border px-3 text-sm">Change player</button>
        </> : <>
          <label className="grid gap-2 text-sm font-semibold">Player to replace
            <select data-initial-focus value={outgoingUserId} onChange={event => setOutgoingUserId(event.target.value)} disabled={busy} className="theme-input min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm">
              {entry.members.map(({ user }) => <option key={user.id} value={user.id}>{user.player?.identity?.inGameName || user.fullName} · {user.player?.playerCode || 'Player'}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Replacement FC ARENA Player ID
            <input value={playerCode} onChange={event => setPlayerCode(event.target.value)} maxLength={64} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busy} placeholder="FCA-P-000001" className="theme-input min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm" />
          </label>
          <p className="theme-secondary-text text-sm leading-6">Use a player who has joined this league and has no other entry in this tournament. Preview their name before confirming.</p>
        </>}
        {error ? <p role="alert" className="theme-tone-error rounded-xl border p-3 text-sm">{error}</p> : null}
      </div>
    </FcDialog>
  </>;
}
