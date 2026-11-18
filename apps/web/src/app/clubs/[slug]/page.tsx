'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { FcCrest, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';

interface ClubDetails {
  id: string; slug: string; name: string; description: string | null; ownerUserId: string;
  isCaptain: boolean; isMember: boolean; createdAt: string;
  members: Array<{ userId: string; joinedAt: string; user: {
    fullName: string; player: { playerCode: string; profileImageUrl: string | null;
      identity: { inGameName: string } | null } | null;
  } }>;
  entries: Array<{ registrationId: string; linkedAt: string;
    registration: { entryName: string | null; entryLogoUrl: string | null; status: string;
      tournament: { id: string; name: string; mode: string; status: string } } }>;
}
interface Stats { matches: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; winRate: number }
interface Linkable { id: string; entryName: string; tournamentName: string; mode: string }

export default function ClubProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<ClubDetails | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [choices, setChoices] = useState<Linkable[]>([]);
  const [registrationId, setRegistrationId] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await authenticatedRequest<{ data: { club: ClubDetails; stats: Stats } }>('/clubs/' + encodeURIComponent(slug));
      setClub(response.data.club); setStats(response.data.stats);
      if (response.data.club.isCaptain) {
        const entries = await authenticatedRequest<{ data: { entries: Linkable[] } }>(
          '/clubs/' + response.data.club.id + '/linkable-entries');
        setChoices(entries.data.entries);
      }
      setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load club.'); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  async function rotate() {
    if (!club || busy) return;
    setBusy(true); setError(''); setInvite('');
    try {
      const response = await authenticatedRequest<{ data: { inviteCode: string } }>(
        '/clubs/' + club.id + '/invite/rotate', { method: 'POST' });
      setInvite(response.data.inviteCode);
      setNotice("The previous code is invalid. Copy the new private code now.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to regenerate invitation.'); }
    finally { setBusy(false); }
  }

  async function linkTeam(event: FormEvent) {
    event.preventDefault();
    if (!club || !registrationId || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await authenticatedRequest('/clubs/' + club.id + '/entries', {
        method: 'POST', body: JSON.stringify({ registrationId }),
      });
      setNotice("Official tournament entry linked to your club.");
      setRegistrationId('');
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to link team.'); }
    finally { setBusy(false); }
  }

  return <SecondaryFeaturePage title={club?.name || "FC ARENA Clubs"} eyebrow="FC ARENA Club" backHref="/clubs" backLabel="Clubs"
    subtitle={"Permanent teams, members and verified history"}>
    {error ? <p role="alert" className="rounded-xl border border-[var(--theme-danger)] p-3 text-sm text-[var(--theme-danger)]">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-[var(--theme-border)] p-3 text-sm text-[var(--theme-success)]">{notice}</p> : null}
    {club ? <div className="space-y-5">
      <FcPanel className="flex flex-wrap items-center gap-4 p-5">
        <FcCrest name={club.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold">{club.name}</h1>
          <p className="theme-secondary-text mt-1 text-sm">{club.description || 'Official persistent FC ARENA club identity'}</p>
          <p className="theme-secondary-text mt-2 text-xs">{club.members.length} {"members"} · {club.entries.length} {"linked entries"}</p>
        </div>
        {club.isCaptain ? <span className="rounded-xl bg-[var(--theme-primary-soft)] px-3 py-2 text-sm font-semibold">{"Club captain"}</span> : null}
      </FcPanel>
      {stats ? <section aria-label="Confirmed club match statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Verified games",stats.matches], ["Wins",stats.wins], ["Goals for",stats.goalsFor], ["Win rate",stats.winRate + '%'],
        ].map(([label,value])=><FcPanel key={label} className="p-4"><strong className="text-2xl">{value}</strong><p className="theme-secondary-text mt-1 text-xs">{label}</p></FcPanel>)}
      </section> : null}
      <p className="theme-secondary-text text-xs">{"Club statistics only include confirmed results from explicitly linked registrations."}</p>
      {club.isCaptain ? <FcPanel className="space-y-3 p-5">
        <h2 className="text-lg font-bold">{"Captain controls"}</h2>
        <p className="theme-secondary-text text-sm">Share invitation codes privately. Rotating invalidates the previous code.</p>
        <button type="button" disabled={busy} className="theme-secondary-button min-h-11 rounded-xl border px-4 font-semibold" onClick={() => void rotate()}>
          {"Regenerate private invitation code"}
        </button>
        {invite ? <div className="rounded-xl border border-[var(--theme-border)] p-3">
          <p className="text-xs">{"This invitation code is shown only once."}</p>
          <code className="mt-2 block select-all break-all text-lg">{invite}</code>
          <button type="button" className="theme-secondary-button mt-2 min-h-11 rounded-xl px-4" onClick={() => void navigator.clipboard?.writeText(invite)}>{"Copy invitation code"}</button>
        </div> : null}
        <h3 className="border-t border-[var(--theme-border)] pt-3 font-semibold">{"Link an approved DUO / TEAM tournament entry"}</h3>
        <p className="theme-secondary-text text-sm">{"All registered teammates must already belong to this club. Completed or verified entries cannot be claimed retroactively."}</p>
        {choices.length ? <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={event => void linkTeam(event)}>
          <label className="grid gap-2 text-sm font-semibold">{"Select approved team"}
            <select required className="theme-input min-h-11 rounded-xl border p-3" value={registrationId} onChange={e => setRegistrationId(e.target.value)}>
              <option value="">{"Select approved team"}</option>
              {choices.map(entry=><option key={entry.id} value={entry.id}>{entry.tournamentName} · {entry.entryName} ({entry.mode})</option>)}
            </select>
          </label>
          <button disabled={busy || !registrationId} className="theme-primary-button min-h-11 self-end rounded-xl px-4 font-bold disabled:opacity-50">{"Link team"}</button>
        </form> : <p className="theme-secondary-text text-sm">{"No eligible unlinked DUO / TEAM entries."}</p>}
      </FcPanel> : null}
      <section aria-label="Club roster" className="space-y-3"><h2 className="text-xl font-bold">{"Club roster"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {club.members.map(member=><FcPanel key={member.userId} className="flex items-center gap-3 p-4">
            <FcCrest name={member.user.player?.identity?.inGameName || member.user.fullName} imageUrl={member.user.player?.profileImageUrl} size="sm" />
            <span className="min-w-0"><strong className="block truncate">{member.user.player?.identity?.inGameName || member.user.fullName}</strong>
              <small className="theme-secondary-text">{member.userId === club.ownerUserId ? 'Captain · ' : ''}{member.user.player?.playerCode || 'Player'}</small>
            </span>
          </FcPanel>)}
        </div>
      </section>
      <section aria-label="Linked official competition history" className="space-y-3">
        <h2 className="text-xl font-bold">{"Linked tournament history"}</h2>
        {club.entries.length ? <div className="grid gap-3 md:grid-cols-2">
          {club.entries.map(entry=><Link key={entry.registrationId} href={`/tournaments/${entry.registration.tournament.id}`} className="theme-panel rounded-2xl border p-4 hover:border-[var(--theme-primary)]">
            <strong className="block">{entry.registration.tournament.name}</strong>
            <p className="theme-secondary-text mt-1 text-sm">{entry.registration.entryName || 'Team entry'} · {entry.registration.tournament.mode}</p>
            <span className="mt-2 block text-xs font-bold text-[var(--theme-primary)]">{"View competition"} →</span>
          </Link>)}
        </div> : <p className="theme-secondary-text text-sm">{"No linked tournament registrations yet."}</p>}
      </section>
    </div> : <p role="status" className="theme-secondary-text">Loading verified club identity…</p>}
  </SecondaryFeaturePage>;
}
