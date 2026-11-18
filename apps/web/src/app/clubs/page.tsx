'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { FcCrest, FcEmptyState, FcPanel } from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';
import { useArenaLocale } from '@/lib/locale';

interface Club {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerUserId: string;
  myClub: boolean;
  _count: { members: number; entries: number };
}

export default function ClubsPage() {
  const { t } = useArenaLocale();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [invite, setInvite] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await authenticatedRequest<{ data: { clubs: Club[] } }>('/clubs');
      setClubs(response.data.clubs);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load clubs.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setInvite('');
    try {
      const response = await authenticatedRequest<{ data: { club: Club; inviteCode: string } }>('/clubs', {
        method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      setInvite(response.data.inviteCode);
      setNotice(t('shareInvitePrivate'));
      setName(''); setDescription('');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to create club.');
    } finally { setBusy(false); }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await authenticatedRequest('/clubs/join', { method: 'POST',
        body: JSON.stringify({ inviteCode: joinCode.trim() }) });
      setJoinCode(''); setNotice(t('joinSuccess'));
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to join this club.');
    } finally { setBusy(false); }
  }

  return <SecondaryFeaturePage title={t('clubs')} eyebrow="Permanent club identity"
    subtitle={t('clubsIntro')}
    backHref="/community/teams" backLabel="Tournament Teams">
    {error ? <p role="alert" className="rounded-xl border border-[var(--theme-danger)] p-3 text-sm text-[var(--theme-danger)]">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl border border-[var(--theme-border)] p-3 text-sm text-[var(--theme-success)]">{notice}</p> : null}
    {invite ? <section aria-label="One-time private club invitation" className="rounded-2xl border border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] p-4">
      <h2 className="text-base font-bold">{t('inviteOneTime')}</h2>
      <p className="mt-1 text-sm">{t('inviteOneTimeHelp')}</p>
      <code className="mt-3 block select-all break-all rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 font-mono text-base">{invite}</code>
      <button type="button" className="theme-secondary-button mt-3 min-h-11 rounded-xl px-4" onClick={() => void navigator.clipboard?.writeText(invite)}>{t('copyInvite')}</button>
    </section> : null}
    <div className="grid gap-4 xl:grid-cols-2">
      <FcPanel className="p-5">
        <h2 className="text-xl font-bold">{t('createClub')}</h2>
        <p className="theme-secondary-text mt-1 text-sm">{t('createClubHelp')}</p>
        <form className="mt-4 grid gap-3" onSubmit={event => void create(event)}>
          <label className="grid gap-1 text-sm font-semibold">{t('clubName')}
            <input required minLength={3} maxLength={80} value={name} onChange={e => setName(e.target.value)}
              className="theme-input min-h-11 rounded-xl border px-3" placeholder="e.g. Chennai Phantoms FC" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">{t('descriptionOptional')}
            <textarea maxLength={400} value={description} onChange={e => setDescription(e.target.value)}
              className="theme-input min-h-24 rounded-xl border p-3" placeholder={t('descriptionPlaceholder')} />
          </label>
          <button disabled={busy} className="theme-primary-button min-h-11 rounded-xl px-4 font-bold disabled:opacity-50">{t('createClub')}</button>
        </form>
      </FcPanel>
      <FcPanel className="p-5">
        <h2 className="text-xl font-bold">{t('joinClub')}</h2>
        <p className="theme-secondary-text mt-1 text-sm">{t('memberInviteHelp')}</p>
        <form className="mt-4 grid gap-3" onSubmit={event => void join(event)}>
          <label className="grid gap-1 text-sm font-semibold">{t('invitationCode')}
            <input value={joinCode} required minLength={24} maxLength={24} onChange={e => setJoinCode(e.target.value)}
              autoCapitalize="off" autoComplete="off" spellCheck={false}
              className="theme-input min-h-11 rounded-xl border px-3 font-mono" placeholder="24-character private code" />
          </label>
          <button disabled={busy} className="theme-secondary-button min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50">{t('joinClub')}</button>
        </form>
      </FcPanel>
    </div>
    <section aria-label="Arena clubs" className="space-y-3">
      <h2 className="text-xl font-bold">{t('permanentClubs')}</h2>
      {loading ? <p role="status" className="theme-muted">{t('loadingClubs')}</p> :
        !clubs.length ? <FcEmptyState title={t('noClubs')} description={t('createFirstClub')} /> :
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clubs.map(club => <Link key={club.id} href={`/clubs/${club.slug}`}
            className="theme-panel flex min-h-32 items-start gap-3 rounded-2xl border p-4 transition hover:border-[var(--theme-primary)]">
            <FcCrest name={club.name} />
            <span className="min-w-0 flex-1">
              <strong className="block break-words text-base">{club.name}</strong>
              <span className="theme-secondary-text mt-1 block text-xs">{club._count.members} {t('members')} · {club._count.entries} {t('linkedEntries')}</span>
              <span className="theme-secondary-text mt-2 block line-clamp-2 text-xs">{club.description || 'Competitive FC ARENA club'}</span>
              {club.myClub ? <span className="mt-2 inline-block rounded-full bg-[var(--theme-primary-soft)] px-2 py-1 text-xs font-semibold">{t('myClub')}</span> : null}
            </span>
          </Link>)}
        </div>}
    </section>
  </SecondaryFeaturePage>;
}
