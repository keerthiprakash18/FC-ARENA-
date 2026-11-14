"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { FcIcon } from '@/components/fc/fc-icons';
import { FcErrorState, FcLoadingScreen } from '@/components/fc/fc-ui';
import { ApiError } from '@/lib/api';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { DrawStudio } from './draw-studio';
import { StudioReview } from './studio-review';
import { formats, modes, readStored, storeLocally, teamSize, validation, type Format, type Settings, type Studio } from './studio-model';
import styles from '../cup.module.css';

const steps = ['Basics', 'Participants', 'Draw', 'Review'] as const;
type SavedDraft = { settings: Settings; step: number; id?: string; dirty?: boolean; create?: { requestId: string; body: Settings } };
type Envelope<T> = { data: T };

export default function TournamentStudioPage() {
  const params = useSearchParams();
  const leagueId = params.get('leagueId') || '';
  const draft = params.get('draft') || '';
  const mode = params.get('mode') || '';
  const format = params.get('format') || '';
  const [user, setUser] = useState<CurrentUser>();
  const access = useRecoverableLoad(async signal => setUser(await getCurrentUser({ signal })));
  const content = !leagueId ? <FcErrorState message="Choose a league in Cup Center before opening Tournament Studio." /> :
    access.error ? <FcErrorState message={access.error} onRetry={access.retry} /> :
    !user ? <FcLoadingScreen label="Opening Tournament Studio…" embedded /> :
    <StudioSession key={user.id + ':' + leagueId + ':' + draft + ':' + mode + ':' + format}
      leagueId={leagueId} draftId={draft} userId={user.id} initialMode={mode} initialFormat={format} />;
  return <AppShell currentUser={user}>{content}</AppShell>;
}

function StudioSession({ leagueId, draftId, userId, initialMode, initialFormat }: {
  leagueId: string; draftId: string; userId: string; initialMode: string; initialFormat: string;
}) {
  const router = useRouter();
  const key = ['tournament-studio-v1', userId, leagueId, draftId || (initialMode + ':' + initialFormat)].join(':');
  const [saved, setSaved] = useState<SavedDraft>();
  const [studio, setStudio] = useState<Studio>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const fallback: Settings = {
    name: '', mode: Object.hasOwn(modes, initialMode) ? initialMode as Settings['mode'] : 'SOLO',
    competitionFormat: Object.hasOwn(formats, initialFormat) ? initialFormat as Format : 'LEAGUE_ROUND_ROBIN',
    maxEntries: 16, teamSize: 4, registrationMode: 'ADMIN_ONLY', description: '',
  };
  useEffect(() => {
    const local = readStored<SavedDraft>(key);
    const setup = local ?? { settings: fallback, step: draftId ? 2 : 0, id: draftId || undefined };
    setSaved(setup);
    // This component is keyed by draft identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const id = saved?.id;
  const load = useRecoverableLoad(async signal => {
    if (!id) return;
    const response = await authenticatedRequest<Envelope<Studio>>('/tournaments/' + id + '/studio', { signal });
    if (signal.aborted) return;
    if (response.data.tournament.leagueId !== leagueId) throw new Error('This draft belongs to a different league.');
    setStudio(response.data);
    setSaved(current => current && current.id === id && !current.dirty ? { ...current, settings: {
      name: response.data.tournament.name,
      mode: response.data.tournament.mode,
      competitionFormat: response.data.tournament.competitionFormat,
      maxEntries: response.data.tournament.maxEntries,
      registrationMode: response.data.tournament.registrationMode,
      description: response.data.tournament.description ?? '',
      teamSize: response.data.tournament.mode === 'TEAM' ? response.data.tournament.teamSize : 4,
    } } : current);
  }, id);

  useEffect(() => {
    if (saved && !storeLocally(key, saved)) setStorageAvailable(false);
  }, [key, saved]);

  if (!saved || (id && !studio && !load.error)) return <FcLoadingScreen label="Opening your draft…" embedded />;
  const { settings, step } = saved;
  const cupHref = '/tournaments?leagueId=' + leagueId + '&view=UPCOMING';
  const endpoint = '/tournaments/' + id;
  const existingWizard = endpoint + '/wizard';
  const participantCount = studio?.entries.length ?? 0;
  const editableSetup = !studio || (studio.tournament.status === 'DRAFT' && studio.editable);
  const modeLocked = !editableSetup || participantCount > 0;

  function update(patch: Partial<Settings>) {
    setSaved(current => current && ({ ...current, dirty: true, settings: { ...current.settings, ...patch } }));
  }
  function move(next: number) {
    setError('');
    setSaved(current => current && ({ ...current, step: next }));
    window.requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  async function reload() {
    const response = await authenticatedRequest<Envelope<Studio>>(endpoint + '/studio');
    setStudio(response.data);
    return response.data;
  }

  async function saveSetup() {
    if (!saved || lock.current) return;
    const invalid = validation(saved.settings);
    if (invalid) { setError(invalid); return; }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const body = (data: Settings) => {
        const { teamSize: configuredSize, ...setup } = data;
        return {
          ...setup, name: setup.name.trim(),
          ...(setup.mode === 'TEAM' ? { teamSize: configuredSize } : {}),
          groupMode: setup.competitionFormat === 'GROUP_STAGE_KNOCKOUT' ? 'MULTIPLE_GROUPS' : 'SINGLE_GROUP',
        };
      };
      if (!id) {
        const intent = saved.create ?? { requestId: crypto.randomUUID(), body: saved.settings };
        const pending = { ...saved, create: intent };
        storeLocally(key, pending);
        setSaved(pending);
        const created = await authenticatedRequest<Envelope<{ tournament: { id: string } }>>('/leagues/' + leagueId + '/tournament-studio', {
          method: 'POST', body: JSON.stringify({ ...body(intent.body), requestId: intent.requestId }),
        });
        const createdId = created.data.tournament.id;
        storeLocally(['tournament-studio-v1', userId, leagueId, createdId].join(':'), { settings: intent.body, step: 2, id: createdId });
        storeLocally(key, null);
        router.replace('/tournaments/studio?leagueId=' + leagueId + '&draft=' + createdId);
        return;
      }
      if (editableSetup) {
        await authenticatedRequest(endpoint + '/setup', { method: 'PATCH', body: JSON.stringify(
          modeLocked ? { name: settings.name.trim(), maxEntries: settings.maxEntries, registrationMode: settings.registrationMode, description: settings.description } : body(settings)
        ) });
        await reload();
        setSaved(current => current && ({ ...current, dirty: false }));
      }
      move(2);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400 && !id) setSaved(current => current && ({ ...current, create: undefined }));
      setError(cause instanceof Error ? cause.message : 'Unable to save the draft. Try again.');
    } finally { lock.current = false; setBusy(false); }
  }

  async function openRegistration() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await authenticatedRequest(endpoint + '/open-registration', { method: 'POST' });
      await reload();
      setNotice('Player registration is open.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open registration.');
    } finally { lock.current = false; setBusy(false); }
  }

  let panel: ReactNode;
  if (load.error) panel = <FcErrorState message={load.error} onRetry={load.retry} />;
  else if (step === 0) panel = (
    <form onSubmit={event => { event.preventDefault();
      if (settings.name.trim().length >= 3) move(1);
      else setError('Enter a tournament name with at least three characters.'); }}>
      <fieldset disabled={Boolean(saved.create) || !editableSetup} className={styles.formStack}>
        <label>Tournament name<input value={settings.name} onChange={event => update({ name: event.target.value })} autoComplete="off" maxLength={120} required /></label>
        <fieldset disabled={modeLocked}>
          <legend>Participation mode</legend>
          <div className={styles.modeChoices}>
            {Object.entries(modes).map(([value, mode]) => (
              <label key={value}>
                <input type="radio" name="mode" value={value} checked={settings.mode === value}
                  onChange={() => update({ mode: value as Settings['mode'] })} />
                <FcIcon name={mode.icon} /><strong>{mode.label}</strong><span>{mode.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>Competition format
          <select value={settings.competitionFormat} disabled={modeLocked} onChange={event => update({ competitionFormat: event.target.value as Format })}>
            {Object.entries(formats).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <details><summary>Advanced settings</summary><label>Description<textarea maxLength={3000} value={settings.description} rows={3} onChange={event => update({ description: event.target.value })} /></label></details>
      </fieldset>
      <div className={styles.footerActions}>
        <button type="submit" className={styles.goldButton}>Continue <FcIcon name="chevronRight" /></button>
      </div>
    </form>
  );
  else if (step === 1) panel = (
    <form onSubmit={event => { event.preventDefault(); void saveSetup(); }}>
      <fieldset disabled={Boolean(saved.create) || !editableSetup} className={styles.formStack}>
        <div className={styles.fieldGrid}>
          <label>{settings.mode === 'DUO' ? 'Duo teams' : 'Entry capacity'}<input required type="number" min={2} max={128} value={settings.maxEntries || ''} onChange={event => update({ maxEntries: Number(event.target.value) })} /></label>
          {settings.mode === 'TEAM' && <label>Players per team<input required type="number" min={3} max={11} disabled={modeLocked} value={settings.teamSize || ''} onChange={event => update({ teamSize: Number(event.target.value) })} /></label>}
        </div>
        <p className={styles.muted}>{teamSize(settings)} {teamSize(settings) === 1 ? 'player' : 'players'} per entry. League members need an active account and a saved game identity.</p>
        <label>Registration
          <select value={settings.competitionFormat === 'ELITE_CUP' ? 'ADMIN_ONLY' : settings.registrationMode} disabled={settings.competitionFormat === 'ELITE_CUP'}
            onChange={event => update({ registrationMode: event.target.value as Settings['registrationMode'] })}>
            <option value="ADMIN_ONLY">Admin managed</option><option value="APPROVAL">Player applications, with approval</option><option value="OPEN">Open registration</option>
          </select>
        </label>
      </fieldset>
      {saved.create && <p className={styles.muted}>A previous save is pending. Continue to recover it.</p>}
      {id && <div className={styles.inlineActions}>
        <Link className={styles.subButton} href={endpoint + '/registration'}>Manage registration</Link>
        {studio?.tournament.status === 'DRAFT' && studio.tournament.registrationMode !== 'ADMIN_ONLY' && (
          <button type="button" className={styles.subButton} disabled={busy || !studio.editable} onClick={() => void openRegistration()}>Open saved registration</button>
        )}
      </div>}
      <div className={styles.footerActions}>
        <button type="button" className={styles.subButton} onClick={() => move(0)} disabled={busy}>Back</button>
        <button type="submit" className={styles.goldButton} disabled={busy}>{busy ? 'Saving…' : id ? 'Continue to draw' : 'Create draft'}</button>
      </div>
    </form>
  );
  else if (step === 2 && studio) panel = <>
    <DrawStudio studio={studio} endpoint={endpoint} storageKey={key + ':draw'} reload={reload} />
    <div className={styles.footerActions}>
      <button type="button" className={styles.subButton} onClick={() => move(1)}>Back</button>
      <button type="button" className={styles.goldButton} onClick={() => move(3)}>Review tournament <FcIcon name="chevronRight" /></button>
    </div>
  </>;
  else if (studio) panel = <StudioReview studio={studio} endpoint={endpoint} reload={reload} onBack={() => move(2)} />;

  return (
    <div className={styles.studio}>
      <div className={styles.studioHeader}>
        <Link href={cupHref}>← Cup Center</Link>
        <span role="status">{studio ? studio.tournament.status === 'ACTIVE' ? 'Published' : 'Tournament draft' : storageAvailable ? 'Autosaved on this device' : 'Browser storage unavailable'}</span>
        <h1>Tournament Studio</h1>
        {settings.name && <p>{settings.name}</p>}
      </div>
      <ol className={styles.steps} aria-label="Tournament creation progress">
        {steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}>
          <button type="button" disabled={busy || index === step || (!id && index > step)} onClick={() => move(index)}>
            <span>{index + 1}</span>{label}
          </button>
        </li>)}
      </ol>
      <section className={styles.studioPanel}>
        <div className={styles.stepBody} key={step}>
          <h2 tabIndex={-1} ref={heading}>{steps[step]}</h2>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {panel}
        </div>
      </section>
      {id && <details className={styles.formatList}>
        <summary>Advanced tournament controls</summary>
        <div className={styles.inlineActions}>
          <Link className={styles.subButton} href={existingWizard + '/setup'}>Full setup</Link>
          <Link className={styles.subButton} href={existingWizard + '/teams'}>Teams and registration</Link>
          <Link className={styles.subButton} href={existingWizard + '/groups'}>Group editor</Link>
          <Link className={styles.subButton} href={existingWizard + '/fixture-settings'}>Fixture settings</Link>
          <Link className={styles.subButton} href={existingWizard + '/qualification'}>Qualification</Link>
        </div>
      </details>}
    </div>
  );
}
