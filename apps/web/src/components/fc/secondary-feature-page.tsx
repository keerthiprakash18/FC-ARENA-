'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcLoadingScreen } from '@/components/fc/fc-ui';
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
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  useEffect(() => {
    void getCurrentUser()
      .then(
        setUser,
      );
  }, []);

  if (!user) {
    return (
      <FcLoadingScreen
        label={`Loading ${title}...`}
      />
    );
  }

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
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
        />

        {
          children
        }
      </div>
    </AppShell>
  );
}
