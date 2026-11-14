'use client';

import { useEffect, useRef, useState } from 'react';
import { FcIcon } from '@/components/fc/fc-icons';
import styles from './award-ceremony.module.css';

type Ceremony = 'champion' | 'ballon' | 'boot' | 'season';

export function AwardCeremony({ variant, title, winner }: { variant: Ceremony; title: string; winner: string }) {
  const [playing, setPlaying] = useState(false);
  const display = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);

  useEffect(() => {
    const stop = () => {
      if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) animation.current?.cancel();
    };
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', stop);
    preference.addEventListener?.('change', stop);
    return () => {
      animation.current?.cancel();
      document.removeEventListener('visibilitychange', stop);
      preference.removeEventListener?.('change', stop);
    };
  }, []);

  function finish() {
    animation.current?.cancel();
    setPlaying(false);
  }

  function play() {
    const frames = {
      champion: [{ transform: 'translateY(12px) scale(.94)', opacity: .35 }, { transform: 'translateY(0) scale(1.04)', opacity: 1, offset: .65 }, { transform: 'translateY(0) scale(1)', opacity: 1 }],
      ballon: [{ transform: 'rotate(-16deg) scale(.86)', opacity: .4 }, { transform: 'rotate(0) scale(1)', opacity: 1 }],
      boot: [{ transform: 'translateX(-14px)', opacity: .45 }, { transform: 'translateX(0)', opacity: 1 }],
      season: [{ transform: 'translateY(-8px)', opacity: .35 }, { transform: 'translateY(0)', opacity: 1 }],
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !display.current?.animate) return;
    setPlaying(true);
    const running = display.current.animate(frames[variant], { duration: 750, easing: 'cubic-bezier(.22,.68,.35,1)' });
    animation.current = running;
    void running.finished.catch(() => {}).finally(() => {
      if (animation.current !== running) return;
      animation.current = null;
      setPlaying(false);
    });
  }

  return <div className={styles.ceremony} data-variant={variant}>
    <div className={styles.medal} ref={display}>
      <FcIcon name={variant === 'champion' ? 'trophy' : variant === 'boot' ? 'football' : 'award'} size={26} />
      <div><span>{title}</span><strong>{winner}</strong></div>
    </div>
    <button type="button" onClick={playing ? finish : play}>{playing ? 'Skip ceremony' : 'Play ceremony'}</button>
  </div>;
}
