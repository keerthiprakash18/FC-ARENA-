'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { FcIcon, type FcIconName } from '@/components/fc/fc-icons';
import styles from './mobile-app-menu.module.css';

const menuGroups: { href: string; label: string; icon: FcIconName }[][] = [
  [
    { href: '/dashboard', label: 'Dashboard', icon: 'home' },
    { href: '/tournaments', label: 'Tournaments', icon: 'trophy' },
    { href: '/fixtures', label: 'Matches', icon: 'calendar' },
  ],
  [
    { href: '/leaderboards', label: 'Leaderboards', icon: 'leaderboard' },
    { href: '/leagues', label: 'Leagues', icon: 'shield' },
    { href: '/community/teams', label: 'Teams', icon: 'team' },
  ],
  [
    { href: '/settings/appearance', label: 'Appearance', icon: 'settings' },
    { href: '/help', label: 'Support', icon: 'help' },
    { href: '/more', label: 'More', icon: 'more' },
  ],
];

export function MobileAppMenu({ playerName, playerRole, playerImageUrl }: {
  playerName?: string | null;
  playerRole?: string | null;
  playerImageUrl?: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const id = useId();
  const name = playerName || 'FC ARENA Player';
  const initials = (playerName || 'FC').slice(0, 2).toUpperCase();
  const photo = playerImageUrl && playerImageUrl !== failedPhoto ? playerImageUrl : null;
  const avatar = photo ? <img src={photo} alt="" onError={() => setFailedPhoto(photo)} /> : initials;
  const close = () => dialog.current?.close();

  return (
    <div className="flex shrink-0 items-center gap-2 lg:hidden">
      <button
        ref={trigger}
        type="button"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open}
        className={`theme-profile-chip ${styles.trigger}`}
        onClick={() => { dialog.current?.showModal(); setOpen(true); }}
      >
        <span className={styles.avatar} aria-hidden="true">{avatar}</span>
      </button>
      <Link href="/dashboard" className="fc-header-wordmark fc-display text-lg font-semibold tracking-[-0.02em]">
        FC <span className="theme-brand-accent">ARENA</span>
      </Link>

      <dialog
        ref={dialog}
        id={id}
        aria-label="FC Arena navigation"
        data-no-pull-refresh
        className={styles.drawer}
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        onClick={event => { if (event.target === event.currentTarget) close(); }}
      >
        <div className={styles.content}>
          <div className={styles.account}>
            <button type="button" className={styles.close} aria-label="Close navigation menu" onClick={close} autoFocus>×</button>
            <Link href="/profile" onNavigate={close} className={styles.profile}>
              <span className={styles.avatar} aria-hidden="true">{avatar}</span>
              <span className={styles.identity}>
                <strong>{name}</strong>
                <span>{playerRole || 'View profile'}</span>
              </span>
            </Link>
            <Link href="/career" onNavigate={close} className={styles.career}>
              <FcIcon name="chart" size={22} />
              <span><strong>My career</strong><small>Results, stats and achievements</small></span>
              <FcIcon name="chevronRight" size={18} />
            </Link>
          </div>

          <nav aria-label="App shortcuts" className={styles.navigation}>
            {menuGroups.map(group => (
              <ul key={group[0].href}>
                {group.map(item => (
                  <li key={item.href}>
                    <Link href={item.href} onNavigate={close}>
                      <FcIcon name={item.icon} size={21} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </nav>
        </div>
      </dialog>
    </div>
  );
}
