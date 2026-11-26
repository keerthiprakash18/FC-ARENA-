"use client";

import Link from "next/link";

import { useRecoverableLoad } from '@/lib/use-recoverable-load';

import { useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import { useTheme } from "@/components/theme/theme-provider";

import { getCurrentUser, type CurrentUser } from "@/lib/auth-client";

import {
  DEFAULT_THEME_PREFERENCE,
  THEME_OPTIONS,
  type ThemeOption,
  type ThemePreference,
} from "@/lib/theme";

function ThemePreview({ option, dark }: { option: ThemeOption; dark: boolean }) {
  return (
    <div className="fc-signature-preview" data-preview-theme={option.dataTheme} data-preview-mode={dark ? "dark" : "light"} aria-hidden="true">
      <div className="fc-signature-art">
        <small>FC ARENA / SIGNATURE</small>
        <strong>{option.signature}</strong>
      </div>
      <div className="fc-signature-sample">
        <span>FC</span><span>Matchday · {dark ? "Night" : "Day"}</span>
      </div>
    </div>
  );
}

export default function AppearancePage() {

  const { themePreference, displayMode, resolvedDark, setThemePreference, setDisplayMode } =
    useTheme();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [saving, setSaving] = useState<ThemePreference | null>(null);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const initialLoad = useRecoverableLoad(async signal => {
    const current = await getCurrentUser({ signal });
    if (!signal.aborted) setUser(current);
  });

  async function chooseTheme(nextTheme: ThemePreference) {
    if (saving) {
      return;
    }

    setSaving(nextTheme);

    setError("");

    setMessage("");

    try {
      await setThemePreference(nextTheme, true);

      setUser((current) =>
        current
          ? {
              ...current,
              themePreference: nextTheme,
            }
          : current,
      );

      const option = THEME_OPTIONS.find(
        (item) => item.preference === nextTheme,
      );

      setMessage(
        `${option?.name ?? "Selected theme"} is now your saved FC ARENA theme.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save theme preference.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user) {
    return <FcLoadingScreen label="Loading Appearance..." />;
  }

  const playerName = user.player?.identity?.inGameName || user.fullName;

  return (
    <AppShell playerName={playerName}>
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
              title="Signature themes"
              subtitle="Choose your matchday identity. Your saved palette follows your account; previews follow this device’s display mode."
            />
          </div>
        </div>

        {message ? (
          <div role="status" className="rounded-xl border border-[var(--theme-success)] bg-[var(--theme-success-soft)] p-4 text-sm text-[var(--theme-success)]">
            {message}
          </div>
        ) : null}

        {error ? <FcErrorState message={error} /> : null}

        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--theme-primary)]">
                Display Mode
              </p>

              <h2 className="mt-1 text-lg font-bold">Light, Dark or Device</h2>

              <p className="mt-1 max-w-2xl text-sm text-[var(--theme-text-muted)]">
                Dark Mode reduces screen brightness for a more comfortable FC
                ARENA experience, especially at night.
              </p>
            </div>

            <div className="theme-elevated flex flex-wrap w-full gap-2 rounded-xl border p-1.5 sm:w-auto">
              <button
                type="button"
                aria-pressed={displayMode === "LIGHT"}
                onClick={() => {
                  setDisplayMode("LIGHT");

                  setMessage("Light Mode applied.");
                }}
                className={
                  "min-h-11 flex-1 rounded-[9px] px-5 text-sm font-semibold transition sm:flex-none " +
                  (displayMode === "LIGHT"
                    ? "theme-primary-button"
                    : "theme-secondary-button")
                }
              >
                ☀ Light
              </button>

              <button
                type="button"
                aria-pressed={displayMode === "DARK"}
                onClick={() => {
                  setDisplayMode("DARK");

                  setMessage("Dark Mode applied and saved on this device.");
                }}
                className={
                  "min-h-11 flex-1 rounded-[9px] px-5 text-sm font-semibold transition sm:flex-none " +
                  (displayMode === "DARK"
                    ? "theme-primary-button"
                    : "theme-secondary-button")
                }
              >
                ◐ Dark
              </button>
              <button type="button" aria-pressed={displayMode === "SYSTEM"} onClick={() => { setDisplayMode("SYSTEM"); setMessage("Following your device appearance."); }} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${displayMode === "SYSTEM" ? "theme-primary-button" : "theme-secondary-button"}`}>Use device theme</button>
            </div>
          </div>
        </FcPanel>

        <div className="space-y-2"><h2 className="text-xl font-bold">Signature collection</h2><p className="text-sm text-[var(--theme-text-muted)]">Original FC ARENA artwork. Club-inspired palettes are unofficial fan themes and do not imply affiliation or endorsement.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const current = themePreference === option.preference;

            return (
              <FcPanel
                key={option.preference}
                className={
                  current ? "theme-selected-card p-5 sm:p-6" : "p-5 sm:p-6"
                }
              >
                <ThemePreview option={option} dark={resolvedDark} />

                <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{option.name}</h3>
                    <p className="mt-1 text-sm font-semibold">{option.signature}</p>

                    <p className="mt-1 text-sm font-semibold text-[var(--theme-primary)]">
                      {option.palette}
                    </p>

                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-muted)]">
                      {option.inspiration}
                    </p>

                    <p className="mt-2 text-sm text-[var(--theme-text-muted)]">
                      {option.description}
                    </p>
                  </div>

                  {current ? (
                    <FcStatusBadge label="✓ CURRENT THEME" tone="emerald" />
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label={`${current ? "Current theme:" : "Use theme:"} ${option.name}`}
                  disabled={saving !== null || current}
                  onClick={() => void chooseTheme(option.preference)}
                  className="theme-primary-button mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[11px] px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saving === option.preference
                    ? "Applying..."
                    : current
                      ? "Current Theme"
                      : "Use Theme"}
                </button>
              </FcPanel>
            );
          })}
        </div>

        <FcPanel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="font-semibold">Reset Appearance</h2>

            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
              Reset your saved colour palette to Luxury Gold (Cream, Navy and Gold).
            </p>
          </div>

          <button
            type="button"
            disabled={
              saving !== null || themePreference === DEFAULT_THEME_PREFERENCE
            }
            onClick={() => void chooseTheme(DEFAULT_THEME_PREFERENCE)}
            className="theme-secondary-button min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50"
          >
            Reset to Default
          </button>
        </FcPanel>
      </div>
    </AppShell>
  );
}
