'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface LeagueHome {
  id: string;
  name: string;
  code: string;
  description: string | null;
  region: string | null;
  rules: string | null;
  members: number;
  maxMembers: number;
  pendingApplications: number;
  membershipType: 'PRIMARY' | 'SECONDARY';
  adminRole: 'OWNER' | 'ADMIN' | null;
  creator: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  };
}

interface LeagueMember {
  membershipId: string;
  membershipType: 'PRIMARY' | 'SECONDARY';
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    playerCode: string | null;
    inGameName: string | null;
    gameUid: string | null;
    identityVerified: boolean;
    adminRole: 'OWNER' | 'ADMIN' | null;
  };
}

interface Application {
  id: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    player: {
      playerCode: string;
      identity: {
        inGameName: string;
        gameUid: string | null;
      } | null;
    } | null;
  };
}

type Tab = 'overview' | 'members' | 'applications';

export default function LeagueHomePage() {
  const params = useParams<{ leagueId: string }>();
  const router = useRouter();

  const leagueId = params.leagueId;

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [league, setLeague] = useState<LeagueHome | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [applications, setApplications] =
    useState<Application[]>([]);

  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLeague() {
    const response = await authenticatedRequest<{
      success: true;
      data: {
        league: LeagueHome;
      };
      error: null;
    }>(`/leagues/${leagueId}`);

    setLeague(response.data.league);
  }

  async function loadMembers(value = '') {
    const query = value
      ? `?search=${encodeURIComponent(value)}`
      : '';

    const response = await authenticatedRequest<{
      success: true;
      data: {
        members: LeagueMember[];
      };
      error: null;
    }>(`/leagues/${leagueId}/members${query}`);

    setMembers(response.data.members);
  }

  async function loadApplications() {
    const response = await authenticatedRequest<{
      success: true;
      data: {
        applications: Application[];
      };
      error: null;
    }>(`/leagues/${leagueId}/applications`);

    setApplications(response.data.applications);
  }

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();

        setUser(currentUser);

        await Promise.all([
          loadLeague(),
          loadMembers(),
        ]);
      } catch {
        router.replace('/leagues');
      }
    }

    void load();
  }, [leagueId, router]);

  async function openApplications() {
    setTab('applications');
    setError('');

    try {
      await loadApplications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load applications.',
      );
    }
  }

  async function searchMembers(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');

    try {
      await loadMembers(search);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to search members.',
      );
    }
  }

  async function reviewApplication(
    applicationId: string,
    action: 'approve' | 'reject',
  ) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
        };
        error: null;
      }>(
        `/leagues/${leagueId}/applications/${applicationId}/${action}`,
        {
          method: 'POST',
        },
      );

      setMessage(response.data.message);

      await Promise.all([
        loadLeague(),
        loadApplications(),
        loadMembers(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review application.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberUserId: string) {
    const confirmed = window.confirm(
      'Remove this player from the League?',
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
        };
        error: null;
      }>(`/leagues/${leagueId}/members/${memberUserId}`, {
        method: 'DELETE',
      });

      setMessage(response.data.message);

      await Promise.all([
        loadLeague(),
        loadMembers(search),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove member.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!league) {
      return;
    }

    try {
      await navigator.clipboard.writeText(league.code);
      setMessage('League Code copied.');
      setError('');
    } catch {
      setError('Unable to copy League Code.');
    }
  }

  if (!user || !league) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading League...
      </div>
    );
  }

  const isAdmin = Boolean(league.adminRole);

  return (
    <AppShell
      playerName={user.player?.identity?.inGameName}
    >
      <div className="space-y-6">
        <Link
          href="/leagues"
          className="inline-flex text-sm font-bold text-slate-500 transition hover:text-white"
        >
          ← Back to Leagues
        </Link>

        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1018] p-6 md:p-8">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-sky-400/5 to-transparent" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sky-400/20 bg-sky-400/5 px-3 py-1 text-xs font-black text-sky-400">
                  {league.membershipType}
                </span>

                {league.adminRole ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1 text-xs font-black text-amber-300">
                    {league.adminRole}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] md:text-6xl">
                {league.name}
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                {league.region || 'Region not specified'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  League Code
                </p>

                <p className="mt-1 font-mono font-black text-sky-400">
                  {league.code}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void copyCode()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-bold"
              >
                Copy
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              tab === 'overview'
                ? 'bg-sky-400 text-[#041019]'
                : 'border border-white/10 text-slate-400'
            }`}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('members');
              void loadMembers();
            }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              tab === 'members'
                ? 'bg-sky-400 text-[#041019]'
                : 'border border-white/10 text-slate-400'
            }`}
          >
            Members
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => void openApplications()}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                tab === 'applications'
                  ? 'bg-sky-400 text-[#041019]'
                  : 'border border-white/10 text-slate-400'
              }`}
            >
              Applications ({league.pendingApplications})
            </button>
          ) : null}

          <Link
            href={`/leagues/${leagueId}/tournaments`}
            className="whitespace-nowrap rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-400 transition hover:border-sky-400/30 hover:text-sky-400"
          >
            Tournaments
          </Link>
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
            <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
                League Overview
              </p>

              <h2 className="mt-3 text-2xl font-black">
                About
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">
                {league.description ||
                  'No League description has been added yet.'}
              </p>

              <h3 className="mt-8 text-lg font-black">
                Rules
              </h3>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                {league.rules ||
                  'No League rules have been added yet.'}
              </p>
            </section>

            <div className="space-y-4">
              <section className="grid grid-cols-2 gap-4">
                <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
                  <p className="text-xs font-black uppercase text-slate-600">
                    Members
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {league.members}
                    <span className="text-base text-slate-600">
                      /{league.maxMembers}
                    </span>
                  </p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
                  <p className="text-xs font-black uppercase text-slate-600">
                    Pending
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {league.pendingApplications}
                  </p>
                </article>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#0a1018] p-5">
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                  League Owner
                </p>

                <p className="mt-3 text-lg font-black">
                  {league.creator.fullName}
                </p>

                <p className="mt-1 text-sm text-sky-400">
                  {league.creator.inGameName || '—'}
                </p>

                <p className="mt-1 text-xs text-slate-600">
                  {league.creator.playerCode}
                </p>
              </section>

              <section className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-400">
                  Competition Center
                </p>

                <h3 className="mt-2 text-lg font-black">
                  Tournaments
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View and manage SOLO, DUO and TEAM competitions
                  inside this League.
                </p>

                <Link
                  href={`/leagues/${leagueId}/tournaments`}
                  className="mt-5 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#041019]"
                >
                  {isAdmin
                    ? 'Manage Tournaments'
                    : 'View Tournaments'}
                </Link>
              </section>
            </div>
          </div>
        ) : null}

        {tab === 'members' ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-sky-400">
                  Squad
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  League Members
                </h2>
              </div>

              <form
                onSubmit={searchMembers}
                className="flex gap-2"
              >
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search player..."
                  className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm outline-none focus:border-sky-400/60"
                />

                <button
                  type="submit"
                  className="rounded-xl border border-white/10 px-4 text-sm font-bold"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="mt-6 space-y-3">
              {members.map((member) => (
                <article
                  key={member.membershipId}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">
                        {member.user.fullName}
                      </p>

                      {member.user.adminRole ? (
                        <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-black text-sky-400">
                          {member.user.adminRole}
                        </span>
                      ) : null}

                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-slate-500">
                        {member.membershipType}
                      </span>

                      {member.user.identityVerified ? (
                        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-400">
                          VERIFIED
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-slate-400">
                      {member.user.inGameName ||
                        'No in-game name'}
                    </p>

                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {member.user.playerCode}
                    </p>
                  </div>

                  {isAdmin &&
                  member.user.adminRole !== 'OWNER' &&
                  member.user.id !== user.id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void removeMember(
                          member.user.id,
                        )
                      }
                      className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
                    >
                      Remove Member
                    </button>
                  ) : null}
                </article>
              ))}

              {members.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  No matching members.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === 'applications' && isAdmin ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-wider text-sky-400">
              Admin Review
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Pending Applications
            </h2>

            <div className="mt-6 space-y-3">
              {applications.map((application) => (
                <article
                  key={application.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black">
                      {application.user.fullName}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {application.user.player
                        ?.identity?.inGameName ?? '—'}
                    </p>

                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {application.user.player?.playerCode}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void reviewApplication(
                          application.id,
                          'approve',
                        )
                      }
                      className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#041009] disabled:opacity-50"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void reviewApplication(
                          application.id,
                          'reject',
                        )
                      }
                      className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}

              {applications.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  No pending applications.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}