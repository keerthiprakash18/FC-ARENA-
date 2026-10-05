import Link from 'next/link';
import type { ReactNode } from 'react';

export interface FcContextNavItem {
  label: ReactNode;
  href: string;
  active?: boolean;
  complete?: boolean;
  disabled?: boolean;
}

export function FcContextNav({
  items,
  ariaLabel,
  className = '',
}: {
  items: readonly FcContextNavItem[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`fc-context-nav ${className}`.trim()}
    >
      <div className="fc-context-nav-track">
        {items.map(item => (
          <Link
            key={`${String(item.label)}-${item.href}`}
            href={item.disabled ? '#' : item.href}
            aria-current={item.active ? 'page' : undefined}
            aria-disabled={item.disabled ? 'true' : undefined}
            data-active={item.active ? 'true' : 'false'}
            data-complete={item.complete ? 'true' : 'false'}
            className={`fc-context-nav-link${item.disabled ? ' is-disabled' : ''}`}
          >
            {item.complete ? (
              <span className="fc-context-nav-step" aria-hidden="true">
                ✓
              </span>
            ) : null}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
