'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { FcIcon } from '@/components/fc/fc-icons';
import { authenticatedRequest } from '@/lib/auth-client';
import { Roster } from './draw-studio';
import { entryName, estimate, formats, modes, type Studio } from './studio-model';
import styles from '../cup.module.css';

export function StudioReview({ studio, endpoint, reload, onBack }: {
  studio: Studio; endpoint: string; reload: () => Promise<Studio>; onBack: () => void;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [qualifiers, setQualifiers] = useState<number | ''>(studio.tournament.qualifiersPerGroup ?? 2);
  const [visible, setVisible] = useState(20);
  const lock = useRef(false);
  const { tournament, entries, fixtures, revision } = studio;
  const approved = entries.filter(entry => entry.status === 'APPROVED');
  const pending = entries.length - approved.length;
  const format = tournament.competitionFormat;
  const grouped = tournament.groupMode === 'MULTIPLE_GROUPS';
  const knockout = format === 'SINGLE_ELIMINATION';
  const active = ['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(tournament.status);
  const stageMatches = estimate(tournament, approved);
  const sizes = tournament.groups.map(group => approved.filter(entry => entry.groupId === group.id).length);
  const groupReady = !grouped || (sizes.length >= 2 && Math.min(...sizes) >= 2 && Math.max(...sizes) - Math.min(...sizes) <= 1 && sizes.reduce((sum, count) => sum + count, 0) === approved.length);
  const configured = (!grouped || Boolean(tournament.qualifiersPerGroup)) && (!knockout || Boolean(tournament.playoffQualifiersTotal));
  const blockers = [
    approved.length < 2 && 'Add at least two approved entries.',
    pending > 0 && 'Review pending registrations.',
    approved.some(entry => !entry.valid) && 'Fix incomplete or ineligible entries.',
    !groupReady && 'Complete a balanced group draw.',
    tournament.status === 'REGISTRATION_OPEN' && 'Close registration before preparing fixtures.',
  ].filter(Boolean);
  const names = new Map(entries.map(entry => [entry.id, entryName(entry)]));
  const confirmed = confirm === revision;

  async function action(label: string, work: () => Promise<unknown>, refresh = true) {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError('');
    try { await work(); if (refresh) await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed. Retry or reload the review.'); }
    finally { lock.current = false; setBusy(''); }
  }

  async function qualification() {
    await authenticatedRequest(endpoint + '/wizard/qualification', {
      method: 'PATCH', body: JSON.stringify({
        playoffFormat: 'GLOBAL_SEEDED', playoffSource: 'AUTO', playoffSeedingBasis: 'AUTO',
        ...(grouped ? { qualifiersPerGroup: Number(qualifiers) } : { playoffQualifiersTotal: approved.length }),
        avoidSameGroupEarly: grouped,
      }),
    });
  }

  return <div className={styles.formStack}>
    <div className={styles.reviewStats}>
      <div><span>Format</span><strong>{formats[format]}</strong></div>
      <div><span>Approved {modes[tournament.mode].label} entries</span><strong>{approved.length} / {tournament.maxEntries}</strong></div>
      <div><span>{grouped ? 'Estimated group matches' : 'Estimated matches'}</span><strong>{stageMatches ?? 'See fixture preview'}</strong></div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <Roster entries={entries} duo={tournament.mode === 'DUO'} />
    {active ? <div className={styles.notice} role="status">
      <p>{tournament.status === 'ACTIVE' ? 'Tournament published.' : 'Tournament is ' + tournament.status.toLowerCase() + '.'}</p>
      <Link href={endpoint} className={styles.goldButton}>Open tournament</Link>
    </div> : <>
      {blockers.length > 0 && <ul className={styles.checklist}>{blockers.map(text => <li key={String(text)}>{text}</li>)}</ul>}
      {pending > 0 && <Link href={endpoint + '/registration'} className={styles.subButton}>Review registrations</Link>}
      {tournament.status === 'REGISTRATION_OPEN' && <button type="button" className={styles.subButton} disabled={Boolean(busy)}
        onClick={() => void action('Closing registration…', () => authenticatedRequest(endpoint + '/close-registration', { method: 'POST' }))}>Close registration</button>}

      {(grouped || knockout || format === 'ELITE_CUP' || format === 'UCL_CUP') && <section className={styles.reviewPart}>
        <h3>Qualification</h3>
        {grouped && tournament.qualifiersPerGroup ? <p>{tournament.qualifiersPerGroup} qualify per group.</p> :
          knockout && tournament.playoffQualifiersTotal ? <p>{tournament.playoffQualifiersTotal} enter the knockout bracket.</p> :
          format === 'UCL_CUP' || format === 'ELITE_CUP' ? <p>Qualification follows the selected cup’s existing rules.</p> :
          <p>Set qualification before generating the preview.</p>}
        {!configured && (grouped || knockout) && <form className={styles.formStack} onSubmit={event => {
          event.preventDefault(); void action('Saving qualification…', qualification);
        }}>
          {grouped && <label>Qualifiers per group<input type="number" required min={1} max={Math.max(1, Math.min(64, ...sizes))} value={qualifiers}
            onChange={event => setQualifiers(event.target.value ? Number(event.target.value) : '')} /></label>}
          <button className={styles.subButton} type="submit" disabled={Boolean(busy) || Boolean(blockers.length)}>Save qualification</button>
        </form>}
        <Link className={styles.subButton} href={endpoint + '/wizard/qualification'}>Advanced qualification</Link>
      </section>}

      <section className={styles.reviewPart}>
        <h3>Fixture preview</h3>
        {fixtures.length ? <>
          <p>{fixtures.length} fixtures · {studio.publishedFixtureCount ? 'Official fixtures exist' : 'Unpublished preview'}</p>
          <details className={styles.formatList}>
            <summary>Review fixtures</summary>
            <ol className={styles.fixtures}>{fixtures.slice(0, visible).map(fixture => (
              <li key={fixture.id}><small>{fixture.roundName}</small><span>
                {names.get(fixture.homeRegistrationId ?? '') ?? 'To be decided'} <b>vs</b> {names.get(fixture.awayRegistrationId ?? '') ?? 'To be decided'}
              </span></li>
            ))}</ol>
            {fixtures.length > visible && <button className={styles.subButton} type="button" onClick={() => setVisible(count => count + 40)}>Show more fixtures</button>}
          </details>
        </> : <p>Generate a preview to see the schedule before publishing.</p>}
        <div className={styles.inlineActions}>
          {tournament.fixtureMode !== 'MANUAL' && !fixtures.length && <button className={styles.subButton} type="button"
            disabled={Boolean(busy) || Boolean(blockers.length) || !configured} onClick={() => void action('Generating fixture preview…',
              () => authenticatedRequest(endpoint + '/wizard/fixture-preview/generate', { method: 'POST', body: '{}' }))}>Generate fixture preview</button>}
          <Link className={styles.subButton} href={endpoint + '/wizard/fixture-preview'}>Advanced fixture editor</Link>
        </div>
      </section>

      {fixtures.length > 0 && blockers.length === 0 && configured && <div className={styles.publishBox}>
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirm(event.target.checked ? revision : '')} />
          <span>I have reviewed the roster, qualification and fixtures. Publish this tournament to its selected audience.</span></label>
        <button type="button" className={styles.goldButton} disabled={!confirmed || Boolean(busy)}
          onClick={() => void action('Publishing tournament…', () => authenticatedRequest(endpoint + '/studio/publish', {
            method: 'POST', body: JSON.stringify({ revision, confirmed: true }),
          }))}><FcIcon name="check" /> Publish tournament</button>
      </div>}
    </>}
    <div className={styles.footerActions}>
      <button type="button" className={styles.subButton} onClick={onBack} disabled={Boolean(busy)}>Back to draw</button>
      <button type="button" className={styles.subButton} onClick={() => void action('Refreshing review…', reload, false)} disabled={Boolean(busy)}>Refresh review</button>
    </div>
    {busy && <p className={styles.notice} role="status">{busy}</p>}
  </div>;
}
