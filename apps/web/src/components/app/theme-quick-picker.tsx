'use client';

import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

import {
  useTheme,
} from '@/components/theme/theme-provider';

import {
  THEME_OPTIONS,
  type ThemePreference,
} from '@/lib/theme';

export function ThemeQuickPicker() {
  const {
    themePreference,
    setThemePreference,
  } = useTheme();

  const rootRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState<ThemePreference | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const currentOption =
    THEME_OPTIONS.find(
      (
        option,
      ) =>
        option.preference ===
        themePreference,
    ) ??
    THEME_OPTIONS[0];

  useEffect(
    () => {
      if (!open) {
        return;
      }

      function onPointerDown(
        event:
          MouseEvent,
      ) {
        if (
          rootRef.current &&
          !rootRef.current.contains(
            event.target as Node,
          )
        ) {
          setOpen(false);
        }
      }

      function onKeyDown(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key ===
          'Escape'
        ) {
          setOpen(false);
        }
      }

      document.addEventListener(
        'mousedown',
        onPointerDown,
      );

      window.addEventListener(
        'keydown',
        onKeyDown,
      );

      return () => {
        document.removeEventListener(
          'mousedown',
          onPointerDown,
        );

        window.removeEventListener(
          'keydown',
          onKeyDown,
        );
      };
    },
    [
      open,
    ],
  );

  async function chooseTheme(
    nextTheme:
      ThemePreference,
  ) {
    if (
      saving ||
      nextTheme ===
        themePreference
    ) {
      if (
        nextTheme ===
        themePreference
      ) {
        setOpen(false);
      }

      return;
    }

    setSaving(
      nextTheme,
    );

    setError(
      '',
    );

    try {
      await setThemePreference(
        nextTheme,
        true,
      );

      setOpen(
        false,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : 'Unable to save theme.',
      );
    } finally {
      setSaving(
        null,
      );
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        aria-label="Choose club theme"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Club Themes"
        onClick={() => {
          setError('');
          setOpen(
            (
              current,
            ) =>
              !current,
          );
        }}
        className="theme-profile-chip theme-text relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-transparent transition duration-200"
      >
        <FcIcon
          name="football"
          size={19}
        />

        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--theme-header)] shadow-sm"
          style={{
            background:
              currentOption.preview
                .accent,
          }}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose FC Arena club theme"
          className="theme-elevated fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[80] overflow-hidden rounded-2xl border border-[var(--theme-border)] shadow-[0_22px_64px_rgba(0,0,0,0.24)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-[390px]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--theme-border)] p-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--theme-primary)]">
                Club Collection
              </p>

              <h2 className="mt-1 text-sm font-bold text-[var(--theme-text)]">
                Choose your matchday look
              </h2>

              <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
                Theme changes apply instantly and sync to your account.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close club theme picker"
              onClick={() =>
                setOpen(
                  false,
                )
              }
              className="theme-secondary-button grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
            >
              ×
            </button>
          </div>

          <div className="max-h-[56vh] overflow-y-auto p-3 sm:max-h-[430px]">
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map(
                (
                  option,
                ) => {
                  const selected =
                    option.preference ===
                    themePreference;

                  return (
                    <button
                      key={
                        option.preference
                      }
                      type="button"
                      aria-pressed={
                        selected
                      }
                      disabled={
                        saving !==
                        null
                      }
                      onClick={() =>
                        void chooseTheme(
                          option.preference,
                        )
                      }
                      className={
                        'min-h-[92px] rounded-xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ' +
                        (
                          selected
                            ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]'
                            : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-primary)]'
                        )
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          aria-hidden="true"
                          className="flex items-center gap-1"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{
                              background:
                                option.preview
                                  .accent,
                            }}
                          />

                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{
                              background:
                                option.preview
                                  .sidebar,
                            }}
                          />

                          <span
                            className="h-4 w-4 rounded-full border border-black/10"
                            style={{
                              background:
                                option.preview
                                  .surface,
                            }}
                          />
                        </span>

                        {selected ? (
                          <span className="text-xs font-black text-[var(--theme-primary)]">
                            ✓
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-2 block truncate text-xs font-bold text-[var(--theme-text)]">
                        {
                          option.name
                        }
                      </span>

                      <span className="mt-1 block truncate text-[10px] font-semibold text-[var(--theme-text-muted)]">
                        {
                          option.inspiration
                        }
                      </span>

                      {saving ===
                      option.preference ? (
                        <span className="mt-1 block text-[10px] font-bold text-[var(--theme-primary)]">
                          Applying…
                        </span>
                      ) : null}
                    </button>
                  );
                },
              )}
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs text-red-500"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-[var(--theme-border)] p-3">
            <Link
              href="/settings/appearance"
              onClick={() =>
                setOpen(
                  false,
                )
              }
              className="theme-secondary-button flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold"
            >
              <FcIcon
                name="settings"
                size={15}
              />
              Full Appearance Settings
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
