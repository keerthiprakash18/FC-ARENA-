'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcErrorState, FcLoadingScreen, FcUnauthorizedState } from '@/components/fc/fc-ui';
import { ApiError } from '@/lib/api';
import {
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

export function SecondaryFeaturePage({
  title,
  eyebrow,
  subtitle,
  backHref = '/more',
  backLabel = 'More',
  action,
  header,
  className = '',
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState<401 | 403 | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then(current => { if (active) setUser(current); })
      .catch(err => {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setUnauthorized(err.status);
        else setError('Unable to load your account. Check your connection and try again.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  if (loading) {
    return (
      <FcLoadingScreen
        label={`Loading ${title}...`}
      />
    );
  }

  if (!user) {
    return (
      <main className="fc-state-screen">
        {unauthorized ? <FcUnauthorizedState forbidden={unauthorized === 403} /> : <FcErrorState message={error} onRetry={() => { setLoading(true); setError(''); setUnauthorized(null); setAttempt(value => value + 1); }} />}
      </main>
    );
  }

  return (
    <AppShell
      currentUser={user}
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className={`${header ? 'premium-page' : 'space-y-6'} ${className}`}>
        {header ? <><Link href={backHref} className="premium-quiet">← {backLabel}</Link>{header}</> : <BackHeader
          backHref={
            backHref
          }
          backLabel={
            backLabel
          }
          eyebrow={
            eyebrow
          }
          title={
            title
          }
          subtitle={
            subtitle
          }
          action={
            action
          }
        />}

        {
          children
        }
      </div>
    </AppShell>
  );
}
