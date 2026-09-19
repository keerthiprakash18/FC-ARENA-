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
  cyan: 'border-sky-400/25 bg-sky-400/[0.07] text-sky-300',
  emerald:
    'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300',
  amber:
    'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  red: 'border-red-400/25 bg-red-400/[0.07] text-red-300',
  slate:
    'border-white/10 bg-white/[0.035] text-slate-300',
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
      className={`rounded-[24px] border border-white/10 bg-[#08111b]/95 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl ${className}`}
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
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-400">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-2 font-['Rajdhani','Space_Grotesk',sans-serif] text-4xl font-black uppercase tracking-[-0.035em] text-white sm:text-5xl">
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-1 font-['Rajdhani','Space_Grotesk',sans-serif] text-2xl font-black uppercase tracking-[-0.02em]">
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
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses[tone]}`}
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
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: FcTone;
}) {
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : tone === 'red'
          ? 'text-red-300'
          : tone === 'slate'
            ? 'text-white'
            : 'text-sky-300';

  return (
    <article className="rounded-2xl border border-white/10 bg-[#0a1520] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${valueClass}`}>
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[11px] text-slate-600">{detail}</p>
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
      ? 'h-16 w-16 rounded-2xl text-lg'
      : size === 'sm'
        ? 'h-9 w-9 rounded-xl text-[10px]'
        : 'h-12 w-12 rounded-2xl text-sm';

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden border border-sky-400/20 bg-gradient-to-br from-sky-400/15 to-blue-950/30 font-black text-sky-300 ${sizeClass}`}
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
    <FcPanel className="border-dashed p-8 text-center sm:p-10">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] text-xl text-sky-300">
        ⚽
      </div>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] transition hover:bg-sky-300"
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
    <div className="grid min-h-screen place-items-center bg-[#030812] text-sm font-black uppercase tracking-[0.16em] text-slate-600">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
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
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1520] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-[#0c1925]"
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg ${toneClasses[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-100">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-600">
          {description}
        </span>
      </span>
      {badge !== undefined ? (
        <span className="rounded-full bg-sky-400 px-2.5 py-1 text-[10px] font-black text-[#031019]">
          {badge}
        </span>
      ) : null}
      <span className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-sky-300">
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#08111b] p-5 shadow-2xl"
      >
        <h2 className="text-xl font-black">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {description}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400 disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-3 text-sm font-black disabled:opacity-40 ${
              destructive
                ? 'bg-red-400 text-[#1b0505]'
                : 'bg-sky-400 text-[#031019]'
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
