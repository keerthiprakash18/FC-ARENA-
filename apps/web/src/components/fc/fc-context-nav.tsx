'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  const navRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState(false);
  const activeHref = items.find(item => item.active)?.href;

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      setOverflow(nav.scrollWidth > nav.clientWidth + 1);
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) {
        // Scroll only the tab rail: never move the document or native WebView.
        const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
        if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
          nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
        }
      }
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    if (nav.firstElementChild) observer.observe(nav.firstElementChild);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [activeHref]);

  return (
    <div className="fc-context-nav-wrap">
    <nav
      ref={navRef}
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
            tabIndex={item.disabled ? -1 : undefined}
            onClick={event => { if (item.disabled) event.preventDefault(); }}
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
    {overflow ? <p className="fc-context-nav-hint theme-muted">Scroll for more sections <span aria-hidden="true">↔</span></p> : null}
    </div>
  );
}
