'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type FcTone =
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'red'
  | 'slate';

const toneClasses: Record<FcTone, string> = {
  cyan:
    'border-[#0B2545]/15 bg-[#0B2545]/[0.05] text-[#0B2545]',
  emerald:
    'border-[#1F9D68]/20 bg-[#1F9D68]/[0.06] text-[#1F9D68]',
  amber:
    'border-[#C9972D]/25 bg-[#F5E8C8] text-[#9B6E14]',
  red:
    'border-[#D94B4B]/20 bg-[#D94B4B]/[0.05] text-[#D94B4B]',
  slate:
    'border-[#E4DFD5] bg-[#F3EFE6] text-[#667085]',
};

export function FcPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#E4DFD5] bg-[#FFFDF9] shadow-[0_8px_24px_rgba(16,33,58,0.06)] ${className}`}
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
          <p className="text-xs font-medium text-[#8B95A5]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="fc-display-strong mt-1 text-[28px] text-[#10213A] sm:text-[34px]">
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
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
          <p className="text-xs font-medium text-[#8B95A5]">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="fc-display mt-1 text-[18px] font-semibold text-[#10213A] sm:text-[20px]">
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClasses[tone]}`}
    >
      {label.replaceAll('_', ' ')}
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
  const iconClass =
    tone === 'emerald'
      ? 'text-[#1F9D68] bg-[#1F9D68]/[0.08] border-[#1F9D68]/15'
      : tone === 'amber'
        ? 'text-[#9B6E14] bg-[#F5E8C8] border-[#D5AE5C]/35'
        : tone === 'red'
          ? 'text-[#D94B4B] bg-[#D94B4B]/[0.06] border-[#D94B4B]/15'
          : tone === 'slate'
            ? 'text-[#667085] bg-white/[0.035] border-white/[0.06]'
            : 'text-[#0B2545] bg-[#F3EFE6] border-[#D8D2C8]';

  return (
    <article className="h-full rounded-2xl border border-[#E4DFD5] bg-[#FFFDF9] p-4 shadow-[0_8px_20px_rgba(16,33,58,0.055)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D5AE5C]/55 hover:shadow-[0_12px_26px_rgba(16,33,58,0.075)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="fc-display text-[13px] font-medium text-[#667085]">
            {label}
          </p>

          <p className="fc-display-strong mt-1 text-[28px] leading-none text-[#10213A] sm:text-[30px]">
            {value}
          </p>
        </div>

        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-xl ${iconClass}`}
        >
          {icon ?? '•'}
        </span>
      </div>

      {detail ? (
        <p className="mt-3 text-xs leading-5 text-[#8B95A5]">
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
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'lg'
      ? 'h-14 w-14 rounded-2xl text-base'
      : size === 'sm'
        ? 'h-9 w-9 rounded-xl text-[10px]'
        : 'h-11 w-11 rounded-xl text-sm';

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden border border-[#E4DFD5] bg-[#F5E8C8] font-semibold text-[#9B6E14] ${sizeClass}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        initials || 'FC'
      )}
    </div>
  );
}

export function FcEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <FcPanel className="border-dashed p-7 text-center sm:p-8">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[#E4DFD5] bg-[#F5E8C8] text-lg text-[#9B6E14]">
        ⚽
      </div>

      <h3 className="mt-4 text-lg font-semibold text-[#10213A]">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#667085]">
        {description}
      </p>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex min-h-11 items-center rounded-[10px] bg-[#C9972D] px-4 text-sm font-semibold text-white transition hover:bg-[#B98924]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </FcPanel>
  );
}

export function FcLoadingScreen({
  label = 'Loading FC ARENA...',
}: {
  label?: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F8F5EE] text-sm font-medium text-[#8B95A5]">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#C9972D]" />
        {label}
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
  badge?: string | number;
  tone?: FcTone;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-[#E4DFD5] bg-[#FFFDF9] p-4 transition duration-200 hover:border-[#D5AE5C]/45 hover:bg-[#FFFDF9] hover:shadow-[0_8px_20px_rgba(16,33,58,0.05)]"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-base ${toneClasses[tone]}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="fc-display block text-[15px] font-semibold text-[#10213A]">
          {title}
        </span>

        <span className="mt-0.5 block text-xs leading-5 text-[#8B95A5]">
          {description}
        </span>
      </span>

      {badge !== undefined ? (
        <span className="rounded-full bg-[#F5E8C8] px-2.5 py-1 text-[10px] font-semibold text-[#9B6E14]">
          {badge}
        </span>
      ) : null}

      <span className="text-[#8B95A5] transition group-hover:translate-x-0.5 group-hover:text-[#19B7FF]">
        ›
      </span>
    </Link>
  );
}

export function competitionLabel(value: string | null | undefined) {
  if (!value) return 'Tournament';

  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function FcErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D94B4B]/20 bg-[#D94B4B]/[0.05] p-4 text-sm text-[#D94B4B]">
      {message}
    </div>
  );
}

export function FcMenuRow(
  props: Parameters<typeof FcActionRow>[0],
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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#071E35]/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[#E4DFD5] bg-[#FFFDF9] p-5 shadow-[0_18px_44px_rgba(16,33,58,0.16)]"
      >
        <h2 className="text-lg font-semibold text-[#10213A]">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#667085]">
          {description}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-[10px] border border-[#203141] bg-transparent px-4 text-sm font-medium text-[#667085] hover:bg-[#121D28] disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-40 ${
              destructive
                ? 'border border-red-400/25 bg-red-400/[0.08] text-red-300 hover:bg-red-400/[0.12]'
                : 'bg-[#C9972D] text-white hover:bg-[#B98924]'
            }`}
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
  const accent =
    tone === 'emerald'
      ? 'text-[#1F9D68] bg-[#1F9D68]/[0.07] border-[#1F9D68]/20'
      : tone === 'amber'
        ? 'text-[#9B6E14] bg-[#F5E8C8] border-[#D5AE5C]/35'
        : tone === 'red'
          ? 'text-[#D94B4B] bg-[#D94B4B]/[0.05] border-[#D94B4B]/20'
          : tone === 'slate'
            ? 'text-[#667085] bg-white/[0.035] border-white/[0.06]'
            : 'text-[#0B2545] bg-[#F3EFE6] border-[#D8D2C8]';

  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-4 rounded-2xl border border-[#E4DFD5] bg-[#FFFDF9] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#D5AE5C]/45 hover:shadow-[0_10px_22px_rgba(16,33,58,0.06)] sm:p-5"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-lg ${accent}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="fc-display block text-[15px] font-semibold text-[#10213A]">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-[#8B95A5]">
          {description}
        </span>
      </span>

      <span className="text-lg text-[#8B95A5] transition group-hover:translate-x-0.5 group-hover:text-[#C9972D]">
        →
      </span>
    </Link>
  );
}
