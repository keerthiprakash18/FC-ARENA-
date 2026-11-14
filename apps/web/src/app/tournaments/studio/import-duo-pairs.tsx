'use client';

import { useState } from 'react';
import { normalizeTeamName } from '@/lib/entry-name';
import { readStored, storeLocally, type DuoPair, type Studio } from './studio-model';
import styles from '../cup.module.css';

export function ImportDuoPairs({ studio, storageKey, onImport }: {
  studio: Studio; storageKey: string; onImport: (pairs: DuoPair[]) => Promise<boolean>;
}) {
  const [input, setInput] = useState(() => readStored<string>(storageKey) ?? '');
  const [preview, setPreview] = useState(false);
  const rows = input.split(/\r?\n/).flatMap((text, index) => text.trim() ? [{ text, line: index + 1 }] : []);
  const available = Math.max(0, studio.tournament.maxEntries - studio.entries.length);
  const teams = new Set(studio.entries.flatMap(entry => entry.name ? [normalizeTeamName(entry.name)] : []));
  const players = new Map<string, Map<string, Studio['availablePlayers'][number]>>();
  const availableIds = new Set(studio.availablePlayers.map(player => player.id));
  for (const player of [...studio.availablePlayers, ...studio.entries.flatMap(entry => entry.members),
    ...studio.unavailableMembers.map(player => ({ ...player, fullName: '', avatar: null }))]) {
    for (const key of [player.name, player.fullName, player.playerCode]) {
      if (!key?.trim() || key === 'Ineligible player') continue;
      const normalized = normalizeTeamName(key);
      const matches = players.get(normalized) ?? new Map();
      matches.set(player.id, player);
      players.set(normalized, matches);
    }
  }
  const used = new Set<string>();
  const checked = preview ? rows.map(({ text, line }) => {
    const fail = (message: string) => ({ line, text, message, pair: null });
    const fields = text.split(text.includes('|') ? '|' : '\t').map(field => field.trim());
    if (fields.length !== 2 && fields.length !== 3) return fail('Use Player 1 | Player 2 or Team | Player 1 | Player 2.');
    const [first, second] = fields.slice(-2);
    const name = fields.length === 3 ? fields[0] : '';
    if (name.length > 120) return fail('Keep the team name within 120 characters.');
    const resolved = [];
    for (const value of [first, second]) {
      const matches = players.get(normalizeTeamName(value));
      if (!matches?.size) return fail(value ? 'Unavailable in this league: ' + value : 'Enter both players.');
      if (matches.size > 1) return fail('Use a Player ID for the shared name ' + value + '.');
      const player = [...matches.values()][0];
      if (!availableIds.has(player.id)) return fail('Already assigned or ineligible: ' + value);
      resolved.push(player);
    }
    const [one, two] = resolved;
    if (one.id === two.id || used.has(one.id) || used.has(two.id)) return fail('A player appears more than once.');
    if (name && teams.has(normalizeTeamName(name))) return fail('This team name is already used.');
    if (name) teams.add(normalizeTeamName(name));
    used.add(one.id);
    used.add(two.id);
    return { line, text: [name, one.name, two.name].filter(Boolean).join(' · '), message: '', pair: { name: name || undefined, playerIds: [one.id, two.id] } };
  }) : [];
  const pairs = checked.flatMap(row => row.pair ? [row.pair] : []);
  const valid = rows.length > 0 && rows.length <= available && pairs.length === rows.length;

  return <section className={styles.formStack} aria-label="Import Duo teams">
    <div>
      <h3>Import existing Duo teams</h3>
      <p className={styles.muted}>Paste one team per line. Match players from {studio.selectedLeague.name} by in-game name or FC ARENA Player ID. Team names are optional. Player 1 is the captain.</p>
    </div>
    <label>Team list
      <textarea rows={6} maxLength={50000} value={input} placeholder={'Team or club | Player 1 | Player 2\nLiverpool | FCA-P-000001 | FCA-P-000002'}
        onChange={event => { setInput(event.target.value); storeLocally(storageKey, event.target.value); setPreview(false); }} />
    </label>
    <div className={styles.inlineActions}>
      <button type="button" className={styles.subButton} disabled={!rows.length || !available} onClick={() => setPreview(true)}>Preview team list</button>
      {preview && <button type="button" className={styles.goldButton} disabled={!valid} onClick={async () => {
        if (await onImport(pairs)) { setInput(''); setPreview(false); storeLocally(storageKey, null); }
      }}>Add {pairs.length} Duo {pairs.length === 1 ? 'team' : 'teams'}</button>}
    </div>
    {rows.length > available && <p className={styles.error} role="alert">{available} team places are available. Remove extra lines before importing.</p>}
    {preview && <>
      <p role="status">{pairs.length} of {rows.length} teams ready</p>
      <ul className={styles.roster}>
        {checked.map(row => <li key={row.line}><div><strong>{row.line}. {row.text}</strong>{row.message && <p className={styles.error}>{row.message}</p>}</div></li>)}
      </ul>
    </>}
  </section>;
}
