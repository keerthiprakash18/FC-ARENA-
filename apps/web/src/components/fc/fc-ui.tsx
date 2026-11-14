'use client';

import Link from 'next/link';
import { FcDialog } from './fc-dialog';
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
  | 'gold'
  | 'red'
  | 'slate';

const toneClasses:
  Record<FcTone, string> = {
    cyan:
      'theme-tone-primary',
    emerald:
      'theme-tone-success',
    amber:
      'theme-tone-warning',
    gold:
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
  id,
}: {
  children:
    ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={
        'fc-panel theme-panel min-w-0 rounded-2xl border ' +
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
  icon,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: Parameters<typeof FcIcon>[0]['name'];
}) {
  return (
    <header className="fc-page-heading">
      {icon && <FcIcon className="fc-heading-mark" name={icon} />}
      <div className="fc-page-heading-copy">
        {eyebrow ? (
          <p className="fc-page-kicker">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="theme-text fc-display-strong">
          {title}
        </h1>

        {subtitle ? (
          <p className="fc-page-summary">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="fc-page-heading-actions">
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
    <div className="fc-section-heading flex flex-wrap items-end justify-between gap-3">
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
        'theme-status-badge inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ' +
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
    <article className="fc-metric theme-stat-card h-full rounded-2xl border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="fc-metric-label">
            {label}
          </p>

          <p className="fc-metric-value theme-text tabular-nums">
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
        <p className="theme-secondary-text mt-3 text-xs leading-5">
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
        'theme-crest premium-crest grid shrink-0 place-items-center overflow-hidden border font-semibold ' +
        sizeClass
      }
    >
      {imageUrl ? (
        <img
          src={
            imageUrl
          }
          loading="lazy"
          decoding="async"
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
    <FcPanel className="fc-empty-state fc-feedback">
      <div className="fc-feedback-mark" aria-hidden="true">
        <FcIcon name={icon} size={23} />
      </div>
      <div className="fc-feedback-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="theme-primary-button fc-feedback-action">
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
  embedded = false,
}: {
  label?: string;
  embedded?: boolean;
}) {
  return (
    <div
      className={embedded ? 'fc-loading-state w-full' : 'fc-loading-state theme-app-background min-h-dvh p-4 sm:p-6 lg:p-8'}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-[1180px] space-y-6" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <FcSkeleton className="h-3 w-28" />
            <FcSkeleton className="h-9 w-64 max-w-[48vw]" />
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

      </div>
      <p className="fc-loading-label">{label}</p>
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

  if (value === 'UCL_CUP') {
    return 'UCL Cup';
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
  title = 'Unable to complete this request',
  message,
  onRetry,
  retryLabel = 'Try again',
  busy = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
}) {
  return (
    <div
      className="fc-feedback fc-feedback-error theme-error-box"
      role="alert"
    >
      <span className="fc-feedback-mark" aria-hidden="true"><FcIcon name="alert" size={23} /></span>
      <div className="fc-feedback-copy">
        <h2>{title}</h2>
        <p>{message}</p>
      </div>

      {onRetry ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRetry}
          className="theme-secondary-button fc-feedback-action disabled:opacity-50"
        >
          {busy
            ? 'Retrying...'
            : retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function legFormatLabel(legType?: string, competitionFormat?: string) {
  const double = legType === 'HOME_AWAY' || competitionFormat === 'DOUBLE_ROUND_ROBIN';
  if (competitionFormat === 'GROUP_STAGE_KNOCKOUT') {
    return `${double ? 'Double-leg' : 'Single-leg'} groups · Single-leg knockout`;
  }
  if (double) return 'Double leg · Home & Away';
  return legType || competitionFormat ? 'Single leg' : 'Match format not specified';
}

export function FcNotice({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true" data-tone={tone} className={children ? 'fc-notice' : 'sr-only'}>
      {children ? <><span className="fc-notice-mark" aria-hidden="true"><FcIcon name={tone === 'error' ? 'alert' : 'check'} size={14} /></span><div>{children}</div></> : null}
    </div>
  );
}

export function FcUnauthorizedState({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <div role="alert">
      <FcEmptyState
        title={forbidden ? 'Access unavailable' : 'Sign in to continue'}
        description={forbidden ? 'Your account does not have access to this screen.' : 'Your session is unavailable. Sign in again to open this screen.'}
        icon="shield"
        actionLabel={forbidden ? 'Go to Dashboard' : 'Sign in'}
        actionHref={forbidden ? '/dashboard' : '/login'}
      />
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
  return (
    <FcDialog open={open} title={title} description={description} confirmLabel={confirmLabel} cancelLabel={cancelLabel} destructive={destructive} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />
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
      className="theme-action-row fc-quick-action-tile group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition duration-200 sm:p-5"
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
