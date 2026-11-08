'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { footballTeamOptions, type FootballCatalog, type FootballTeamKind } from '@/lib/football-catalog';
import { useTeamChoices } from '@/lib/use-team-choices';
import { chosenTeamNames } from '@/lib/chosen-team-names';
import { normalizeTeamName } from '@/lib/entry-name';

let catalogue: Promise<FootballCatalog> | null = null;
function loadCatalog() {
  if (!catalogue) catalogue = import('@/data/football-teams.json').then(module => module.default).catch(error => { catalogue = null; throw error; });
  return catalogue;
}

interface Props {
  tournamentId: string;
  excludeEntryId?: string;
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

/** Keeps the ordinary name field and existing registration payload compatible. */
export function FootballTeamPicker({ tournamentId, excludeEntryId, id, name = 'entryName', label = 'Team Name', value, defaultValue = '', onChange, required = true, disabled = false }: Props) {
  const generated = useId(), inputId = id ?? `football-team-${generated}`, panelId = `${inputId}-choices`;
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<FootballCatalog | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<FootballTeamKind>('CLUB');
  const [league, setLeague] = useState('eng.1');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);
  const [draft, setDraft] = useState(defaultValue);
  const choices = useTeamChoices(tournamentId, open);
  const chosen = useMemo(() => chosenTeamNames(choices.entries, excludeEntryId), [choices.entries, excludeEntryId]);
  const duplicate = chosen.has(normalizeTeamName(value ?? draft));
  useEffect(() => { input.current?.setCustomValidity(duplicate ? 'This team is already chosen in this tournament. Choose another team.' : ''); }, [duplicate]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setDraft(defaultValue);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open || catalog) return;
    let active = true;
    void loadCatalog().then(data => { if (active) { setCatalog(data); setError(''); } })
      .catch(() => { if (active) setError('Team choices could not load. You can still enter your team name.'); });
    return () => { active = false; };
  }, [open, catalog, attempt]);

  const results = catalog ? footballTeamOptions(catalog, kind, league, query) : [];
  function select(name: string) {
    if (disabled || !choices.ready || chosen.has(normalizeTeamName(name))) return;
    if (value === undefined && input.current) input.current.value = name;
    setDraft(name);
    onChange?.(name);
    setOpen(false);
    input.current?.focus();
  }

  return <div className="min-w-0 space-y-3" data-no-pull-refresh>
    <label htmlFor={inputId} className="block text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
    <input ref={input} id={inputId} name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined}
      onChange={event => { setDraft(event.target.value); onChange?.(event.target.value); }} required={required} disabled={disabled} maxLength={120}
      aria-invalid={duplicate || undefined} aria-describedby={duplicate ? `${inputId}-taken` : undefined}
      placeholder="Choose a club, country or enter your own team name"
      className="w-full min-w-0 rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/50 disabled:opacity-50" />
    {duplicate ? <p id={`${inputId}-taken`} role="alert" className="text-sm text-amber-300">Already chosen in this tournament. Choose another team.</p> : null}
    <button type="button" disabled={disabled} aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(current => !current)} className="min-h-11 rounded-xl border border-sky-400/30 px-4 py-2 text-sm font-semibold text-sky-300 disabled:opacity-50">
      {open ? 'Close team choices' : 'Choose football team'}
    </button>
    {open ? <fieldset id={panelId} disabled={disabled} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); input.current?.focus(); } }} className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-black/10 p-4">
      <legend className="px-1 text-sm font-bold">Football team choices</legend>
      <div className="flex flex-wrap gap-2">
        {(['CLUB', 'NATIONAL'] as const).map(type => <button type="button" key={type} aria-pressed={kind === type}
          onClick={() => { setKind(type); setQuery(''); setLimit(40); }}
          className={`min-h-11 rounded-lg border px-4 py-2 text-sm ${kind === type ? 'border-sky-400/50 bg-sky-400/10 text-sky-300' : 'border-white/10 text-slate-400'}`}>
          {type === 'CLUB' ? 'Clubs' : 'National teams'}
        </button>)}
      </div>
      {!catalog && !error ? <p role="status" className="text-sm text-slate-400">Loading team choices…</p> : null}
      {error ? <div role="alert" className="space-y-2 text-sm text-amber-300"><p>{error}</p><button type="button" onClick={() => { setError(''); setAttempt(current => current + 1); }} className="min-h-11 underline">Retry team choices</button></div> : null}
      {choices.error ? <div role="alert" className="text-sm text-amber-300"><p>{choices.error}</p><button type="button" onClick={() => void choices.refresh()} className="min-h-11 underline">Retry chosen teams</button></div> : !choices.ready ? <p role="status" className="text-sm text-slate-400">Checking chosen teams…</p> : null}
      {catalog ? <>
        <p className="text-xs text-slate-400">{catalog.leagues.length} leagues · {catalog.nationalTeams.length} national teams. You can also use a custom team name.</p>
        {kind === 'CLUB' ? <label className="grid gap-2 text-sm">Football league
          <select value={league} onChange={event => { setLeague(event.target.value); setQuery(''); setLimit(40); }} className="min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-[var(--theme-panel,#102033)] px-3 py-2">
            <option value="">All leagues</option>
            {catalog.leagues.map(item => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}
          </select>
        </label> : null}
        <label className="grid gap-2 text-sm">{kind === 'CLUB' ? 'Search clubs' : 'Search countries'}
          <input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} maxLength={80}
            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
            className="min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2" />
        </label>
        <p role="status" className="text-xs text-slate-400">{results.length} {kind === 'CLUB' ? 'clubs' : 'national teams'} found</p>
        <ul aria-label="Football team results" className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {results.slice(0, limit).map(team => <li key={team.id} className="min-w-0"><button type="button" onClick={() => select(team.name)} disabled={!choices.ready || chosen.has(normalizeTeamName(team.name))}
            className="h-full min-h-11 w-full break-words rounded-lg border border-white/10 p-3 text-left hover:border-sky-400/50 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
            <span className="block text-sm font-semibold">{team.name}</span><span className="mt-1 block text-xs text-slate-500">{team.group}</span>
            {chosen.has(normalizeTeamName(team.name)) ? <span className="mt-2 block text-xs font-bold text-amber-300">Already chosen</span> : null}
          </button></li>)}
        </ul>
        {!results.length ? <p className="text-sm text-slate-400">No teams match this search. Try another league or enter a custom name above.</p> : null}
        {results.length > limit ? <button type="button" onClick={() => setLimit(current => current + 40)} className="min-h-11 text-sm text-sky-300 underline">Show more teams</button> : null}
      </> : null}
    </fieldset> : null}
  </div>;
}
