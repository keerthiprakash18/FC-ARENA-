'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { FcIcon } from '@/components/fc/fc-icons';
import { entryName, type Entry, type Outcome, type Player } from './studio-model';
import styles from '../cup.module.css';

export function DrawReveal({ outcome, entries, audio, onComplete }: {
  outcome: Outcome; entries: Entry[]; audio?: AudioContext; onComplete: () => void;
}) {
  const spins = useMemo(() => {
    if (outcome.kind === 'CLUB') return [{ winner: { id: outcome.winner, name: outcome.winner, avatar: null }, options: outcome.options.map(name => ({ id: name, name, avatar: null })) }];
    if (outcome.kind === 'PLAYER') {
      const selected = outcome.entries[0]?.members ?? [];
      return selected.map((winner, index) => {
        const prior = new Set(selected.slice(0, index).map(player => player.id));
        const options = (outcome.options ?? []).filter(option => !prior.has(option.id));
        return { winner, options: options.some(option => option.id === winner.id) ? options : [...options, winner] };
      });
    }
    return [];
  }, [outcome]);
  const [visible, setVisible] = useState(false);
  const [winnerVisible, setWinnerVisible] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const focusResult = useRef(false);
  const complete = useEffectEvent(onComplete);
  const [stage, setStage] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const current = spins[stage];
  const clubEntry = outcome.kind === 'CLUB' ? entries.find(entry => entry.id === outcome.entryId) : undefined;
  const animated = spins.length > 0 || outcome.kind === 'GROUP';

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
    if (!current && outcome.kind !== 'GROUP' && outcome.kind !== 'AUTO') { finish(); return; }
    let animation: Animation | undefined;
    if (current && wheel.current && typeof wheel.current.animate === 'function') {
      const options = current.options;
      const index = options.findIndex(option => option.id === current.winner.id);
      const angle = 1440 - (360 / options.length) * index;
      animation = wheel.current.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + angle + 'deg)' }],
        { duration: 1900, easing: 'cubic-bezier(.10,.57,.16,1)', fill: 'forwards' },
      );
    }
    const revealTimer = current ? window.setTimeout(() => setWinnerVisible(true), 1900) : undefined;
    const timer = window.setTimeout(() => {
      if (stage + 1 < spins.length) {
        setWinnerVisible(false);
        setStage(stage + 1);
      } else finish();
    }, current ? 3150 : 650);
    reduced.addEventListener?.('change', interrupted);
    document.addEventListener('visibilitychange', interrupted);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(revealTimer);
      animation?.cancel();
      reduced.removeEventListener?.('change', interrupted);
      document.removeEventListener('visibilitychange', interrupted);
    };
  }, [current, outcome.kind, spins.length, stage, visible]);

  useEffect(() => {
    if (!visible || skipped || !audio || audio.state !== 'running' || document.hidden) return;
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
  }, [audio, skipped, visible]);

  function skip() { focusResult.current = true; setSkipped(true); setVisible(true); }

  if (!visible && current) {
    const options = current.options;
    const step = 360 / options.length;
    const bands = options.map((_, index) => (index % 2 ? '#192d49 ' : '#253d5d ') + (index * step) + 'deg ' + ((index + 1) * step) + 'deg');
    return <section ref={panel} className={styles.reveal} aria-label="Live wheel">
      <h3>{outcome.kind === 'CLUB' ? 'Club draw' : `Player ${stage + 1} of ${spins.length}`}</h3>
      <p>{options.length} {outcome.kind === 'CLUB' ? 'clubs' : 'players'} on this wheel</p>
      <div className={styles.wheelFrame} aria-hidden="true">
        <div className={styles.wheelPointer} />
        <div key={stage} ref={wheel} className={styles.wheel} style={{ background: 'conic-gradient(from ' + (-step / 2) + 'deg,' + bands.join(',') + ')' }}>
          {options.length <= 10 && options.map((option, index) => <div key={option.id} className={styles.wheelSlot} style={{ transform: 'rotate(' + index * step + 'deg)' }}>
            <FcCrest name={option.name} imageUrl={option.avatar} size="sm" />
            <b>{option.name}</b>
          </div>)}
        </div>
        <span className={styles.wheelHub}><FcIcon name={outcome.kind === 'CLUB' ? 'football' : 'profile'} /></span>
      </div>
      <div className={styles.wheelAnnouncement} role="status">
        {winnerVisible ? <Winner player={current.winner} label={outcome.kind === 'CLUB' ? 'Club selected' : `Player ${stage + 1} selected`} /> : <p>Spinning…</p>}
      </div>
      {stage > 0 && <ol className={styles.priorWinners} aria-label="Players already revealed">
        {spins.slice(0, stage).map(({ winner }, index) => <li key={winner.id}>Player {index + 1} · {winner.name}</li>)}
      </ol>}
      <button className={styles.subButton} type="button" onClick={skip}>Skip animation</button>
    </section>;
  }

  return <section ref={panel} className={styles.reveal} data-instant={skipped} aria-label="Draw result">
    {!visible && <button className={styles.subButton} type="button" onClick={skip}>Show result now</button>}
    {visible && !skipped && (outcome.kind === 'CLUB' || outcome.kind === 'PLAYER') &&
      <div className={styles.particles} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
    {visible && <div aria-live="polite">
      {outcome.kind === 'CLUB' ? <>
        <h3 ref={resultHeading} tabIndex={-1}>Club assigned</h3>
        <Winner player={{ id: outcome.winner, name: outcome.winner, avatar: null }}
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
            {outcome.kind === 'PLAYER' ? <ol className={styles.revealedPlayers}>{entry.members.map((player, index) => (
              <li key={player.id}><Winner player={player} label={`Player ${index + 1}`} /></li>
            ))}</ol> : <>
              <div>{entry.members.map(player => <FcCrest key={player.id} name={player.name} imageUrl={player.avatar} size="sm" />)}</div>
              <strong>{entryName(entry)}</strong>
            </>}
          </div>)}</div>
          {outcome.entries.length > 8 && <p>View all entries on the roster below.</p>}
          {outcome.unassigned > 0 && (outcome.kind === 'AUTO' || outcome.kind === 'PLAYER') && <p>{outcome.unassigned} eligible players remain unassigned.</p>}
        </>}
    </div>}
  </section>;
}

function Winner({ player, label }: { player: Player; label: string }) {
  return <div className={styles.winner}>
    <span aria-hidden="true"><FcCrest name={player.name} imageUrl={player.avatar} size="sm" /></span>
    <p>{label}<strong>{player.name}</strong></p>
  </div>;
}
