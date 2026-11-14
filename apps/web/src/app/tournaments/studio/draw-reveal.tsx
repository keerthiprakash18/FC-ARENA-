'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { entryName, type Entry, type Outcome, type Player } from './studio-model';
import styles from '../cup.module.css';

export function DrawReveal({ outcome, entries, audio, onComplete }: {
  outcome: Exclude<Outcome, { kind: 'PLAYER' }>; entries: Entry[]; audio?: AudioContext; onComplete: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [winnerVisible, setWinnerVisible] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const focusResult = useRef(false);
  const complete = useEffectEvent(onComplete);
  const [skipped, setSkipped] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const club = outcome.kind === 'CLUB' ? outcome : null;
  const clubEntry = outcome.kind === 'CLUB' ? entries.find(entry => entry.id === outcome.entryId) : undefined;
  const animated = Boolean(club) || outcome.kind === 'GROUP';

  useEffect(() => {
    if (!animated) return;
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, [animated]);

  useEffect(() => {
    if (!visible) return;
    complete();
    if (focusResult.current) resultHeading.current?.focus({ preventScroll: true });
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { setVisible(true); };
    const interrupted = () => { if (document.hidden || reduced.matches) { setSkipped(true); finish(); } };
    if (document.hidden || reduced.matches) { interrupted(); return; }
    if (!club && outcome.kind !== 'GROUP' && outcome.kind !== 'AUTO') { finish(); return; }
    let animation: Animation | undefined;
    if (club && wheel.current && typeof wheel.current.animate === 'function') {
      const options = club.options;
      const index = options.indexOf(club.winner);
      const angle = 1440 - (360 / options.length) * index;
      animation = wheel.current.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + angle + 'deg)' }],
        { duration: 1900, easing: 'cubic-bezier(.10,.57,.16,1)', fill: 'forwards' },
      );
    }
    const revealTimer = club ? window.setTimeout(() => setWinnerVisible(true), 1900) : undefined;
    const timer = window.setTimeout(finish, club ? 3150 : 650);
    reduced.addEventListener?.('change', interrupted);
    document.addEventListener('visibilitychange', interrupted);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(revealTimer);
      animation?.cancel();
      reduced.removeEventListener?.('change', interrupted);
      document.removeEventListener('visibilitychange', interrupted);
    };
  }, [club, outcome.kind, visible]);

  useEffect(() => {
    if (visible && !skipped) playRevealSound(audio);
  }, [audio, skipped, visible]);

  function skip() { focusResult.current = true; setSkipped(true); setVisible(true); }
  if (!visible && club) {
    const options = club.options;
    const step = 360 / options.length;
    const bands = options.map((_, index) => (index % 2 ? '#192d49 ' : '#253d5d ') + (index * step) + 'deg ' + ((index + 1) * step) + 'deg');
    return <section ref={panel} className={styles.reveal} aria-label="Live wheel">
      <h3>Club draw</h3>
      <p>{options.length} clubs on this wheel</p>
      <div className={styles.wheelFrame} aria-hidden="true">
        <div className={styles.wheelPointer} />
        <div ref={wheel} className={styles.wheel} style={{ background: 'conic-gradient(from ' + (-step / 2) + 'deg,' + bands.join(',') + ')' }}>
          {options.length <= 10 && options.map((option, index) => <div key={option} className={styles.wheelSlot} style={{ transform: 'rotate(' + index * step + 'deg)' }}>
            <FcCrest name={option} size="sm" />
            <b>{option}</b>
          </div>)}
        </div>
        <span className={styles.wheelHub}><FcIcon name="football" /></span>
      </div>
      <div className={styles.wheelAnnouncement} role="status">
        {winnerVisible ? <Winner player={{ id: club.winner, name: club.winner, fullName: club.winner, playerCode: null, avatar: null }} label="Club selected" /> : <p>Spinning…</p>}
      </div>
      <button className={styles.subButton} type="button" onClick={skip}>Skip animation</button>
    </section>;
  }

  return <section ref={panel} className={styles.reveal} data-instant={skipped} aria-label="Draw result">
    {!visible && <button className={styles.subButton} type="button" onClick={skip}>Show result now</button>}
    {visible && !skipped && club &&
      <div className={styles.particles} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
    {visible && <div aria-live="polite">
      {outcome.kind === 'CLUB' ? <>
        <h3 ref={resultHeading} tabIndex={-1}>Club assigned</h3>
        <Winner player={{ id: outcome.winner, name: outcome.winner, fullName: outcome.winner, playerCode: null, avatar: null }}
          label={clubEntry?.members.map(player => player.name).join(' + ') || 'Selected team'} />
      </> :
        outcome.kind === 'GROUP' ? <>
          <h3 ref={resultHeading} tabIndex={-1}>Group draw saved</h3>
          <div className={styles.groupGrid}>{outcome.groups.map(group => <div key={group.id}>
            <h4>{group.name}</h4>
            <ul>{group.entryIds.map((id, index) => {
              const entry = entries.find(item => item.id === id);
              return <li key={id} style={{ animationDelay: Math.min(index, 7) * 55 + 'ms' }}>{entry ? entryName(entry) : 'Approved entry'}</li>;
            })}</ul>
          </div>)}</div>
        </> : <>
          <h3 ref={resultHeading} tabIndex={-1}>{outcome.entries.length === 1 ? (outcome.entries[0]?.members.length === 2 ? 'Duo confirmed' : 'Entry confirmed') : outcome.entries.length + ' entries confirmed'}</h3>
          <div className={styles.resultGrid}>{outcome.entries.slice(0, 8).map(entry => <div key={entry.id} className={styles.revealEntry}>
            <div>{entry.members.map(player => <FcCrest key={player.id} name={player.name} imageUrl={player.avatar} size="sm" />)}</div>
            <strong>{entryName(entry)}</strong>
          </div>)}</div>
          {outcome.entries.length > 8 && <p>View all entries on the roster below.</p>}
          {outcome.unassigned > 0 && outcome.kind === 'AUTO' && <p>{outcome.unassigned} eligible players remain unassigned.</p>}
        </>}
    </div>}
  </section>;
}

export function playRevealSound(audio?: AudioContext) {
  if (!audio || audio.state !== 'running' || document.hidden) return;
  const now = audio.currentTime;
  [392, 523.25, 659.25].forEach((pitch, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const time = now + index * .075;
    oscillator.type = 'sine';
    oscillator.frequency.value = pitch;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(.038, time + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .26);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + .27);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}

function Winner({ player, label }: { player: Player; label: string }) {
  return <div className={styles.winner}>
    <span aria-hidden="true"><FcCrest name={player.name} imageUrl={player.avatar} size="sm" /></span>
    <p>{label}<strong>{player.name}</strong></p>
  </div>;
}
