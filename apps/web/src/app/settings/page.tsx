'use client';

import Link from 'next/link';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import styles from './settings.module.css';

import {
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcLoadingScreen,
  FcErrorState,
  FcMenuRow,
  FcPageHeader,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


export default function SettingsPage() {


  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );


  const initialLoad = useRecoverableLoad(async signal => {
    const current = await getCurrentUser({ signal });
    if (!signal.aborted) setUser(current);
  });


  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (
    !user
  ) {
    return (
      <FcLoadingScreen
        label="Loading Settings..."
      />
    );
  }


  const playerName =
    user.player
      ?.identity
      ?.inGameName ||
    user.fullName;


  return (
    <AppShell
      currentUser={user}
      playerName={
        playerName
      }
      playerRole={
        user.role ===
        'SUPER_ADMIN'
          ? 'Super Admin'
          : 'Player'
      }
    >
      <div className="space-y-6">
        <FcPageHeader
          icon="settings"
          eyebrow="Account"
          title="Settings"
          subtitle="Manage appearance and account preferences."
        />


        <FcPanel className={styles.identity}>
          <div className={styles.identityCopy}>
            <p className="theme-muted text-xs font-semibold uppercase tracking-wider">Your account</p>
            <p className={styles.playerName}>{playerName}</p>
            {user.player?.playerCode ? <p className="theme-muted mt-1 text-xs">Player Code · <span className="font-mono">{user.player.playerCode}</span></p> : null}
          </div>
          <Link href="/profile" className="theme-secondary-button inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border px-4 text-sm font-semibold">Edit profile</Link>
        </FcPanel>

        <div className={styles.groups}>
          <section aria-labelledby="settings-experience" className={styles.group}>
            <div className={styles.groupHeading}>
              <h2 id="settings-experience">Your experience</h2>
              <p>Make FC ARENA feel like home.</p>
            </div>
            <FcPanel className={styles.menu}>
            <FcMenuRow
              href="/settings/appearance"
              icon="◐"
              title="Appearance"
              description="Choose your FC ARENA theme and Light or Dark Mode"
              tone="cyan"
            />

            <FcMenuRow
              href="/settings/notifications"
              icon="●"
              title="Notifications"
              description="Review competition and system notifications"
              tone="slate"
            />

            <FcMenuRow
              href="/settings/dashboard"
              icon="▦"
              title="Dashboard"
              description="Choose which home sections are visible"
              tone="cyan"
            />
            </FcPanel>
          </section>

          <section aria-labelledby="settings-privacy" className={styles.group}>
            <div className={styles.groupHeading}>
              <h2 id="settings-privacy">Account & privacy</h2>
              <p>Your information and community controls.</p>
            </div>
            <FcPanel className={styles.menu}>
            <FcMenuRow href="/profile/date-of-birth" icon="◉" title="Date of birth" description={user.dateOfBirth ? 'Review or update your private date of birth' : 'Complete your player profile'} tone="slate" />
            <FcMenuRow
              href="/safety"
              icon="!"
              title="Safety & Reporting"
              description="Report inappropriate content and manage blocked players"
              tone="red"
            />

            <FcMenuRow
              href="/privacy"
              icon="◉"
              title="Privacy"
              description="Privacy and account data information"
              tone="slate"
            />
            </FcPanel>
          </section>
        </div>

        <section aria-labelledby="settings-data" className={styles.group}>
          <div className={styles.groupHeading}>
            <h2 id="settings-data">Account data</h2>
            <p>Review the request process before making a permanent change.</p>
          </div>
          <FcPanel className={styles.menu}>
            <FcMenuRow
              href="/account-deletion"
              icon="!"
              title="Delete Account & Data"
              description="Request permanent deletion of your FC ARENA account and associated personal data"
              tone="red"
            />
          </FcPanel>
        </section>
      </div>
    </AppShell>
  );
}
