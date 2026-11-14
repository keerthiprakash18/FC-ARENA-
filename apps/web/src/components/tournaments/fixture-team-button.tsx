'use client';

import { useState } from 'react';
import { FcDialog } from '@/components/fc/fc-dialog';
import { FcCrest } from '@/components/fc/fc-ui';

interface Team {
  entryLogoUrl?: string | null;
  members: Array<{
    id: string;
    fullName: string;
    inGameName?: string | null;
    playerCode?: string | null;
  }>;
}

export function FixtureTeamButton({ entry, name, side, stacked = false, reverse = false, size = 'sm' }: {
  entry: Team | null;
  name: string;
  side?: 'HOME' | 'AWAY';
  stacked?: boolean;
  reverse?: boolean;
  size?: 'sm' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  const crest = <span aria-hidden="true"><FcCrest name={name} imageUrl={entry?.entryLogoUrl} size={size} /></span>;
  const sideLabel = side ? <span className="theme-neutral-block theme-text inline-flex w-fit items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.12em]">{side === 'HOME' ? 'Home' : 'Away'}</span> : null;
  const label = <span className={`min-w-0 ${stacked ? 'text-center' : reverse ? 'text-right' : 'text-left'}`}>
    {!stacked ? sideLabel : null}
    <span className={stacked ? 'block break-words text-base font-semibold' : `block truncate text-sm font-black ${side ? 'mt-1' : ''}`}>{name}</span>
  </span>;
  const content = stacked ? <>{sideLabel}{crest}{label}</> : !reverse ? <>{crest}{label}</> : <>{label}{crest}</>;
  const classes = `flex min-h-11 min-w-0 w-full gap-2 rounded-xl p-1 ${stacked ? 'flex-col items-center text-center' : reverse ? 'items-center justify-end text-right' : 'items-center text-left'}`;

  if (!entry) return <div className={classes}>{content}</div>;

  return <>
    <button type="button" aria-description={side ? `${side === 'HOME' ? 'Home' : 'Away'} team` : undefined} aria-haspopup="dialog"
      onClick={() => setOpen(true)}
      className={`${classes} transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400`}>
      {content}<span className="sr-only"> · View players representing {name}</span>
    </button>
    <FcDialog open={open} title={`${name} — Players`}
      description={entry.members.length ? 'Registered players representing this team.' : 'No player account is linked to this team yet. Ask the tournament admin to link the player.'}
      confirmLabel="Close" hideCancel onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)}>
      <p className="theme-secondary-text mt-3 break-words text-sm">Team / Club: {name}</p>
      {entry.members.length ? <ul className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
        {entry.members.map(member => <li key={member.id} className="theme-panel min-w-0 rounded-xl border p-4">
          <p className="theme-secondary-text text-xs">Account name</p>
          <p className="theme-text mt-1 break-words font-semibold">{member.fullName || 'Not added'}</p>
          <p className="theme-secondary-text mt-2 break-words text-sm">In-game name: {member.inGameName || 'Not added'}</p>
          {member.playerCode ? <p className="theme-secondary-text mt-2 break-all font-mono text-xs">Player ID: {member.playerCode}</p> : null}
        </li>)}
      </ul> : null}
    </FcDialog>
  </>;
}
