'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import {
  authenticatedRequest,
  CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface MyLeague {
  membershipType: 'PRIMARY' | 'SECONDARY';
  adminRole: 'OWNER' | 'ADMIN' | null;
  league: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    region: string | null;
    members: number;
    maxMembers: number;
    pendingApplications: number;
  };
}

interface LeaguePreview {
  id: string;
  name: string;
  code: string;
  description: string | null;
  region: string | null;
  members: number;
  maxMembers: number;
  alreadyMember: boolean;
  applicationStatus: string | null;
}

export default function LeaguesPage() {
  const router = useRouter();

  const createLeagueFormRef = useRef<HTMLFormElement>(null);

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [leagues, setLeagues] = useState<MyLeague[]>([]);
  const [preview, setPreview] =
    useState<LeaguePreview | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLeagues() {
    const response = await authenticatedRequest<{
      data: {
        leagues: MyLeague[];
      };
    }>('/leagues/my');

    setLeagues(response.data.leagues);
  }

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        await loadLeagues();
      } catch {
        router.replace('/login');
      }
    }

    void load();
  }, [router]);

  async function createLeague(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    const submittedForm = event.currentTarget;
    const form = new FormData(submittedForm);

    try {
      const response = await authenticatedRequest<{
        data: {
          message: string;
          league: {
            code: string;
          };
        };
      }>('/leagues', {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          region: String(form.get('region') ?? '') || undefined,
          description:
            String(form.get('description') ?? '') || undefined,
          rules: String(form.get('rules') ?? '') || undefined,
        }),
      });

      setMessage(
        `${response.data.message} Code: ${response.data.league.code}`,
      );

      submittedForm.reset();
      await loadLeagues();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create League.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function findLeague(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setMessage('');
    setPreview(null);

    const form = new FormData(event.currentTarget);

    const code = String(form.get('code') ?? '')
      .trim()
      .toUpperCase();

    try {
      const response = await authenticatedRequest<{
        data: {
          league: LeaguePreview;
        };
      }>(`/leagues/code/${encodeURIComponent(code)}`);

      setPreview(response.data.league);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'League not found.',
      );
    }
  }

  async function requestJoin() {
    if (!preview) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await authenticatedRequest<{
        data: {
          message: string;
        };
      }>('/leagues/join', {
        method: 'POST',
        body: JSON.stringify({
          code: preview.code,
        }),
      });

      setMessage(response.data.message);

      setPreview({
        ...preview,
        applicationStatus: 'PENDING',
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to request membership.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(leagueId: string) {
    setError('');
    setMessage('');

    try {
      const response = await authenticatedRequest<{
        data: {
          message: string;
        };
      }>(`/leagues/${leagueId}/set-primary`, {
        method: 'POST',
      });

      setMessage(response.data.message);
      await loadLeagues();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update.',
      );
    }
  }

  async function leaveLeague(leagueId: string) {
    setError('');
    setMessage('');

    try {
      const response = await authenticatedRequest<{
        data: {
          message: string;
        };
      }>(`/leagues/${leagueId}/leave`, {
        method: 'DELETE',
      });

      setMessage(response.data.message);
      await loadLeagues();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to leave League.',
      );
    }
  }

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Leagues...
      </div>
    );
  }

  return (
    <AppShell
      playerName={user.player?.identity?.inGameName}
    >
      <div className="space-y-7">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            Competition Communities
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Leagues
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Create your football community or join using a League
            Code. Maximum two joined Leagues per player.
          </p>
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

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-400">
              Create
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Create League
            </h2>

            <form
              className="mt-5 grid gap-4"
              onSubmit={createLeague}
            >
              <input
                name="name"
                required
                placeholder="League Name"
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/60"
              />

              <input
                name="region"
                placeholder="Region â€” Tamil Nadu"
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/60"
              />

              <textarea
                name="description"
                placeholder="League Description"
                rows={3}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/60"
              />

              <textarea
                name="rules"
                placeholder="League Rules"
                rows={3}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400/60"
              />

              <button
                disabled={busy}
                className="rounded-xl bg-sky-400 px-4 py-3 font-black text-[#041019] disabled:opacity-50"
              >
                Create League
              </button>
            </form>
          </article>

          <article className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-400">
              Join
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Find League
            </h2>

            <form
              className="mt-5 flex gap-3"
              onSubmit={findLeague}
            >
              <input
                name="code"
                required
                placeholder="League Code"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 uppercase outline-none focus:border-sky-400/60"
              />

              <button className="rounded-xl border border-white/10 bg-white/5 px-5 font-bold">
                Find
              </button>
            </form>

            {preview ? (
              <div className="mt-5 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-sky-400">
                  {preview.code}
                </p>

                <h3 className="mt-2 text-2xl font-black">
                  {preview.name}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {preview.region || 'Region not specified'}
                </p>

                <p className="mt-4 text-sm font-bold">
                  {preview.members} / {preview.maxMembers} Members
                </p>

                {preview.alreadyMember ? (
                  <Link
                    href={`/leagues/${preview.id}`}
                    className="mt-5 inline-block rounded-xl bg-sky-400 px-4 py-3 font-black text-[#041019]"
                  >
                    Enter League
                  </Link>
                ) : preview.applicationStatus === 'PENDING' ? (
                  <p className="mt-5 text-sm font-bold text-amber-300">
                    Join request pending.
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={requestJoin}
                    className="mt-5 rounded-xl bg-sky-400 px-4 py-3 font-black text-[#041019]"
                  >
                    Request to Join
                  </button>
                )}
              </div>
            ) : null}
          </article>
        </section>

        <section>
          <h2 className="text-2xl font-black">
            My Leagues
          </h2>

          {leagues.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-600">
              No League memberships yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {leagues.map((item) => (
                <article
                  key={item.league.id}
                  className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-sky-400">
                        {item.membershipType}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {item.league.name}
                      </h3>

                      <p className="mt-1 font-mono text-sm text-slate-500">
                        {item.league.code}
                      </p>
                    </div>

                    {item.adminRole ? (
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/5 px-3 py-1 text-xs font-bold text-sky-400">
                        {item.adminRole}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <p className="text-xs text-slate-600">
                        Members
                      </p>

                      <p className="mt-1 font-black">
                        {item.league.members}/
                        {item.league.maxMembers}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <p className="text-xs text-slate-600">
                        Pending Requests
                      </p>

                      <p className="mt-1 font-black">
                        {item.league.pendingApplications}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/leagues/${item.league.id}`}
                      className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-[#041019]"
                    >
                      Enter League
                    </Link>

                    {item.membershipType === 'SECONDARY' ? (
                      <button
                        onClick={() =>
                          setPrimary(item.league.id)
                        }
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold"
                      >
                        Make Primary
                      </button>
                    ) : null}

                    {!item.adminRole ? (
                      <button
                        onClick={() =>
                          leaveLeague(item.league.id)
                        }
                        className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300"
                      >
                        Leave
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

