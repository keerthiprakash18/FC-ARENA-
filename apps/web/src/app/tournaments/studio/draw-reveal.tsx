'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { entryName, type Entry, type Outcome } from './studio-model';
import styles from '../cup.module.css';

export function DrawReveal({ outcome, entries, audio }: { outcome: Outcome; entries: Entry[]; audio?: AudioContext }) {
  const spins = useMemo(() => {
    if (outcome.kind === 'CLUB') return [{ winner: { id: outcome.winner, name: outcome.winner, avatar: null }, options: outcome.options.map(name => ({ id: name, name, avatar: null })) }];
    if (outcome.kind === 'PLAYER') {
      const selected = outcome.entries[0]?.members ?? [];
      return selected.map((winner, index) => {
        const prior = new Set(selected.slice(0, index).map(player => player.id));
        return { winner, options: (outcome.options ?? []).filter(option => !prior.has(option.id)) };
      });
    }
    return [];
  }, [outcome]);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const current = spins[stage];

  useEffect(() => {
    if (visible) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { setVisible(true); };
    const interrupted = () => { if (document.hidden || reduced.matches) { setSkipped(true); finish(); } };
    if (document.hidden || reduced.matches) { interrupted(); return; }
    if (!current && outcome.kind !== 'GROUP' && outcome.kind !== 'AUTO') { finish(); return; }
    let animation: Animation | undefined;
    if (current && wheel.current && typeof wheel.current.animate === 'function') {
      const options = wheelOptions(current.options, current.winner);
      const index = options.findIndex(option => option.id === current.winner.id);
      const angle = 1440 - (360 / options.length) * index;
      animation = wheel.current.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + angle + 'deg)' }],
        { duration: 1900, easing: 'cubic-bezier(.10,.57,.16,1)', fill: 'forwards' },
      );
    }
    const timer = window.setTimeout(() => {
      if (stage + 1 < spins.length) setStage(stage + 1); else finish();
    }, current ? 2050 : 650);
    reduced.addEventListener?.('change', interrupted);
    document.addEventListener('visibilitychange', interrupted);
    return () => {
      window.clearTimeout(timer);
      animation?.cancel();
      reduced.removeEventListener?.('change', interrupted);
      document.removeEventListener('visibilitychange', interrupted);
    };
  }, [current, outcome.kind, spins.length, stage, visible]);

  useEffect(() => {
    if (!visible || !audio || audio.state !== 'running' || document.hidden) return;
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
  }, [audio, visible]);

  function skip() { setSkipped(true); setVisible(true); }

  if (!visible && current) {
    const options = wheelOptions(current.options, current.winner);
    const step = 360 / options.length;
    const bands = options.map((_, index) => (index % 2 ? '#192d49 ' : '#253d5d ') + (index * step) + 'deg ' + ((index + 1) * step) + 'deg');
    return <section className={styles.reveal} aria-label="Live wheel">
      <div className={styles.wheelFrame} aria-hidden="true">
        <div className={styles.wheelPointer} />
        <div key={stage} ref={wheel} className={styles.wheel} style={{ background: 'conic-gradient(from ' + (-step / 2) + 'deg,' + bands.join(',') + ')' }}>
          {options.map((option, index) => <div key={option.id} className={styles.wheelSlot} style={{ transform: 'rotate(' + index * step + 'deg)' }}>
            <FcCrest name={option.name} imageUrl={option.avatar} size="sm" />
            <b>{option.name}</b>
          </div>)}
        </div>
        <span className={styles.wheelHub}><FcIcon name={outcome.kind === 'CLUB' ? 'football' : 'profile'} /></span>
      </div>
      <p role="status">{spins.length > 1 ? 'Revealing player ' + (stage + 1) + ' of ' + spins.length : 'Revealing the saved result…'}</p>
      <button className={styles.subButton} type="button" onClick={skip}>Skip animation</button>
    </section>;
  }

  return <section className={styles.reveal} data-instant={skipped} aria-label="Draw result">
    {!visible && <button className={styles.subButton} type="button" onClick={skip}>Show result now</button>}
    {visible && !skipped && (outcome.kind === 'CLUB' || outcome.kind === 'PLAYER') &&
      <div className={styles.particles} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
    {visible && <div aria-live="polite">
      {outcome.kind === 'CLUB' ? <div className={styles.winner}><FcCrest name={outcome.winner} size="lg" /><p>Club assigned<strong>{outcome.winner}</strong></p></div> :
        outcome.kind === 'GROUP' ? <>
          <h3>Group draw saved</h3>
          <div className={styles.groupGrid}>{outcome.groups.map(group => <div key={group.id}>
            <h4>{group.name}</h4>
            <ul>{group.entryIds.map((id, index) => {
              const entry = entries.find(item => item.id === id);
              return <li key={id} style={{ animationDelay: Math.min(index, 7) * 55 + 'ms' }}>{entry ? entryName(entry) : 'Approved entry'}</li>;
            })}</ul>
          </div>)}</div>
        </> : <>
          <h3>{outcome.entries.length === 1 ? (outcome.entries[0]?.members.length === 2 ? 'Duo confirmed' : 'Entry confirmed') : outcome.entries.length + ' entries confirmed'}</h3>
          <div className={styles.resultGrid}>{outcome.entries.slice(0, 8).map(entry => <div key={entry.id} className={styles.revealEntry}>
            <div>{entry.members.map(player => <FcCrest key={player.id} name={player.name} imageUrl={player.avatar} size="sm" />)}</div>
            <strong>{entryName(entry)}</strong>
          </div>)}</div>
          {outcome.entries.length > 8 && <p>View all entries on the roster below.</p>}
          {outcome.unassigned > 0 && (outcome.kind === 'AUTO' || outcome.kind === 'PLAYER') && <p>{outcome.unassigned} eligible players remain unassigned.</p>}
        </>}
    </div>}
  </section>;
}

function wheelOptions<T extends { id: string }>(all: T[], winner: T) {
  if (all.length <= 9) return all.some(option => option.id === winner.id) ? all : [...all, winner];
  const index = all.findIndex(option => option.id === winner.id);
  const start = Math.max(0, Math.min(index - 4, all.length - 9));
  return index >= 0 ? all.slice(start, start + 9) : [winner, ...all.slice(0, 8)];
}
