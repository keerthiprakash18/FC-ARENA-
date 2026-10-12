"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";

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

function ThemePreview({ option }: { option: ThemeOption }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: option.preview.accent + "33",
        background: option.preview.background,
      }}
    >
      <div className="grid min-h-[180px] grid-cols-[70px_1fr]">
        <div
          className="p-3"
          style={{ background: option.preview.sidebar }}
        >
          <div
            className="h-7 w-7 rounded-lg border"
            style={{
              borderColor: option.preview.accent + "66",
              background: option.preview.accent + "22",
            }}
          />

          <div className="mt-5 space-y-2">
            <div
              className="h-6 rounded-md"
              style={{ background: option.preview.accent }}
            />
            <div className="h-6 rounded-md bg-white/10" />
            <div className="h-6 rounded-md bg-white/10" />
          </div>
        </div>

        <div className="p-3">
          <div
            className="h-7 rounded-lg border"
            style={{
              borderColor: option.preview.accent + "2b",
              background: option.preview.surface,
            }}
          />

          <div
            className="mt-3 h-12 rounded-xl border"
            style={{
              borderColor: option.preview.accent + "33",
              background:
                "linear-gradient(120deg, " +
                option.preview.surface +
                ", " +
                option.preview.accent +
                "22)",
            }}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-10 rounded-lg border"
                style={{
                  borderColor: option.preview.accent + "22",
                  background: option.preview.surface,
                }}
              />
            ))}
          </div>

          <div
            className="mt-3 h-8 w-24 rounded-lg"
            style={{ background: option.preview.accent }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const router = useRouter();

  const { themePreference, displayMode, setThemePreference, setDisplayMode } =
    useTheme();

  const [user, setUser] = useState<CurrentUser | null>(null);

  const [saving, setSaving] = useState<ThemePreference | null>(null);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setUser(await getCurrentUser());
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

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
              title="Theme"
              subtitle="Choose how FC ARENA looks for your account. Your preference follows you when you sign in again."
            />
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-700">
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const current = themePreference === option.preference;

            return (
              <FcPanel
                key={option.preference}
                className={
                  current ? "theme-selected-card p-5 sm:p-6" : "p-5 sm:p-6"
                }
              >
                <ThemePreview option={option} />

                <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{option.name}</h2>

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
