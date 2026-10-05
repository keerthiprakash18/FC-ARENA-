'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FcDialog, FcFormDialog } from './fc-dialog';
import type { FcDialogOptions, FcFormDialogOptions } from './fc-dialog';
type Request = { id?: number } & (
  | { kind: 'confirm'; options: FcDialogOptions; resolve: (value: boolean) => void }
  | { kind: 'form'; options: FcFormDialogOptions; resolve: (value: Record<string, string> | null) => void });
let present: ((request: Request) => void) | null = null;
export function confirmAction(options: string | FcDialogOptions): Promise<boolean> {
  return new Promise(resolve => present ? present({ kind: 'confirm', options: typeof options === 'string' ? { title: 'Confirm action', description: options } : options, resolve }) : resolve(false));
}
export function formAction(options: FcFormDialogOptions): Promise<Record<string, string> | null> {
  return new Promise(resolve => present ? present({ kind: 'form', options, resolve }) : resolve(null));
}
export async function promptAction(options: FcDialogOptions & {
  label: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
  validate?: (value: string) => string | undefined;
}): Promise<string | null> {
  const result = await formAction({
    ...options,
    fields: [{ name: 'value', label: options.label, defaultValue: options.defaultValue, required: options.required, type: options.multiline === false ? 'text' : 'textarea' }],
    validate: values => options.validate?.(values.value),
  });
  return result?.value ?? null;
}
export function confirmNamedDeletion(kind: 'League' | 'Tournament', name: string): Promise<string | null> {
  return promptAction({
    title: `Delete ${kind.toLowerCase()}?`,
    description: `Permanently delete “${name}”? This removes ${kind === 'League' ? 'its tournaments, fixtures, standings and league memberships' : 'its teams, groups, fixtures, matches, standings and statistics'}. This cannot be undone.`,
    label: `Type the ${kind.toLowerCase()} name exactly: ${name}`,
    confirmLabel: `Delete ${kind.toLowerCase()}`,
    destructive: true,
    required: true,
    multiline: false,
    validate: value => value.trim() !== name.trim() ? `${kind} name confirmation does not match.` : undefined,
  });
}
function dismiss(request: Request | null) {
  if (request?.kind === 'confirm') request.resolve(false);
  else request?.resolve(null);
}
export function ConfirmationProvider() {
  const pathname = usePathname();
  return <DialogHost key={pathname} />;
}
function DialogHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);
  const sequence = useRef(0);
  function cancel() {
    dismiss(current.current);
    current.current = null;
    setRequest(null);
  }
  useEffect(() => {
    present = next => { dismiss(current.current); const nextRequest = { ...next, id: ++sequence.current }; current.current = nextRequest; setRequest(nextRequest); };
    return () => { present = null; dismiss(current.current); current.current = null; };
  }, []);
  if (!request) return null;
  if (request.kind === 'form') return <FcFormDialog key={request.id} options={request.options} onConfirm={values => { current.current = null; setRequest(null); request.resolve(values); }} onCancel={cancel} />;
  return <FcDialog key={request.id} open {...request.options} onConfirm={() => { current.current = null; setRequest(null); request.resolve(true); }} onCancel={cancel} />;
}
