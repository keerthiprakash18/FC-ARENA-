'use client';
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { FcCrest, FcPanel, FcStatusBadge } from '@/components/fc/fc-ui';

const query = '(min-width: 768px)';
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
};
const desktopSnapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

export function CompactTeamCard({ name, logoUrl, status, fixtureCount, memberCount, editing, children }: {
  name: string; logoUrl: string | null; status: string; fixtureCount: number; memberCount: number; editing: boolean; children: ReactNode;
}) {
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, serverSnapshot);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const open = desktop || expanded || editing;
  return <FcPanel className={`min-w-0 p-3 md:p-5 ${open ? 'col-span-2 md:col-span-1' : ''}`}>
    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <FcCrest name={name} imageUrl={logoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-sm font-black leading-5 md:text-base">{name}</h2>
        <p className="mt-1 text-[11px] text-slate-500">{memberCount} {memberCount === 1 ? 'player' : 'players'} · {fixtureCount} fixtures</p>
      </div>
    </div>
    <div className="mt-2"><FcStatusBadge label={status} tone={status === 'APPROVED' ? 'emerald' : 'amber'} /></div>
    {!desktop ? <button type="button" className="mt-2 min-h-11 w-full rounded-lg border border-white/10 px-2 text-xs font-bold" aria-controls={id} aria-expanded={open} disabled={editing} onClick={() => setExpanded(value => !value)}>{open ? 'Close details ↑' : 'Players & details ↓'}</button> : null}
    <div id={id} hidden={!open}>{open ? <div className="mt-3">{children}</div> : null}</div>
  </FcPanel>;
}
