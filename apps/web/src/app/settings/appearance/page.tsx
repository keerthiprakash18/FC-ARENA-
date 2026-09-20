'use client';

import Link from 'next/link';

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
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  useTheme,
} from '@/components/theme/theme-provider';

import {
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  DEFAULT_THEME_PREFERENCE,
  THEME_OPTIONS,
  type ThemePreference,
} from '@/lib/theme';


function ThemePreview({
  preference,
}: {
  preference:
    ThemePreference;
}) {
  const gold =
    preference ===
    'LUXURY_GOLD';

  return (
    <div
      className={
        gold
          ? 'overflow-hidden rounded-2xl border border-[#DED8CD] bg-[#F7F3EB]'
          : 'overflow-hidden rounded-2xl border border-[#DCE5F1] bg-[#F5F8FD]'
      }
    >
      <div className="grid min-h-[180px] grid-cols-[70px_1fr]">
        <div
          className={
            gold
              ? 'bg-[#061E35] p-3'
              : 'border-r border-[#DCE5F1] bg-white p-3'
          }
        >
          <div
            className={
              gold
                ? 'h-7 w-7 rounded-lg border border-[#D5AE5C]/45 bg-[#0B2545]'
                : 'h-7 w-7 rounded-lg bg-[#E8F2FF]'
            }
          />

          <div className="mt-5 space-y-2">
            <div
              className={
                gold
                  ? 'h-6 rounded-md bg-[#D5AE5C]/20'
                  : 'h-6 rounded-md bg-[#1478F2]'
              }
            />

            <div
              className={
                gold
                  ? 'h-6 rounded-md bg-white/[0.06]'
                  : 'h-6 rounded-md bg-[#F5F8FD]'
              }
            />

            <div
              className={
                gold
                  ? 'h-6 rounded-md bg-white/[0.06]'
                  : 'h-6 rounded-md bg-[#F5F8FD]'
              }
            />
          </div>
        </div>


        <div className="p-3">
          <div
            className={
              gold
                ? 'h-7 rounded-lg border border-[#DED8CD] bg-[#FFFDF9]'
                : 'h-7 rounded-lg border border-[#DCE5F1] bg-white'
            }
          />

          <div
            className={
              gold
                ? 'mt-3 h-12 rounded-xl border border-[#DED8CD] bg-[#FFFDF9]'
                : 'mt-3 h-12 rounded-xl bg-[linear-gradient(120deg,#E6F2FF,#CFE8FF)]'
            }
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map(
              (
                item,
              ) => (
                <div
                  key={
                    item
                  }
                  className={
                    gold
                      ? 'h-10 rounded-lg border border-[#DED8CD] bg-[#FFFDF9]'
                      : 'h-10 rounded-lg border border-[#DCE5F1] bg-white'
                  }
                />
              ),
            )}
          </div>

          <div
            className={
              gold
                ? 'mt-3 h-8 w-24 rounded-lg bg-[#C9972D]'
                : 'mt-3 h-8 w-24 rounded-lg bg-[#1478F2]'
            }
          />
        </div>
      </div>
    </div>
  );
}


export default function AppearancePage() {
  const router =
    useRouter();

  const {
    themePreference,
    setThemePreference,
  } =
    useTheme();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    saving,
    setSaving,
  ] =
    useState<ThemePreference | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');


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


  async function chooseTheme(
    nextTheme:
      ThemePreference,
  ) {
    if (
      saving
    ) {
      return;
    }

    setSaving(
      nextTheme,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      await setThemePreference(
        nextTheme,
        true,
      );

      setUser(
        (
          current,
        ) =>
          current
            ? {
                ...current,
                themePreference:
                  nextTheme,
              }
            : current,
      );

      setMessage(
        nextTheme ===
        'LUXURY_GOLD'
          ? 'Luxury Gold is now your saved FC ARENA theme.'
          : 'Classic Blue is now your saved FC ARENA theme.',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save theme preference.',
      );
    } finally {
      setSaving(
        null,
      );
    }
  }


  if (
    !user
  ) {
    return (
      <FcLoadingScreen
        label="Loading Appearance..."
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
    >
      <div className="space-y-6">
        <div>
          <Link
            href="/settings"
            className="theme-text-link inline-flex min-h-10 items-center text-sm font-semibold"
          >
            ← Back to Settings
          </Link>

          <div className="mt-2">
            <FcPageHeader
              eyebrow="Settings · Appearance"
              title="Theme"
              subtitle="Choose how FC ARENA looks for your account. Your preference follows you when you sign in again."
            />
          </div>
        </div>


        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-700">
            {
              message
            }
          </div>
        ) : null}


        {error ? (
          <FcErrorState
            message={
              error
            }
          />
        ) : null}


        <div className="grid gap-5 xl:grid-cols-2">
          {THEME_OPTIONS.map(
            (
              option,
            ) => {
              const current =
                themePreference ===
                option.preference;

              return (
                <FcPanel
                  key={
                    option.preference
                  }
                  className={
                    current
                      ? 'theme-selected-card p-5 sm:p-6'
                      : 'p-5 sm:p-6'
                  }
                >
                  <ThemePreview
                    preference={
                      option.preference
                    }
                  />


                  <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        {
                          option.name
                        }
                      </h2>

                      <p className="mt-1 text-sm font-semibold text-[var(--theme-primary)]">
                        {
                          option.palette
                        }
                      </p>

                      <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
                        {
                          option.description
                        }
                      </p>
                    </div>

                    {current ? (
                      <FcStatusBadge
                        label="✓ Current Theme"
                        tone="emerald"
                      />
                    ) : null}
                  </div>


                  <button
                    type="button"
                    disabled={
                      saving !==
                      null ||
                      current
                    }
                    onClick={() =>
                      void chooseTheme(
                        option.preference,
                      )
                    }
                    className="theme-primary-button mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[11px] px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {saving ===
                    option.preference
                      ? 'Applying...'
                      : current
                        ? 'Current Theme'
                        : 'Use Theme'}
                  </button>
                </FcPanel>
              );
            },
          )}
        </div>


        <FcPanel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-semibold">
              Reset Appearance
            </h2>

            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              New FC ARENA accounts use Classic Blue by default.
            </p>
          </div>

          <button
            type="button"
            disabled={
              saving !==
                null ||
              themePreference ===
                DEFAULT_THEME_PREFERENCE
            }
            onClick={() =>
              void chooseTheme(
                DEFAULT_THEME_PREFERENCE,
              )
            }
            className="theme-secondary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50"
          >
            Reset to Default
          </button>
        </FcPanel>
      </div>
    </AppShell>
  );
}
