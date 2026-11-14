'use client';

import { useEffect, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { FootballTeamPicker } from '@/components/tournaments/football-team-picker';
import { ApiError } from '@/lib/api';
import { authenticatedRequest } from '@/lib/auth-client';
import { DrawReveal } from './draw-reveal';
import { ImportDuoPairs } from './import-duo-pairs';
import { LivePlayerWheel } from './live-player-wheel';
import { entryName, readStored, storeLocally, type DrawCommand, type Outcome, type Player, type Studio } from './studio-model';
import styles from '../cup.module.css';

type Tool = 'MANUAL' | 'PLAYER' | 'CLUB' | 'GROUP' | 'IMPORT';
type Pending = DrawCommand & { requestId: string; live?: true };
type Form = { tool: Tool; players: string[]; pool: string[]; poolLocked: boolean; name: string; captain: string; entryId: string; reason: string; clubs: string; groups: number | '' };
const initial: Form = { tool: 'PLAYER', players: [], pool: [], poolLocked: false, name: '', captain: '', entryId: '', reason: '', clubs: '', groups: '' };
const tools: [Tool, string][] = [['IMPORT', 'Import pairs'], ['PLAYER', 'Player wheel'], ['CLUB', 'Club wheel'], ['GROUP', 'Group draw'], ['MANUAL', 'Manual']];

export function DrawStudio({ studio, endpoint, storageKey, reload }: { studio: Studio; endpoint: string; storageKey: string; reload: () => Promise<Studio> }) {
  const [form, setForm] = useState(() => ({ ...initial, ...readStored<Partial<Form>>(storageKey + ':form') }));
  const [pending, setPending] = useState(() => readStored<Pending>(storageKey));
  const [result, setResult] = useState<{ id: string; outcome: Outcome; audio?: AudioContext; live?: true }>();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
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
  const matchesSearch = (player: Player) => [player.name, player.fullName, player.playerCode || '']
    .some(value => value.toLocaleLowerCase().includes(search));
  const matching = players.filter(matchesSearch);
  const remainingEntries = Math.max(0, tournament.maxEntries - entries.length);
  const poolLimit = remainingEntries * tournament.teamSize;
  const selectedPool = new Set(form.pool);
  const remainingPool = availablePlayers.filter(player => selectedPool.has(player.id));
  const poolIds = remainingPool.map(player => player.id);
  const matchingPool = availablePlayers.filter(matchesSearch);
  const canRandomize = form.poolLocked && poolIds.length >= tournament.teamSize && poolIds.length <= poolLimit;
  const canStartLive = canRandomize && poolIds.length % tournament.teamSize === 0;
  const canConfirmPool = poolIds.length >= tournament.teamSize && poolIds.length <= poolLimit &&
    poolIds.length % tournament.teamSize === 0;
  const clubKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const usedClubKeys = new Set(entries.flatMap(entry => entry.name ? [clubKey(entry.name)] : []));
  const clubs = [...new Map(form.clubs.split('\n').map(club => club.trim()).filter(Boolean).map(club => [clubKey(club), club])).values()];
  const availableClubs = clubs.filter(club => !usedClubKeys.has(clubKey(club)));
  const completedTeams = approved.filter(entry => entry.valid);
  const unnamedTeams = completedTeams.filter(entry => !entry.name);
  const clubTarget = completedTeams.find(entry => entry.id === form.entryId) ?? unnamedTeams[0];
  const drawBusy = working || revealing || Boolean(pending) || refreshRequired;
  const chooseGroup = tournament.groups.length || (approved.length === 42 ? 7 : 2);
  const activeGroupDraw = approved.some(entry => entry.groupId);
  const latest = studio.history[0]?.outcome;
  const savedClubEntry = latest?.kind === 'CLUB'
    ? entries.find(entry => entry.id === latest.entryId)
    : undefined;

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
  async function run(command?: DrawCommand & { live?: true }) {
    if (lock.current) return false;
    const intent = pending ?? (command ? { ...command, requestId: crypto.randomUUID() } : null);
    if (!intent) return false;
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
      const { live, ...body } = intent;
      const response = await authenticatedRequest<{ data: Outcome }>(endpoint + '/studio/draw', { method: 'POST', body: JSON.stringify(body) });
      storeLocally(storageKey, null);
      setPending(null);
      const outcome = response.data;
      const assignedIds = new Set('entries' in outcome ? outcome.entries.flatMap(entry => entry.members.map(player => player.id)) : []);
      setRevealing(Boolean(live) || outcome.kind === 'PLAYER' || outcome.kind === 'CLUB' || outcome.kind === 'GROUP');
      setResult({ id: intent.requestId, outcome, audio: context, live });
      setForm(current => ({
        ...current, pool: current.pool.filter(id => !assignedIds.has(id)),
        players: [], captain: '', name: '', entryId: '', reason: '',
      }));
      try { await reload(); } catch {
        setRefreshRequired(true);
        setError('The result was saved. Refresh the roster before starting another draw.');
      }
      if (outcome.kind === 'IMPORT') storeLocally(storageKey + ':import', null);
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status) && cause.code !== 'CONCURRENT_UPDATE') {
        setPending(null);
        storeLocally(storageKey, null);
      }
      setError(cause instanceof Error ? cause.message : 'Unable to complete the draw.');
      if (cause instanceof ApiError && cause.status === 409 && cause.code !== 'CONCURRENT_UPDATE') {
        try { await reload(); } catch { setRefreshRequired(true); }
      }
      return false;
    } finally { setWorking(false); lock.current = false; }
  }

  function updatePool(ids: string[]) { update({ pool: ids }); }

  const currentResult = result && ((result.live && result.outcome.kind === 'AUTO') || result.outcome.kind === 'PLAYER'
    ? <LivePlayerWheel key={result.id} entries={result.outcome.entries} players={result.outcome.options} duo={tournament.mode === 'DUO'}
        audio={sound ? result.audio : undefined} onComplete={() => setRevealing(false)} />
    : <DrawReveal key={result.id} outcome={result.outcome} entries={entries}
        audio={sound ? result.audio : undefined} onComplete={() => setRevealing(false)} />);

  return <div className={styles.formStack}>
    <div className={styles.drawOverview}>
      <p><strong>League: {studio.selectedLeague.name}</strong> · {studio.selectedLeague.memberCount} joined members · {studio.eligiblePlayerCount} eligible for drawing. Only this league&apos;s players can be selected.</p>
      <p><strong>{approved.length}/{tournament.maxEntries}</strong> {tournament.mode === 'DUO' ? 'Duo teams formed' : 'approved entries'} · {availablePlayers.length} eligible players available</p>
      <button className={styles.subButton} type="button" aria-pressed={sound} onClick={() => setSound(value => !value)}>Sound {sound ? 'on' : 'off'}</button>
    </div>
    {studio.unavailableMembers.length > 0 && <details className={styles.formatList}>
      <summary>{studio.unavailableMembers.length} league member(s) unavailable for drawing</summary>
      <p className={styles.muted}>These members belong to {studio.selectedLeague.name} but need to complete their FC ARENA game identity or reactivate their account before they can join the draw.</p>
      <ul className={styles.remainingPlayers}>{studio.unavailableMembers.map(member => <li key={member.id}>{member.name} · {member.playerCode || 'No player code'} · {member.reason}</li>)}</ul>
    </details>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {refreshRequired && <button type="button" className={styles.subButton} onClick={async () => {
      try { await reload(); setRefreshRequired(false); setError(''); }
      catch { setError('Unable to refresh the roster. Try again once you are connected.'); }
    }}>Refresh saved roster</button>}
    {pending && !working && <div className={styles.notice}>
      <p>Recover the pending draw before starting another one.</p>
      <button type="button" className={styles.subButton} onClick={() => void run()}>Recover draw</button>
    </div>}
    {!editable && <p className={styles.notice}>Draws are locked after fixture preview or publication. The roster and saved outcomes are available below.</p>}
    {editable && <fieldset disabled={drawBusy} className={styles.formStack}>
      {tournament.mode === 'DUO' && form.tool !== 'IMPORT' && entries.length === 0 &&
        <p className={styles.muted}>Already have your teams? Choose Import pairs to keep those pairings.</p>}
      <div className={styles.drawTools} role="group" aria-label="Draw tools">
        {tools.filter(([value]) => (value !== 'GROUP' || tournament.competitionFormat === 'GROUP_STAGE_KNOCKOUT') &&
          (value !== 'IMPORT' || tournament.mode === 'DUO')).map(([value, label]) => (
          <button key={value} type="button" className={styles.subButton} aria-pressed={form.tool === value} onClick={() => selectTool(value)}>{label}</button>
        ))}
      </div>
      {form.tool === 'IMPORT' && tournament.mode === 'DUO' && <ImportDuoPairs studio={studio} storageKey={storageKey + ':import'}
        onImport={pairs => run({ kind: 'IMPORT', pairs })} />}
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
                <span aria-hidden="true"><FcCrest name={player.name} imageUrl={player.avatar} size="sm" /></span><span>{player.name}{player.playerCode ? ` · ${player.playerCode}` : ''}{player.fullName !== player.name ? ` · ${player.fullName}` : ''}</span>
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
      {form.tool === 'PLAYER' && <section className={styles.formStack} aria-label="Player draw">
        {remainingEntries === 0 ? <p className={styles.notice}>All entry places are filled. Open Club wheel to assign club names.</p> : form.poolLocked ? <>
          {!revealing && <p className={styles.poolCount} role="status"><strong>{poolIds.length}</strong> players remain in this pool</p>}
          <p className={styles.muted}>Start once to save all {tournament.mode === 'DUO' ? 'pairs' : 'entries'} in this pool and reveal the players one by one. You can pause the reveal or show all results anytime.</p>
          <div className={styles.inlineActions}>
            <button className={styles.goldButton} disabled={!canStartLive} type="button" onClick={() => void run({ kind: 'AUTO', poolPlayerIds: poolIds, live: true })}><FcIcon name="football" /> Start live draw</button>
            <button className={styles.subButton} type="button" onClick={() => { update({ pool: poolIds, poolLocked: false }); setResult(undefined); }}>Edit player pool</button>
          </div>
          {!canStartLive && <p className={styles.muted}>Edit the pool so it contains complete {tournament.mode === 'DUO' ? 'pairs' : 'entries'}.</p>}
          {canRandomize && <details className={styles.formatList}>
            <summary>Other draw options</summary>
            <div className={styles.inlineActions}>
              <button className={styles.subButton} type="button" onClick={() => void run({ kind: 'PLAYER', poolPlayerIds: poolIds })}>Draw one entry</button>
              <button className={styles.subButton} type="button" onClick={() => void run({ kind: 'AUTO', poolPlayerIds: poolIds })}>Form all selected teams without spinning</button>
            </div>
          </details>}
          {!revealing && remainingPool.length > 0 && <details className={styles.formatList}>
            <summary>Remaining players · {remainingPool.length}</summary>
            <ol className={styles.remainingPlayers}>{remainingPool.map(player => <li key={player.id}>{player.name}</li>)}</ol>
          </details>}
        </> : <>
          <div className={styles.formStack}>
            <h3>Select players from the tournament league</h3>
            <p className={styles.muted}>{remainingEntries} open {tournament.mode === 'DUO' ? 'Duo teams' : 'entries'} × {tournament.teamSize} {tournament.teamSize === 1 ? 'player' : 'players'}. Select up to {poolLimit} eligible players. You can draw a smaller pool in complete teams and add more later.</p>
          </div>
          <label>Find players for the wheel<input type="search" value={query} onChange={event => { setQuery(event.target.value); setVisible(24); }} /></label>
          <fieldset className={styles.formStack}>
            <legend>Selected {poolIds.length} of {poolLimit} players</legend>
            <div className={styles.inlineActions}>
              <button type="button" className={styles.subButton} disabled={poolIds.length >= poolLimit || !matchingPool.some(player => !selectedPool.has(player.id))}
                onClick={() => updatePool([...poolIds, ...matchingPool.filter(player => !selectedPool.has(player.id)).slice(0, poolLimit - poolIds.length).map(player => player.id)])}>
                {search ? 'Select matching players' : 'Select up to ' + poolLimit + ' eligible players'}
              </button>
              {poolIds.length > 0 && <button type="button" className={styles.subButton} onClick={() => updatePool([])}>Clear selection</button>}
            </div>
            <ul className={styles.playerList}>{matchingPool.slice(0, visible).map(player => <PoolPlayer key={player.id} player={player}
              selected={selectedPool.has(player.id)} full={poolIds.length >= poolLimit} onToggle={() => updatePool(selectedPool.has(player.id) ? poolIds.filter(id => id !== player.id) : [...poolIds, player.id])} />)}</ul>
            {!matchingPool.length && <p className={styles.muted}>No eligible players found.</p>}
            {matchingPool.length > visible && <button type="button" className={styles.subButton} onClick={() => setVisible(count => count + 24)}>Show more players</button>}
          </fieldset>
          <p className={styles.muted}>{poolIds.length} selected · {Math.floor(poolIds.length / tournament.teamSize)} complete {tournament.mode === "DUO" ? "Duo teams" : "entries"}</p>
          <button className={styles.goldButton} type="button" disabled={!canConfirmPool} onClick={() => update({ pool: poolIds, poolLocked: true })}>Confirm {poolIds.length} selected players</button>
          {poolIds.length > 0 && !canConfirmPool && <p className={styles.muted}>Choose players in sets of {tournament.teamSize} to form complete entries.</p>}
        </>}
      </section>}
      {form.tool === 'CLUB' && <form className={styles.formStack} onSubmit={event => {
        event.preventDefault();
        if (clubTarget) void run({ kind: 'CLUB', entryId: clubTarget.id, clubs: availableClubs, reason: form.reason });
      }}>
        <p className={styles.muted}>Assign one unique club to each completed team. The next unassigned team is selected automatically.</p>
        <label>Team receiving the club<select required value={clubTarget?.id ?? ''} onChange={event => update({ entryId: event.target.value, reason: '' })}>
          <option value="">Select a completed team</option>{completedTeams.map(entry => <option key={entry.id} value={entry.id}>{entry.members.map(player => player.name).join(' + ')}{entry.name ? ' · ' + entry.name : ''}</option>)}
        </select></label>
        <label>Club names, one per line<textarea required rows={5} maxLength={15600} value={form.clubs} onChange={event => update({ clubs: event.target.value })} placeholder="Add the clubs you want on the wheel" /></label>
        {clubs.length > 0 && <p className={styles.muted}>{availableClubs.length} clubs available · {unnamedTeams.length} teams still need a club</p>}
        {clubTarget?.name && <label>Override reason<input required minLength={3} maxLength={300} value={form.reason} onChange={event => update({ reason: event.target.value })} /></label>}
        {completedTeams.length === 0 && <p className={styles.notice}>Form a complete team in Player wheel or Manual first.</p>}
        {clubs.length > 128 && <p role="alert" className={styles.error}>Enter up to 128 unique club names.</p>}
        <button className={styles.goldButton} type="submit" disabled={!clubTarget || !availableClubs.length || clubs.length > 128 || availableClubs.some(club => club.length > 120)}>Spin club wheel</button>
        {availableClubs.some(club => club.length > 120) && <p role="alert" className={styles.error}>Keep each club name within 120 characters.</p>}
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
    {currentResult || (latest && !pending && (
      <details className={styles.formatList}><summary>Last saved draw</summary><div className={styles.savedResult}>
        {latest.kind === 'CLUB' ? <p>{latest.winner}{savedClubEntry && ' → ' + savedClubEntry.members.map(player => player.name).join(' + ')}</p> : latest.kind === 'GROUP' ?
          <div className={styles.groupGrid}>{latest.groups.map(group => <div key={group.id}>
            <h4>{group.name}</h4>
            <ul>{group.entryIds.map(id => {
              const entry = entries.find(item => item.id === id);
              return <li key={id}>{entry ? entryName(entry) : 'Former entry'}</li>;
            })}</ul>
          </div>)}</div> :
          <>
            {latest.kind === 'AUTO' && latest.entries.length > 0 && <button className={styles.subButton} type="button"
              onClick={() => { setRevealing(true); setResult({ id: 'saved-player-draw', outcome: latest, live: true }); }}>Replay saved player draw</button>}
            <ul>{latest.entries.map(entry => <li key={entry.id}>{entryName(entry)}</li>)}</ul>
          </>}
      </div></details>
    ))}
    {!revealing && <Roster entries={entries} groups={tournament.groups} duo={tournament.mode === 'DUO'} expanded={editable} />}
  </div>;
}

function PoolPlayer({ player, selected, full, onToggle }: { player: Player; selected: boolean; full: boolean; onToggle: () => void }) {
  return <li><label>
    <input type="checkbox" checked={selected} disabled={!selected && full} onChange={onToggle} />
    <span aria-hidden="true"><FcCrest name={player.name} imageUrl={player.avatar} size="sm" /></span>
    <span>{player.name}</span>
  </label></li>;
}

export function Roster({ entries, groups, duo, expanded = false }: {
  entries: Studio['entries']; groups: Studio['tournament']['groups']; duo: boolean; expanded?: boolean;
}) {
  const groupNames = new Map(groups.map(group => [group.id, group.name]));
  return <details className={styles.formatList} open={expanded || entries.length > 0 && entries.length <= 8 ? true : undefined}>
    <summary>{duo ? 'Pairing board' : 'Entry roster'} · {entries.length}</summary>
    {!entries.length ? <p className={styles.muted}>No entries have been added yet.</p> : (
      <ul className={styles.roster}>{entries.map((entry, index) => <li key={entry.id}>
        <FcCrest imageUrl={entry.logo} name={entryName(entry)} size="sm" />
        <div><strong>{duo ? `Duo ${index + 1}${entry.name ? ' · ' + entry.name : ''}` : entryName(entry)}</strong>
          <p>{entry.members.map(member => member.name + (member.id === entry.captainId && entry.members.length > 1 ? ' (captain)' : '')).join(' · ')}</p>
          {entry.groupId && groupNames.has(entry.groupId) && <p>{groupNames.get(entry.groupId)}</p>}
          {entry.status === 'PENDING' && <span>Awaiting approval</span>}{!entry.valid && <span> · Check eligibility and squad</span>}
        </div>
      </li>)}</ul>
    )}
  </details>;
}
