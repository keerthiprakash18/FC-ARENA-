'use client';

import { useEffect, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { FootballTeamPicker } from '@/components/tournaments/football-team-picker';
import { ApiError } from '@/lib/api';
import { authenticatedRequest } from '@/lib/auth-client';
import { DrawReveal } from './draw-reveal';
import { entryName, readStored, storeLocally, type DrawCommand, type Outcome, type Studio } from './studio-model';
import styles from '../cup.module.css';

type Tool = 'MANUAL' | 'PLAYER' | 'CLUB' | 'GROUP';
type Pending = DrawCommand & { requestId: string };
type Form = { tool: Tool; players: string[]; name: string; captain: string; entryId: string; reason: string; clubs: string; groups: number | '' };
const initial: Form = { tool: 'MANUAL', players: [], name: '', captain: '', entryId: '', reason: '', clubs: '', groups: '' };
const tools: [Tool, string][] = [['MANUAL', 'Manual'], ['PLAYER', 'Player wheel'], ['CLUB', 'Club wheel'], ['GROUP', 'Group draw']];

export function DrawStudio({ studio, endpoint, storageKey, reload }: { studio: Studio; endpoint: string; storageKey: string; reload: () => Promise<Studio> }) {
  const [form, setForm] = useState(() => readStored<Form>(storageKey + ':form') ?? initial);
  const [pending, setPending] = useState(() => readStored<Pending>(storageKey));
  const [result, setResult] = useState<{ id: string; outcome: Outcome; audio?: AudioContext }>();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [sound, setSound] = useState(false);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(24);
  const lock = useRef(false);
  const audio = useRef<AudioContext | undefined>(undefined);
  const { tournament, entries, availablePlayers, editable } = studio;
  const approved = entries.filter(entry => entry.status === 'APPROVED');
  const editing = approved.find(entry => entry.id === form.entryId);
  const players = [...availablePlayers, ...(editing?.members.filter(member => member.name !== 'Ineligible player') ?? [])];
  const search = query.trim().toLocaleLowerCase();
  const matching = players.filter(player => player.name.toLocaleLowerCase().includes(search));
  const clubs = form.clubs.split('\n').map(club => club.trim()).filter(Boolean);
  const canRandomize = editable && entries.length < tournament.maxEntries && availablePlayers.length >= tournament.teamSize;
  const chooseGroup = tournament.groups.length || (approved.length === 42 ? 7 : 2);
  const activeGroupDraw = approved.some(entry => entry.groupId);
  const latest = studio.history[0];

  useEffect(() => { storeLocally(storageKey + ':form', form); }, [form, storageKey]);
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);

  function update(patch: Partial<Form>) { setForm(current => ({ ...current, ...patch })); }
  function selectTool(tool: Tool) {
    setError('');
    setResult(undefined);
    setQuery('');
    setVisible(24);
    setForm(current => ({ ...current, tool, entryId: '', reason: '' }));
  }
  async function run(command?: DrawCommand) {
    if (lock.current) return;
    const intent = pending ?? (command ? { ...command, requestId: crypto.randomUUID() } : null);
    if (!intent) return;
    lock.current = true;
    setWorking(true);
    setError('');
    setResult(undefined);
    let context: AudioContext | undefined;
    if (sound && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof AudioContext !== 'undefined') {
      try {
        context = audio.current ??= new AudioContext();
        void context.resume().catch(() => {});
      } catch { context = undefined; }
    }
    storeLocally(storageKey, intent);
    setPending(intent);
    try {
      const response = await authenticatedRequest<{ data: Outcome }>(endpoint + '/studio/draw', { method: 'POST', body: JSON.stringify(intent) });
      storeLocally(storageKey, null);
      setPending(null);
      setResult({ id: intent.requestId, outcome: response.data, audio: context });
      update({ players: [], captain: '', name: '', entryId: '', reason: '' });
      try { await reload(); } catch { setError('The result was saved. Reopen the draft to refresh the roster.'); }
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status) && cause.code !== 'CONCURRENT_UPDATE') {
        setPending(null);
        storeLocally(storageKey, null);
      }
      setError(cause instanceof Error ? cause.message : 'Unable to complete the draw.');
    } finally { setWorking(false); lock.current = false; }
  }

  return <div className={styles.formStack}>
    <div className={styles.drawOverview}>
      <p><strong>{approved.length}/{tournament.maxEntries}</strong> approved entries · {availablePlayers.length} available players</p>
      <button className={styles.subButton} type="button" aria-pressed={sound} onClick={() => setSound(value => !value)}>Sound {sound ? 'on' : 'off'}</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {pending && !working && <div className={styles.notice}>
      <p>Recover the pending draw before starting another one.</p>
      <button type="button" className={styles.subButton} onClick={() => void run()}>Recover draw</button>
    </div>}
    {!editable && <p className={styles.notice}>Draws are locked after fixture preview or publication. The roster and saved outcomes are available below.</p>}
    {editable && <fieldset disabled={working || Boolean(pending)} className={styles.formStack}>
      <div className={styles.drawTools} role="group" aria-label="Draw tools">
        {tools.filter(([value]) => value !== 'GROUP' || tournament.competitionFormat === 'GROUP_STAGE_KNOCKOUT').map(([value, label]) => (
          <button key={value} type="button" className={styles.subButton} aria-pressed={form.tool === value} onClick={() => selectTool(value)}>{label}</button>
        ))}
      </div>
      {form.tool === 'MANUAL' && <form className={styles.formStack} onSubmit={event => {
        event.preventDefault();
        void run({ kind: 'MANUAL', playerIds: form.players, captainId: form.captain || form.players[0], name: form.name, entryId: editing?.id, reason: form.reason });
      }}>
        <label>Entry
          <select value={editing?.id ?? ''} onChange={event => {
            const entry = approved.find(item => item.id === event.target.value);
            update({ entryId: event.target.value, players: entry?.members.filter(member => member.name !== 'Ineligible player').map(member => member.id) ?? [],
              name: entry?.name || '', captain: entry?.captainId || '', reason: '' });
          }}><option value="">Add new entry</option>{approved.map(entry => <option key={entry.id} value={entry.id}>{entryName(entry)}</option>)}</select>
        </label>
        <FootballTeamPicker tournamentId={tournament.id} excludeEntryId={editing?.id} label="Club or team name (optional)" required={false} value={form.name} onChange={name => update({ name })} />
        <label>Find eligible players<input type="search" value={query} onChange={event => { setQuery(event.target.value); setVisible(24); }} /></label>
        <fieldset>
          <legend>Selected {form.players.length} of {tournament.teamSize}</legend>
          <ul className={styles.playerList}>
            {matching.slice(0, visible).map(player => {
              const selected = form.players.includes(player.id);
              return <li key={player.id}><label>
                <input type="checkbox" checked={selected} disabled={!selected && form.players.length >= tournament.teamSize} onChange={() => {
                  const next = selected ? form.players.filter(id => id !== player.id) : [...form.players, player.id];
                  update({ players: next, captain: next.includes(form.captain) ? form.captain : next[0] || '' });
                }} />
                <span aria-hidden="true"><FcCrest name={player.name} imageUrl={player.avatar} size="sm" /></span><span>{player.name}</span>
              </label></li>;
            })}
          </ul>
          {!matching.length && <p className={styles.muted}>No eligible players found.</p>}
          {matching.length > visible && <button type="button" className={styles.subButton} onClick={() => setVisible(count => count + 24)}>Show more players</button>}
        </fieldset>
        {tournament.teamSize > 1 && form.players.length > 0 && <label>Captain
          <select aria-label="Captain" value={form.captain} onChange={event => update({ captain: event.target.value })}>
            {players.filter(player => form.players.includes(player.id)).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
        </label>}
        {editing && <label>Override reason<input required minLength={3} maxLength={300} value={form.reason} onChange={event => update({ reason: event.target.value })} /></label>}
        <button type="submit" className={styles.goldButton} disabled={form.players.length !== tournament.teamSize || (!editing && entries.length >= tournament.maxEntries)}>
          {editing ? 'Save override' : 'Add entry'}
        </button>
      </form>}
      {form.tool === 'PLAYER' && <>
        <p className={styles.muted}>{tournament.mode === 'DUO' ? 'Every spin forms one complete pair. Any leftover player stays available.' : 'Every spin fills one entry from the available player pool.'}</p>
        <div className={styles.inlineActions}>
          <button className={styles.goldButton} disabled={!canRandomize} type="button" onClick={() => void run({ kind: 'PLAYER' })}><FcIcon name="football" /> Spin player wheel</button>
          <button className={styles.subButton} disabled={!canRandomize} type="button" onClick={() => void run({ kind: 'AUTO' })}>Fill available entries</button>
        </div>
        {!canRandomize && <p className={styles.muted}>{entries.length >= tournament.maxEntries ? 'All entry places are taken.' : 'There are too few available players for a complete entry.'}</p>}
      </>}
      {form.tool === 'CLUB' && <form className={styles.formStack} onSubmit={event => {
        event.preventDefault(); void run({ kind: 'CLUB', entryId: form.entryId, clubs, reason: form.reason });
      }}>
        <label>Entry receiving the club<select required value={editing?.id ?? ''} onChange={event => update({ entryId: event.target.value })}>
          <option value="">Select an approved entry</option>{approved.map(entry => <option key={entry.id} value={entry.id}>{entryName(entry)}</option>)}
        </select></label>
        <label>Club pool, one name per line <textarea required rows={5} maxLength={15600} value={form.clubs} onChange={event => update({ clubs: event.target.value })} placeholder="Add available clubs or team identities" /></label>
        {editing?.name && <label>Override reason<input required minLength={3} maxLength={300} value={form.reason} onChange={event => update({ reason: event.target.value })} /></label>}
        <button className={styles.goldButton} type="submit" disabled={!editing || !clubs.length || clubs.length > 128}>Spin club wheel</button>
      </form>}
      {form.tool === 'GROUP' && <form className={styles.formStack} onSubmit={event => {
        event.preventDefault(); void run({ kind: 'GROUP', groupCount: Number(form.groups || chooseGroup), reason: form.reason });
      }}>
        <label>Groups<input type="number" required min={2} max={16} value={tournament.groups.length || form.groups || chooseGroup} readOnly={Boolean(tournament.groups.length)}
          onChange={event => update({ groups: event.target.value ? Number(event.target.value) : '' })} /></label>
        <p className={styles.muted}>Each group needs at least two approved entries. Group sizes differ by at most one.</p>
        {activeGroupDraw && <label>Redraw reason<input required minLength={3} maxLength={300} value={form.reason} onChange={event => update({ reason: event.target.value })} /></label>}
        <button className={styles.goldButton} type="submit" disabled={approved.length < 2 * Number(form.groups || chooseGroup)}>Draw groups</button>
      </form>}
    </fieldset>}
    {working && <p className={styles.notice} role="status">Saving draw…</p>}
    {result ? <DrawReveal key={result.id} outcome={result.outcome} entries={entries} audio={sound ? result.audio : undefined} /> : latest && !pending && (
      <details className={styles.formatList}><summary>Last saved draw</summary><div className={styles.savedResult}>
        {latest.outcome.kind === 'CLUB' ? <p>{latest.outcome.winner}</p> : latest.outcome.kind === 'GROUP' ?
          <ul>{latest.outcome.groups.map(group => <li key={group.id}>{group.name} · {group.entryIds.length} entries</li>)}</ul> :
          <ul>{latest.outcome.entries.map(entry => <li key={entry.id}>{entryName(entry)}</li>)}</ul>}
      </div></details>
    )}
    <Roster entries={entries} duo={tournament.mode === 'DUO'} />
  </div>;
}

export function Roster({ entries, duo }: { entries: Studio['entries']; duo: boolean }) {
  return <details className={styles.formatList} open={entries.length > 0 && entries.length <= 8 ? true : undefined}>
    <summary>{duo ? 'Pairing board' : 'Entry roster'} · {entries.length}</summary>
    {!entries.length ? <p className={styles.muted}>No entries have been added yet.</p> : (
      <ul className={styles.roster}>{entries.map(entry => <li key={entry.id}>
        <FcCrest imageUrl={entry.logo} name={entryName(entry)} size="sm" />
        <div><strong>{entryName(entry)}</strong>
          <p>{entry.members.map(member => member.name + (member.id === entry.captainId && entry.members.length > 1 ? ' (captain)' : '')).join(' · ')}</p>
          {entry.status === 'PENDING' && <span>Awaiting approval</span>}{!entry.valid && <span> · Check eligibility and squad</span>}
        </div>
      </li>)}</ul>
    )}
  </details>;
}
