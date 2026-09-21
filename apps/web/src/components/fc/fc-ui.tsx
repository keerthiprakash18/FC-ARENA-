'use client';

import Link from 'next/link';
import type {
  ReactNode,
} from 'react';

import {
  FcIcon,
  iconNameFromLegacy,
} from './fc-icons';

export type FcTone =
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'slate';

const toneClasses:
  Record<FcTone, string> = {
    cyan:
      'theme-tone-primary',
    emerald:
      'theme-tone-success',
    amber:
      'theme-tone-premium',
    red:
      'theme-tone-danger',
    slate:
      'theme-tone-neutral',
  };

function renderIcon(
  icon:
    ReactNode,
  fallback:
    Parameters<
      typeof FcIcon
    >[0]['name'],
) {
  if (
    typeof icon ===
    'string' ||
    icon ===
    undefined ||
    icon ===
    null
  ) {
    return (
      <FcIcon
        name={
          iconNameFromLegacy(
            icon,
            fallback,
          )
        }
        size={20}
      />
    );
  }

  return icon;
}

export function FcPanel({
  children,
  className = '',
}: {
  children:
    ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        'theme-panel rounded-2xl border ' +
        className
      }
    >
      {children}
    </section>
  );
}

export function FcPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="theme-muted text-xs font-medium">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="theme-text fc-display-strong mt-1 text-[28px] leading-tight sm:text-[34px]">
          {title}
        </h1>

        {subtitle ? (
          <p className="theme-secondary-text mt-2 max-w-2xl text-sm leading-6">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </header>
  );
}

export function FcSectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="theme-muted text-xs font-medium">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="theme-text fc-display mt-1 text-[18px] font-semibold sm:text-[20px]">
          {title}
        </h2>
      </div>

      {action}
    </div>
  );
}

export function FcStatusBadge({
  label,
  tone = 'slate',
}: {
  label: string;
  tone?: FcTone;
}) {
  return (
    <span
      className={
        'inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium ' +
        toneClasses[tone]
      }
    >
      {label.replaceAll(
        '_',
        ' ',
      )}
    </span>
  );
}

export function FcStatCard({
  label,
  value,
  detail,
  tone = 'cyan',
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: FcTone;
  icon?: ReactNode;
}) {
  const fallback =
    /win/i.test(
      label,
    )
      ? 'trophy'
      : /goal/i.test(
            label,
          )
        ? 'football'
        : /match/i.test(
              label,
            )
          ? 'fixtures'
          : /rank|rate|stat/i.test(
                label,
              )
            ? 'chart'
            : 'activity';

  return (
    <article className="theme-stat-card h-full min-h-[138px] rounded-2xl border p-5 transition duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="theme-secondary-text fc-display text-[13px] font-medium">
            {label}
          </p>

          <p className="theme-text fc-display-strong mt-1 text-[28px] leading-none sm:text-[30px]">
            {value}
          </p>
        </div>

        <span
          className={
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl border ' +
            toneClasses[tone]
          }
          aria-hidden="true"
        >
          {renderIcon(
            icon,
            fallback,
          )}
        </span>
      </div>

      {detail ? (
        <p className="theme-muted mt-3 text-xs leading-5">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

export function FcCrest({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string;
  imageUrl?: string | null;
  size?:
    | 'sm'
    | 'md'
    | 'lg';
}) {
  const sizeClass =
    size ===
    'lg'
      ? 'h-14 w-14 rounded-2xl text-base'
      : size ===
          'sm'
        ? 'h-9 w-9 rounded-xl text-[10px]'
        : 'h-11 w-11 rounded-xl text-sm';

  const initials =
    name
      .split(
        /\s+/,
      )
      .map(
        (
          part,
        ) =>
          part[0],
      )
      .join('')
      .slice(
        0,
        2,
      )
      .toUpperCase();

  return (
    <div
      className={
        'theme-crest grid shrink-0 place-items-center overflow-hidden border font-semibold ' +
        sizeClass
      }
    >
      {imageUrl ? (
        <img
          src={
            imageUrl
          }
          alt={
            name +
            ' crest'
          }
          className="h-full w-full object-cover"
        />
      ) : (
        initials ||
        'FC'
      )}
    </div>
  );
}

export function FcEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon = 'football',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?:
    Parameters<
      typeof FcIcon
    >[0]['name'];
}) {
  return (
    <FcPanel className="border-dashed p-7 text-center sm:p-8">
      <div className="theme-soft-accent mx-auto grid h-12 w-12 place-items-center rounded-xl border">
        <FcIcon
          name={
            icon
          }
          size={22}
        />
      </div>

      <h3 className="theme-text mt-4 text-lg font-semibold">
        {title}
      </h3>

      <p className="theme-secondary-text mx-auto mt-2 max-w-lg text-sm leading-6">
        {description}
      </p>

      {actionLabel &&
      actionHref ? (
        <Link
          href={
            actionHref
          }
          className="theme-primary-button mt-5 inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold transition"
        >
          {actionLabel}
        </Link>
      ) : null}
    </FcPanel>
  );
}

export function FcSkeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={
        'fc-skeleton rounded-xl ' +
        className
      }
    />
  );
}

export function FcLoadingScreen({
  label =
    'Loading FC ARENA...',
}: {
  label?: string;
}) {
  return (
    <div
      className="theme-app-background min-h-screen p-4 sm:p-6 lg:p-8"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">
        {label}
      </span>

      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <FcSkeleton className="h-3 w-28" />
            <FcSkeleton className="h-9 w-64 max-w-[72vw]" />
          </div>

          <FcSkeleton className="h-11 w-28" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            0,
            1,
            2,
            3,
          ].map(
            (
              item,
            ) => (
              <div
                key={
                  item
                }
                className="theme-panel rounded-2xl border p-5"
              >
                <FcSkeleton className="h-3 w-20" />
                <FcSkeleton className="mt-4 h-8 w-24" />
                <FcSkeleton className="mt-4 h-3 w-full" />
              </div>
            ),
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            0,
            1,
          ].map(
            (
              item,
            ) => (
              <div
                key={
                  item
                }
                className="theme-panel rounded-2xl border p-5"
              >
                <FcSkeleton className="h-4 w-36" />
                <FcSkeleton className="mt-5 h-28 w-full" />
              </div>
            ),
          )}
        </div>

        <p className="theme-muted text-center text-xs">
          {label}
        </p>
      </div>
    </div>
  );
}

export function FcActionRow({
  href,
  icon,
  title,
  description,
  badge,
  tone = 'cyan',
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?:
    | string
    | number;
  tone?: FcTone;
}) {
  return (
    <Link
      href={
        href
      }
      className="theme-action-row group flex min-h-[78px] items-center gap-4 rounded-2xl border p-4 transition duration-200"
    >
      <span
        className={
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl border ' +
          toneClasses[tone]
        }
        aria-hidden="true"
      >
        <FcIcon
          name={
            iconNameFromLegacy(
              icon,
              'activity',
            )
          }
          size={19}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="theme-text fc-display block text-[15px] font-semibold">
          {title}
        </span>

        <span className="theme-muted mt-0.5 block text-xs leading-5">
          {description}
        </span>
      </span>

      {badge !==
      undefined ? (
        <span className="theme-soft-accent rounded-lg border px-2.5 py-1 text-[11px] font-semibold">
          {badge}
        </span>
      ) : null}

      <span
        className="theme-action-chevron"
        aria-hidden="true"
      >
        <FcIcon
          name="chevronRight"
          size={17}
        />
      </span>
    </Link>
  );
}

export function competitionLabel(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return 'Tournament';
  }

  return value
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}

export function FcErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div
      className="theme-error-box rounded-2xl border p-4 text-sm"
      role="alert"
    >
      {message}
    </div>
  );
}

export function FcMenuRow(
  props:
    Parameters<
      typeof FcActionRow
    >[0],
) {
  return (
    <FcActionRow
      {...props}
    />
  );
}

export function FcConfirmDialog({
  open,
  title,
  description,
  confirmLabel =
    'Confirm',
  cancelLabel =
    'Cancel',
  destructive =
    false,
  busy =
    false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="theme-dialog-overlay fixed inset-0 z-[80] grid place-items-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fc-dialog-title"
        className="theme-dialog w-full max-w-md rounded-2xl border p-5"
      >
        <h2
          id="fc-dialog-title"
          className="theme-text text-lg font-semibold"
        >
          {title}
        </h2>

        <p className="theme-secondary-text mt-2 text-sm leading-6">
          {description}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              onCancel
            }
            className="theme-secondary-button min-h-11 rounded-[10px] border px-4 text-sm font-medium disabled:opacity-40"
          >
            {
              cancelLabel
            }
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              onConfirm
            }
            className={
              'min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-40 ' +
              (
                destructive
                  ? 'theme-danger-button border'
                  : 'theme-primary-button'
              )
            }
          >
            {busy
              ? 'Working...'
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FcQuickActionTile({
  href,
  icon,
  title,
  description,
  tone = 'cyan',
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  tone?: FcTone;
}) {
  return (
    <Link
      href={
        href
      }
      className="theme-action-row group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition duration-200 sm:p-5"
    >
      <span
        className={
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl border ' +
          toneClasses[tone]
        }
        aria-hidden="true"
      >
        {renderIcon(
          icon,
          'activity',
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="theme-text fc-display block text-[15px] font-semibold">
          {title}
        </span>

        <span className="theme-muted mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>

      <span
        className="theme-action-chevron"
        aria-hidden="true"
      >
        <FcIcon
          name="chevronRight"
          size={17}
        />
      </span>
    </Link>
  );
}
