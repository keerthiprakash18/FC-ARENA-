'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

type TournamentMode = 'SOLO' | 'DUO' | 'TEAM';
type TournamentFormat = 'ROUND_ROBIN' | 'KNOCKOUT';

interface LeagueInfo {
  id: string;
  name: string;
  code: string;
  adminRole: 'OWNER' | 'ADMIN' | null;
}

interface Tournament {
  id: string;
  name: string;
  code: string;
  description: string | null;
  mode: TournamentMode;
  format: TournamentFormat;
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
}

export default function LeagueTournamentsPage() {
  const params = useParams<{ leagueId: string }>();
  const router = useRouter();

  const createTournamentFormRef = useRef<HTMLFormElement>(null);

  const leagueId = params.leagueId;

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [mode, setMode] = useState<TournamentMode>('SOLO');
  const [format, setFormat] =
    useState<TournamentFormat>('ROUND_ROBIN');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadTournaments() {
    const result = await authenticatedRequest<{
      success: true;
      data: {
        tournaments: Tournament[];
      };
      error: null;
    }>(`/leagues/${leagueId}/tournaments`);

    setTournaments(result.data.tournaments);
  }

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        const leagueResult = await authenticatedRequest<{
          success: true;
          data: {
            league: LeagueInfo;
          };
          error: null;
        }>(`/leagues/${leagueId}`);

        setLeague(leagueResult.data.league);

        await loadTournaments();
      } catch {
        router.replace('/leagues');
      }
    }

    void load();
  }, [leagueId, router]);

  async function createTournament(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(true);
    setError('');
    setMessage('');

    const submittedForm = event.currentTarget;
    const form = new FormData(submittedForm);
    const startAtRaw = String(form.get('startAt') ?? '');

    const payload = {
      name: String(form.get('name') ?? ''),
      mode,
      format,
      maxEntries: Number(form.get('maxEntries')),
      ...(mode === 'TEAM'
        ? {
            teamSize: Number(form.get('teamSize')),
          }
        : {}),
      description:
        String(form.get('description') ?? '') || undefined,
      rules: String(form.get('rules') ?? '') || undefined,
      startAt: startAtRaw
        ? new Date(startAtRaw).toISOString()
        : undefined,
    };

    try {
      const result = await authenticatedRequest<{
        success: true;
        data: {
          message: string;
          tournament: {
            code: string;
          };
        };
        error: null;
      }>(`/leagues/${leagueId}/tournaments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(
        `${result.data.message} Code: ${result.data.tournament.code}`,
      );

      submittedForm.reset();
      setMode('SOLO');
      setFormat('ROUND_ROBIN');

      await loadTournaments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create tournament.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user || !league) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-sm text-slate-500">
        Loading tournaments...
      </div>
    );
  }

  const isAdmin = Boolean(league.adminRole);

  return (
    <AppShell
      playerName={user.player?.identity?.inGameName}
    >
      <div className="space-y-7">
        <div>
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm font-bold text-slate-500 transition hover:text-white"
          >
            â† Back to League
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            {league.name}
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] md:text-5xl">
            Tournaments
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Create and manage competitions inside this League.
          </p>
        </div>

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

        {isAdmin ? (
          <section className="rounded-[26px] border border-white/10 bg-[#0a1018] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-400">
              League Admin
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Create Tournament
            </h2>

            <form
              className="mt-6 grid gap-5"
              onSubmit={createTournament}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="field">
                  <label>Tournament Name</label>
                  <input
                    name="name"
                    required
                    placeholder="FC ARENA SOLO CHAMPIONSHIP"
                  />
                </div>

                <div className="field">
                  <label>Maximum Entries</label>
                  <input
                    name="maxEntries"
                    type="number"
                    min="2"
                    max="128"
                    defaultValue="20"
                    required
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-bold text-slate-300">
                  Participation Type
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {(['SOLO', 'DUO', 'TEAM'] as TournamentMode[]).map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          mode === value
                            ? 'border-sky-400/50 bg-sky-400/10'
                            : 'border-white/10 bg-black/10'
                        }`}
                      >
                        <p
                          className={`font-black ${
                            mode === value
                              ? 'text-sky-400'
                              : 'text-white'
                          }`}
                        >
                          {value}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {value === 'SOLO'
                            ? '1 player per entry'
                            : value === 'DUO'
                              ? '2 players per entry'
                              : 'Custom team size'}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>

              {mode === 'TEAM' ? (
                <div className="field">
                  <label>Players Per Team</label>
                  <input
                    name="teamSize"
                    type="number"
                    min="3"
                    max="11"
                    defaultValue="4"
                    required
                  />
                </div>
              ) : null}

              <div>
                <p className="mb-3 text-sm font-bold text-slate-300">
                  Competition Format
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormat('ROUND_ROBIN')
                    }
                    className={`rounded-2xl border p-4 text-left ${
                      format === 'ROUND_ROBIN'
                        ? 'border-sky-400/50 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      Round Robin
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Every approved entry competes against every
                      other entry.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormat('KNOCKOUT')
                    }
                    className={`rounded-2xl border p-4 text-left ${
                      format === 'KNOCKOUT'
                        ? 'border-sky-400/50 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      Knockout
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Single-elimination tournament bracket.
                    </p>
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Tournament Start - optional</label>
                <input
                  name="startAt"
                  type="datetime-local"
                />
              </div>

              <div className="field">
                <label>Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Tournament description"
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </div>

              <div className="field">
                <label>Rules</label>
                <textarea
                  name="rules"
                  rows={4}
                  placeholder="Tournament rules"
                  className="rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 outline-none focus:border-sky-400/60"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-sky-400 px-5 py-3 font-black text-[#041019] disabled:opacity-50"
              >
                {busy
                  ? 'Creating Tournament...'
                  : 'Create Tournament'}
              </button>
            </form>
          </section>
        ) : null}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                Competition List
              </p>

              <h2 className="mt-1 text-2xl font-black">
                League Tournaments
              </h2>
            </div>

            <span className="text-sm text-slate-500">
              {tournaments.length} tournament
              {tournaments.length === 1 ? '' : 's'}
            </span>
          </div>

          {tournaments.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/10 p-12 text-center">
              <p className="font-bold text-slate-400">
                No tournaments created yet.
              </p>

              <p className="mt-2 text-sm text-slate-600">
                League Admins can create the first competition above.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {tournaments.map((tournament) => (
                <article
                  key={tournament.id}
                  className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-black text-sky-400">
                          {tournament.mode}
                        </span>

                        <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black text-slate-400">
                          {tournament.format.replace(
                            '_',
                            ' ',
                          )}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {tournament.name}
                      </h3>

                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {tournament.code}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">
                      {tournament.status.replaceAll(
                        '_',
                        ' ',
                      )}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Entries
                      </p>

                      <p className="mt-1 font-black">
                        {tournament.approvedEntries}/
                        {tournament.maxEntries}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Team Size
                      </p>

                      <p className="mt-1 font-black">
                        {tournament.teamSize}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase text-slate-600">
                        Start
                      </p>

                      <p className="mt-1 text-xs font-bold">
                        {tournament.startAt
                          ? new Date(
                              tournament.startAt,
                            ).toLocaleDateString()
                          : 'TBD'}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/tournaments/${tournament.id}`}
                    className="mt-5 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#041019]"
                  >
                    Enter Tournament
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

