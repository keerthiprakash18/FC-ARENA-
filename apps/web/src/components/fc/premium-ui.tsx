'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FcCrest } from './fc-ui';
import { FcIcon, type FcIconName } from './fc-icons';

export function PremiumPitch() {
  return <svg className="premium-pitch" viewBox="0 0 600 340" fill="none" aria-hidden="true"><rect x="35" y="35" width="530" height="270" rx="8" /><path d="M300 35v270M35 110h90v120H35m530-120h-90v120h90" /><circle cx="300" cy="170" r="65" /><circle cx="300" cy="170" r="3" /></svg>;
}

export function PremiumHero({ eyebrow, title, description, crest, imageUrl, action, children, className = '' }: {
  eyebrow: string; title: string; description?: string; crest?: string; imageUrl?: string | null;
  action?: ReactNode; children?: ReactNode; className?: string;
}) {
  return <section className={`premium-hero ${className}`}>
    <PremiumPitch />
    <div className="premium-hero-copy">
      <p className="premium-eyebrow">{eyebrow}</p>
      <div className="premium-hero-identity">
        {crest ? <FcCrest name={crest} imageUrl={imageUrl} size="lg" /> : null}
        <div className="min-w-0"><h1>{title}</h1>{description ? <p className="premium-hero-description">{description}</p> : null}</div>
      </div>
      {children}
    </div>
    {action ? <div className="premium-hero-action">{action}</div> : null}
  </section>;
}

export function PremiumSection({ label, title, href, children, className = '' }: {
  label?: string; title: string; href?: string; children: ReactNode; className?: string;
}) {
  return <section className={`premium-section ${className}`}>
    <div className="premium-section-heading"><div>{label ? <p className="premium-eyebrow">{label}</p> : null}<h2>{title}</h2></div>{href ? <Link className="premium-quiet" href={href}>View all <FcIcon name="chevronRight" size={16} /></Link> : null}</div>
    {children}
  </section>;
}

export function PremiumMatch({ home, away, homeScore, awayScore, label, status, href, action = 'View Match', children }: {
  home: string; away: string; homeScore?: number; awayScore?: number; label: string;
  status?: ReactNode; href?: string; action?: string; children?: ReactNode;
}) {
  return <article className="premium-match">
    <div className="premium-match-meta"><p>{label}</p>{status}</div>
    <div className="premium-match-sides">
      <div className="premium-match-team"><FcCrest name={home} size="lg" /><strong>{home}</strong></div>
      <div className="premium-match-score" aria-label={homeScore !== undefined && awayScore !== undefined ? `${homeScore} to ${awayScore}` : 'Versus'}>{homeScore !== undefined && awayScore !== undefined ? <>{homeScore}<span>:</span>{awayScore}</> : <span className="premium-versus">VS</span>}</div>
      <div className="premium-match-team"><FcCrest name={away} size="lg" /><strong>{away}</strong></div>
    </div>
    {children || href ? <div className="premium-match-footer">{children}{href ? <Link className="theme-primary-button premium-button" href={href}>{action}<FcIcon name="chevronRight" size={16} /></Link> : null}</div> : null}
  </article>;
}

export function PremiumDestination({ href, icon, title, detail, featured = false }: {
  href: string; icon: FcIconName; title: string; detail: string; featured?: boolean;
}) {
  return <Link className={`premium-destination${featured ? ' is-featured' : ''}`} href={href}><FcIcon name={icon} size={26} /><span><strong>{title}</strong><span>{detail}</span></span><FcIcon name="chevronRight" size={18} /></Link>;
}

export function AwardEmblem({ kind = 'ballon', className = '' }: { kind?: 'ballon' | 'boot' | 'glove' | 'playmaker' | 'ranking'; className?: string }) {
  return <svg className={`premium-award-emblem ${className}`} viewBox="0 0 100 120" fill="none" aria-hidden="true">
    <path className="premium-emblem-frame" d="M50 5 91 23v45c0 22-18 38-41 46C27 106 9 90 9 68V23L50 5Z" />
    <path d="M28 96h44M36 103h28" />
    {kind === 'ballon' ? <><circle cx="50" cy="51" r="24" /><path d="m50 36 14 10-5 16H41l-5-16 14-10ZM50 27v9m23 8-9 2m0 24-5-8M36 70l5-8m-14-18 9 2M43 76v13h14V76M32 20l8 8 10-12 10 12 8-8" /></> : null}
    {kind === 'boot' ? <><path d="M32 27h21l4 29 18 12c9 7 6 17-3 17H29c-8 0-10-11-6-17l9-12V27ZM29 86l3 5m14-5v5m15-5v5m12-5-2 5M36 47h16m-16 8h17m-12 1 14 10" /></> : null}
    {kind === 'glove' ? <><path d="M36 66V33c0-8 10-8 10 0v20-26c0-8 10-8 10 0v26-22c0-8 10-8 10 0v24-14c0-8 10-8 10 0v25c0 15-7 21-19 21H42c-11 0-19-13-22-24-2-9 6-13 11-4l5 7ZM40 89h24" /></> : null}
    {kind === 'playmaker' ? <><circle cx="31" cy="71" r="7" /><circle cx="69" cy="36" r="7" /><circle cx="70" cy="77" r="7" /><path d="m37 65 26-23M38 73l24 3M27 29l13 13m-13 0 13-13M50 51l7 7m-7 0 7-7" /></> : null}
    {kind === 'ranking' ? <><path d="M24 86V66h15v20M42 86V46h15v40M60 86V59h15v27M30 50l19-20 20 11m-12-1 12 1-3-12" /></> : null}
  </svg>;
}

export function PremiumPodium({ rows, seasonId }: { rows: readonly {
  position: number; userId: string; fullName: string; inGameName: string | null;
  profileImageUrl: string | null; rating: number; eligible: boolean;
}[]; seasonId: string }) {
  const podium = rows.filter(row => row.eligible && row.position <= 3);
  if (!podium.length) return null;
  const displayRows = podium.length === 3 ? podium.toSorted((a, b) => [2, 1, 3].indexOf(a.position) - [2, 1, 3].indexOf(b.position)) : podium;
  return <section className="premium-podium" aria-label="Season podium" style={{ gridTemplateColumns: `repeat(${podium.length}, minmax(0, 1fr))` }}>
    {displayRows.map(row => <Link key={row.userId} data-rank={row.position} className="premium-podium-player" href={`/awards/ballon/${seasonId}/players/${row.userId}`}>
      <span className="premium-podium-rank">Position {row.position}</span>
      <FcCrest name={row.inGameName || row.fullName} imageUrl={row.profileImageUrl} size="lg" />
      <strong>{row.inGameName || row.fullName}</strong>
      <span className="premium-rating">{row.rating}</span><small>Ballon rating / 100</small>
    </Link>)}
  </section>;
}
