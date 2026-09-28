'use client';

import {
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcLoadingScreen,
  FcMenuRow,
  FcPageHeader,
  FcPanel,
} from '@/components/fc/fc-ui';

import {
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


export default function SettingsPage() {
  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );


  useEffect(() => {
    void (async () => {
      try {
        setUser(
          await getCurrentUser(),
        );
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);


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
          eyebrow="Account"
          title="Settings"
          subtitle="Manage appearance and account preferences."
        />


        <FcPanel className="p-5 sm:p-6">
          <div className="grid gap-3">
            <FcMenuRow
              href="/settings/appearance"
              icon="◐"
              title="Appearance"
              description="Choose your FC ARENA theme and Light or Dark Mode"
              tone="cyan"
            />

            <FcMenuRow
              href="/notifications"
              icon="●"
              title="Notifications"
              description="Review competition and system notifications"
              tone="slate"
            />

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

            <FcMenuRow
              href="/account-deletion"
              icon="!"
              title="Delete Account & Data"
              description="Request permanent deletion of your FC ARENA account and associated personal data"
              tone="red"
            />
          </div>
        </FcPanel>
      </div>
    </AppShell>
  );
}
