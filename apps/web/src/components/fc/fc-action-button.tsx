'use client';

import type { ButtonHTMLAttributes } from 'react';

export function FcActionButton({ busy = false, busyLabel = 'Working…', children, disabled, className = '', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyLabel?: string }) {
  return (
    <button type="button" {...props} disabled={disabled || busy} aria-busy={busy || undefined} className={`fc-action-button ${className}`}>
      {busy ? <><span className="fc-busy-indicator" aria-hidden="true" />{busyLabel}</> : children}
    </button>
  );
}
