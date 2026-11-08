'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { confirmAction } from '@/components/fc/confirmation-provider';
import { FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';
import type { EntryLimitTournament } from './tournament-entry-limit';

export function TournamentFixtureStart({ tournament }: { tournament: EntryLimitTournament }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!tournament.canPrepareFixtures) return null;

  const approved = tournament.approvedEntries ?? 0;
  const pending = tournament.pendingEntries ?? 0;
  const ready = approved >= 2 && pending === 0;

  async function start() {
    if (!ready || busy) return;
    if (!(await confirmAction({ title: 'Create fixtures with these teams?',
      description: `Close registration and continue with ${approved} approved teams. You can review the fixture preview before publishing.`,
      confirmLabel: 'Continue to Fixture Setup',
    }))) return;
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { nextStep: 'GROUPS' | 'FIXTURE_SETTINGS' } }>(
        `/tournaments/${tournament.id}/prepare-fixtures`, { method: 'POST' },
      );
      router.push(`/tournaments/${tournament.id}/wizard/${response.data.nextStep === 'GROUPS' ? 'groups' : 'fixture-settings'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare fixtures.');
      setBusy(false);
    }
  }

  return <FcPanel className="p-5 sm:p-6">
    <h2 className="text-lg font-black">Create Fixtures</h2>
    <p className="mt-2 text-sm leading-6 text-slate-400">
      {approved} approved teams · Entry limit {tournament.maxEntries}. Start when your teams are ready; unused slots can stay empty.
    </p>
    {approved < 2 ? <p className="mt-2 text-sm text-amber-300">Approve at least two teams to start.</p> : null}
    {pending > 0 ? <p className="mt-2 text-sm text-amber-300">
      Review {pending} pending registration(s) first. <Link className="underline" href={`/tournaments/${tournament.id}/registration`}>Review Registrations</Link>
    </p> : null}
    <button type="button" disabled={!ready || busy} onClick={() => void start()}
      className="mt-4 min-h-11 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40">
      {busy ? 'Preparing...' : `Create Fixtures with ${approved} Teams`}
    </button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
  </FcPanel>;
}
