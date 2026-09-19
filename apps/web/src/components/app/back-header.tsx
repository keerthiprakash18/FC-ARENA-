'use client';

import Link from 'next/link';

export function BackHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-sky-300"
      >
        <span>←</span>
        <span>{backLabel}</span>
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="mt-2 font-['Rajdhani','Space_Grotesk',sans-serif] text-3xl font-black uppercase tracking-[-0.03em] sm:text-4xl">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="shrink-0">
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}
