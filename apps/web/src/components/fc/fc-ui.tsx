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
    'border-sky-400/20 bg-sky-400/[0.06] text-sky-300',
  emerald:
    'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300',
  amber:
    'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
  red:
    'border-red-400/20 bg-red-400/[0.06] text-red-300',
  slate:
    'border-[#203141] bg-[#121D28] text-[#A7B0BE]',
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
      className={`rounded-2xl border border-[#203141] bg-[#101923] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ${className}`}
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
          <p className="text-xs font-medium text-[#6F7B8A]">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-[#F8FAFC] sm:text-[32px]">
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A7B0BE]">
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
          <p className="text-xs font-medium text-[#6F7B8A]">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-[#F8FAFC] sm:text-xl">
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
      ? 'text-[#1FD18A]'
      : tone === 'amber'
        ? 'text-[#F3B326]'
        : tone === 'red'
          ? 'text-[#EF5350]'
          : tone === 'slate'
            ? 'text-[#A7B0BE]'
            : 'text-[#19B7FF]';

  return (
    <article className="h-full rounded-2xl border border-[#203141] bg-[#101923] p-4 shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-[#2D4356] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#8290A0]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#F8FAFC] sm:text-[28px]">
            {value}
          </p>
        </div>

        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-base ${iconClass}`}
        >
          {icon ?? '•'}
        </span>
      </div>

      {detail ? (
        <p className="mt-3 text-xs leading-5 text-[#6F7B8A]">
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
      className={`grid shrink-0 place-items-center overflow-hidden border border-[#284154] bg-[#14212D] font-semibold text-[#19B7FF] ${sizeClass}`}
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
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[#284154] bg-[#121D28] text-lg text-[#19B7FF]">
        ⚽
      </div>

      <h3 className="mt-4 text-lg font-semibold text-[#F8FAFC]">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#A7B0BE]">
        {description}
      </p>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex min-h-11 items-center rounded-[10px] bg-[#19B7FF] px-4 text-sm font-semibold text-[#071018] transition hover:bg-[#21C3FF]"
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
    <div className="grid min-h-screen place-items-center bg-[#071019] text-sm font-medium text-[#6F7B8A]">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-[#19B7FF]" />
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
      className="group flex items-center gap-4 rounded-2xl border border-[#203141] bg-[#101923] p-4 transition duration-200 hover:border-[#2D4356] hover:bg-[#121D28]"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-base ${toneClasses[tone]}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#F8FAFC]">
          {title}
        </span>

        <span className="mt-0.5 block text-xs leading-5 text-[#6F7B8A]">
          {description}
        </span>
      </span>

      {badge !== undefined ? (
        <span className="rounded-full bg-[#19B7FF] px-2.5 py-1 text-[10px] font-semibold text-[#071018]">
          {badge}
        </span>
      ) : null}

      <span className="text-[#6F7B8A] transition group-hover:translate-x-0.5 group-hover:text-[#19B7FF]">
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
    <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[#203141] bg-[#101923] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
      >
        <h2 className="text-lg font-semibold text-[#F8FAFC]">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#A7B0BE]">
          {description}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-[10px] border border-[#203141] bg-transparent px-4 text-sm font-medium text-[#A7B0BE] hover:bg-[#121D28] disabled:opacity-40"
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
                : 'bg-[#19B7FF] text-[#071018] hover:bg-[#21C3FF]'
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
      ? 'text-[#1FD18A] bg-[#1FD18A]/[0.08] border-[#1FD18A]/20'
      : tone === 'amber'
        ? 'text-[#F3B326] bg-[#F3B326]/[0.08] border-[#F3B326]/20'
        : tone === 'red'
          ? 'text-[#EF5350] bg-[#EF5350]/[0.08] border-[#EF5350]/20'
          : tone === 'slate'
            ? 'text-[#A7B0BE] bg-white/[0.035] border-white/[0.06]'
            : 'text-[#19B7FF] bg-[#19B7FF]/[0.08] border-[#19B7FF]/20';

  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-4 rounded-2xl border border-[#203141] bg-[#101923] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#2D4356] hover:bg-[#121D28] sm:p-5"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-lg ${accent}`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#F8FAFC]">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-[#6F7B8A]">
          {description}
        </span>
      </span>

      <span className="text-lg text-[#536273] transition group-hover:translate-x-0.5 group-hover:text-[#19B7FF]">
        →
      </span>
    </Link>
  );
}
