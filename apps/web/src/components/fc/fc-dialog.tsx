'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FcActionButton } from './fc-action-button';

export interface FcDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function FcDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, busy = false, onConfirm, onCancel, children,
}: FcDialogOptions & {
  open: boolean;
  busy?: boolean;
  onConfirm: (form: HTMLFormElement) => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    // Native modal dialogs make the background inert and contain keyboard focus.
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
      className="theme-dialog rounded-2xl border p-5"
    >
      <form onSubmit={event => { event.preventDefault(); if (!busy) onConfirm(event.currentTarget); }}>
        <h2 id={titleId} className="theme-text text-lg font-semibold">{title}</h2>
        <p id={descriptionId} className="theme-secondary-text mt-2 text-sm leading-6 whitespace-pre-line">{description}</p>
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button" disabled={busy} onClick={onCancel}
            data-initial-focus={destructive || !children ? '' : undefined}
            className="theme-secondary-button min-h-11 rounded-[10px] border px-4 text-sm font-medium"
          >{cancelLabel}</button>
          <FcActionButton
            type="submit" busy={busy} busyLabel="Working..."
            className={'min-h-11 rounded-[10px] px-4 text-sm font-semibold ' + (destructive ? 'theme-danger-button border' : 'theme-primary-button')}
          >{confirmLabel}</FcActionButton>
        </div>
      </form>
    </dialog>
  );
}

export interface FcDialogField {
  name: string;
  label: string;
  defaultValue?: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  required?: boolean;
  min?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface FcFormDialogOptions extends FcDialogOptions {
  fields: FcDialogField[];
  validate?: (values: Record<string, string>) => string | undefined;
}

export function FcFormDialog({
  options, onConfirm, onCancel,
}: {
  options: FcFormDialogOptions;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [error, setError] = useState('');
  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const values = Object.fromEntries(options.fields.map(field => [field.name, String(data.get(field.name) ?? '')]));
    const message = options.validate?.(values);
    if (message) { setError(message); return; }
    onConfirm(values);
  }

  return (
    <FcDialog open {...options} onConfirm={submit} onCancel={onCancel}>
      <div className="mt-5 grid gap-4">
        {options.fields.map((field, index) => {
          const props = {
            id: `${id}-${field.name}`, name: field.name, defaultValue: field.defaultValue ?? '',
            required: field.required, 'aria-describedby': error ? `${id}-error` : undefined,
            'aria-invalid': error ? true : undefined,
            'data-initial-focus': !options.destructive && index === 0 ? '' : undefined,
          };
          return (
            <div key={field.name} className="fc-field-label">
              <label htmlFor={props.id}>{field.label}{field.required ? '' : ' (optional)'}</label>
              {field.type === 'textarea' ? <textarea {...props} /> : field.type === 'select' ? (
                <select {...props}>
                  <option value="">Select a team</option>
                  {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : <input {...props} type={field.type ?? 'text'} min={field.min} step={field.step} autoComplete="off" />}
            </div>
          );
        })}
      </div>
      <p id={`${id}-error`} role="alert" aria-atomic="true" className={error ? 'fc-notice mt-4' : 'sr-only'} data-tone="error">{error}</p>
    </FcDialog>
  );
}
