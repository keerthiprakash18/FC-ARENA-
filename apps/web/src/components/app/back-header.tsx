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
    <header className="fc-back-header space-y-4">
      <Link
        href={backHref}
        className="fc-back-link theme-text-link inline-flex items-center gap-2 text-sm font-semibold transition"
      >
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="theme-muted text-xs font-semibold">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="theme-text fc-display-strong mt-1 text-[26px] leading-tight sm:text-[32px]">
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
      </div>
    </header>
  );
}
