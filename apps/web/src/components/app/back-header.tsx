'use client';

import Link from 'next/link';
import { FcPageHeader } from '@/components/fc/fc-ui';

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
    <div className="fc-back-header space-y-4">
      <Link
        href={backHref}
        className="fc-back-link theme-text-link inline-flex items-center gap-2 text-sm font-semibold transition"
      >
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </Link>

      <FcPageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
    </div>
  );
}
