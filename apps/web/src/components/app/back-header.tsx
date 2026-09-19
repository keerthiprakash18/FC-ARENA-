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
    <header className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#6F7B8A] transition hover:text-[#38BDF8]"
      >
        <span>←</span>
        <span>{backLabel}</span>
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
      </div>
    </header>
  );
}
