'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { FcCrest } from '@/components/fc/fc-ui';
import { playRevealSound } from './draw-reveal';
import type { DrawnEntry, Player } from './studio-model';
import styles from '../cup.module.css';

const SPIN_MS = 4400;
const REVEAL_MS = 1400;
const SLICES = 24;

export function LivePlayerWheel({ entries, players, duo, audio, onComplete }: {
  entries: DrawnEntry[];
  players?: Player[];
  duo: boolean;
  audio?: AudioContext;
  onComplete: () => void;
}) {
  // The API has already saved the draw. Wheel animation only reveals the saved order.
  const winners = useMemo(() => entries.flatMap(entry => entry.members), [entries]);
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [settled, setSettled] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const angle = useRef(0);
  const elapsed = useRef(0);
  const complete = useEffectEvent(onComplete);
  const playSound = useEffectEvent(() => playRevealSound(audio));
  const finished = skipped || shown >= winners.length;
  const revealed = skipped ? winners.length : shown + Number(settled && !finished);
  const nextWinner = winners[shown];
  const pool = useMemo(() => {
    const alreadyRevealed = new Set(winners.slice(0, shown).map(player => player.id));
    return (players ?? winners).filter(player => !alreadyRevealed.has(player.id))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }, [players, winners, shown]);
  const winnerIndex = nextWinner ? pool.findIndex(player => player.id === nextWinner.id) : 0;
  const candidate = settled ? nextWinner : pool[candidateIndex] ?? pool[0];
  const entrySize = entries[0]?.members.length || 1;
  const completedEntries = entries.slice(0, Math.floor(revealed / entrySize));

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => { if (motion.matches) setSkipped(true); };
    const onVisibility = () => { if (document.hidden) setPaused(true); };
    syncMotion();
    onVisibility();
    motion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      motion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (finished) complete();
  }, [finished]);

  useEffect(() => {
    const rotor = wheel.current;
    if (finished || paused || !rotor || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wheelElement = rotor;
    const start = angle.current;
    // Advance to a fresh notch without resetting the transform between players.
    const turn = 360 / SLICES;
    const target = start + 7 * 360 + turn * (1 + winnerIndex % (SLICES - 1));
    const advance = Math.max(12, pool.length - 1);
    let lastLabelAt = -Infinity;
    let winnerAnnounced = elapsed.current >= SPIN_MS;
    let lastTime: number | undefined;
    let frame: number;

    function tick(now: number) {
      elapsed.current += lastTime === undefined ? 0 : Math.min(now - lastTime, 64);
      lastTime = now;
      const progress = Math.min(elapsed.current / SPIN_MS, 1);
      // Ease in, then coast into a longer slowdown at the pointer.
      const eased = progress * progress * (10 + progress * (-20 + progress * (15 - 4 * progress)));
      wheelElement.style.transform = `rotate(${start + (target - start) * eased}deg)`;
      if (now - lastLabelAt >= 100 && progress < 1) {
        lastLabelAt = now;
        const stepsLeft = Math.ceil((1 - eased) * advance);
        setCandidateIndex((winnerIndex + pool.length - stepsLeft % pool.length) % pool.length);
      }
      if (progress === 1 && !winnerAnnounced) {
        winnerAnnounced = true;
        setSettled(true);
        playSound();
      }
      if (elapsed.current >= SPIN_MS + REVEAL_MS) {
        angle.current = target % 360;
        elapsed.current = 0;
        setSettled(false);
        setShown(value => value + 1);
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [finished, paused, pool.length, winnerIndex, shown]);

  return <section className={`${styles.reveal} ${styles.livePlayerDraw}`} aria-label="Live player draw">
    <header>
      <h3 ref={heading} tabIndex={-1}>Live player draw</h3>
      <p>{revealed} of {winners.length} players revealed · {(players?.length ?? winners.length) - revealed} remaining</p>
    </header>
    {!skipped && <div className={styles.liveWheelFrame} aria-hidden="true">
      <div ref={wheel} className={styles.liveWheelRotor} />
      <div className={styles.wheelPointer} />
      <div className={styles.liveWheelCandidate} data-selected={settled || finished}>
        {!finished && candidate && <span><FcCrest name={candidate.name} imageUrl={settled ? candidate.avatar : null} size="sm" /></span>}
        <span>{finished ? 'Reveal complete' : settled ? 'Selected player' : paused ? 'Paused' : 'In the draw'}</span>
        {!finished && <strong>{candidate?.name}</strong>}
      </div>
    </div>}
    <div className={styles.liveDrawStatus} role="status" aria-atomic="true">
      {finished
        ? <strong>{duo ? 'Duo draw complete' : 'Player draw complete'}</strong>
        : settled && nextWinner
          ? <strong>{nextWinner.name} selected{revealed % entrySize === 0 ? ` · ${duo ? 'Duo' : 'Entry'} ${completedEntries.length} formed` : ''}</strong>
          : <span>{paused ? 'Reveal paused' : `Drawing player ${shown + 1} of ${winners.length}…`}</span>}
    </div>
    {!finished && <div className={styles.inlineActions}>
      <button type="button" className={styles.subButton} onClick={() => setPaused(value => !value)}>{paused ? 'Resume reveal' : 'Pause reveal'}</button>
      <button type="button" className={styles.subButton} onClick={() => setSkipped(true)}>Show all results</button>
    </div>}
    {completedEntries.length > 0 && <ol className={styles.liveDrawPairs} tabIndex={0} aria-label={duo ? 'Revealed Duo teams' : 'Revealed entries'}>
      {completedEntries.map((entry, index) => <li key={entry.id}>
        <b>{duo ? 'Duo' : 'Entry'} {index + 1}</b>
        <span>{entry.members.map(player => player.name).join(' + ')}</span>
      </li>)}
    </ol>}
  </section>;
}
