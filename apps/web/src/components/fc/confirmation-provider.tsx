'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FcConfirmDialog } from './fc-ui';
type Request = { description: string; resolve: (value: boolean) => void };
let present: ((request: Request) => void) | null = null;
export function confirmAction(description: string): Promise<boolean> {
  return new Promise(resolve => present ? present({ description, resolve }) : resolve(false));
}
export function ConfirmationProvider() {
  const [request, setRequest] = useState<Request | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    present = next => setRequest(current => { current?.resolve(false); return next; });
    return () => { present = null; };
  }, []);
  useEffect(() => { setRequest(current => { current?.resolve(false); return null; }); }, [pathname]);
  useEffect(() => () => request?.resolve(false), [request]);
  function settle(value: boolean) { request?.resolve(value); setRequest(null); }
  return <FcConfirmDialog open={!!request} title="Confirm action" description={request?.description ?? ''} onConfirm={() => settle(true)} onCancel={() => settle(false)} />;
}
