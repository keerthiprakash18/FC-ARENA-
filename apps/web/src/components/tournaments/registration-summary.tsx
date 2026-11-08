import Link from 'next/link';

export interface RegistrationSummaryData {
  id: string;
  approvedEntries: number;
  pendingEntries?: number;
  registeredEntries?: number;
  canManageParticipants?: boolean;
  canManageSettings?: boolean;
}

export function TournamentRegistrationSummary({ tournament }: { tournament: RegistrationSummaryData }) {
  const pending = tournament.pendingEntries ?? 0;
  const registered = tournament.registeredEntries ?? tournament.approvedEntries + pending;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-xs" aria-label="Tournament registrations">
    <p className="theme-muted"><strong className="theme-text">{registered} registered</strong>{' · '}{tournament.approvedEntries} approved{' · '}
      <span className={pending ? 'font-bold text-amber-400' : undefined}>{pending} pending approval</span>
    </p>
    {tournament.canManageParticipants ? <Link
      href={`/tournaments/${tournament.id}/registration${pending ? '?view=pending#pending-approvals' : ''}`}
      className={`${pending ? 'theme-primary-button' : 'theme-secondary-button'} inline-flex min-h-11 items-center rounded-lg px-3 py-2 font-bold`}>
      {pending ? `Review ${pending} pending` : 'Manage registrations'}
    </Link> : null}
  </div>;
}
