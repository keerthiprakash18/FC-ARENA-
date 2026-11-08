'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';

export function PlayerOnboarding({ userId, profile, league, registered }: {
  userId: string; profile: boolean; league: boolean; registered: boolean;
}) {
  const [hidden, setHidden] = useState(true);
  const key = `fc-onboarding:${userId}`;
  useLayoutEffect(() => {
    try { setHidden(localStorage.getItem(key) === 'dismissed'); }
    catch { setHidden(false); }
  }, [key]);
  if (hidden || (profile && league && registered)) return null;

  const steps = [
    { done: profile, label: 'Complete profile', href: '/profile' },
    { done: league, label: 'Join a league', href: '/leagues' },
    { done: registered, label: 'Register & play', href: '/tournaments' },
  ];
  const completed = steps.filter(step => step.done).length;
  return (
    <section className="theme-panel home-onboarding" aria-label="Getting started">
      <details className="home-onboarding-steps">
        <summary>
          <h2><span>Get match ready · {completed}/3</span><span className="theme-muted home-onboarding-next">Next: {steps.find(step => !step.done)?.label}</span><span className="home-disclosure-chevron" aria-hidden="true">⌄</span></h2>
        </summary>
        <nav aria-label="Getting started steps">
          {steps.map((step, index) => (
            <Link key={step.href} href={step.href} className="theme-secondary-button">
              <span aria-hidden="true">{step.done ? '✓' : `${index + 1}.`}</span> {step.label}
              {step.done ? <span className="sr-only"> (completed)</span> : null}
            </Link>
          ))}
        </nav>
      </details>
      <button type="button" className="theme-secondary-button home-onboarding-dismiss" onClick={() => {
        setHidden(true);
        try { localStorage.setItem(key, 'dismissed'); } catch {}
      }}>Dismiss</button>
    </section>
  );
}
