'use client';

import { useAppLanguage } from '@/components/i18n/app-language';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';

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
  const { language, setLanguage } = useAppLanguage();


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
          eyebrow="Account"
          title="Settings"
          subtitle="Manage appearance and account preferences."
        />


        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--theme-border)] pb-5">
            <div>
              <h2 className="theme-text text-lg font-semibold">App language · பயன்பாட்டு மொழி</h2>
              <p className="theme-secondary-text mt-1 max-w-xl text-sm leading-6">
                {language === 'ta'
                  ? 'மெனு மற்றும் முக்கிய வழிசெலுத்தலுக்கு தமிழ் பயன்படுத்தவும். மொழிபெயர்க்கப்படாத பக்கங்கள் ஆங்கிலத்திலேயே இருக்கும்.'
                  : 'Choose English or Tamil for navigation. Untranslated screens remain in English while localization expands.'}
              </p>
            </div>
            <div role="group" aria-label="App language" className="inline-flex rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-1">
              <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}
                className={`${language === 'en' ? 'theme-primary-button' : 'theme-secondary-button'} min-h-11 rounded-lg px-4 text-sm font-semibold`}>
                English
              </button>
              <button type="button" aria-pressed={language === 'ta'} onClick={() => setLanguage('ta')}
                className={`${language === 'ta' ? 'theme-primary-button' : 'theme-secondary-button'} min-h-11 rounded-lg px-4 text-sm font-semibold`}>
                தமிழ்
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <FcMenuRow href="/profile/date-of-birth" icon="◉" title="Date of birth" description={user.dateOfBirth ? 'Review or update your private date of birth' : 'Complete your player profile'} tone="slate" />
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
