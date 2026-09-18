'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';
import { AppShell } from '@/components/app/app-shell';
import {
  FixtureCard,
  type FixtureForUi,
} from '@/components/tournaments/fixture-card';
import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface Tournament {
  id: string;
  leagueId: string;
  name: string;
  code: string;
  description: string | null;
  rules: string | null;
  mode: 'SOLO' | 'DUO' | 'TEAM';
  format:
    | 'ROUND_ROBIN'
    | 'KNOCKOUT';
  status: string;
  teamSize: number;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  registrationOpenedAt: string | null;
  registrationClosedAt: string | null;
  fixturesGeneratedAt: string | null;

  dailyMatchLimit: number;
  matchesPerParticipantPerDay: number;
  matchDurationMinutes: number;

  isLeagueAdmin: boolean;

  league: {
    id: string;
    name: string;
    code: string;
  };

  createdBy: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;

      identity: {
        inGameName: string;
      } | null;
    } | null;
  };
}

interface Registration {
  id: string;
  entryName: string | null;
  status: string;

  registeredBy: {
    fullName: string;
  };

  members: Array<{
    user: {
      id: string;
      fullName: string;

      player: {
        playerCode: string;

        identity: {
          inGameName: string;
        } | null;
      } | null;
    };
  }>;
}

type Tab =
  | 'overview'
  | 'register'
  | 'fixtures'
  | 'admin';

type FixtureDrawMode =
  | 'SINGLE'
  | 'GROUPS';

export default function TournamentPage() {
  const params =
    useParams<{
      tournamentId: string;
    }>();

  const router = useRouter();

  const tournamentId =
    params.tournamentId;

  const [user, setUser] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    tournament,
    setTournament,
  ] =
    useState<Tournament | null>(
      null,
    );

  const [
    registrations,
    setRegistrations,
  ] =
    useState<Registration[]>([]);

  const [
    fixtures,
    setFixtures,
  ] =
    useState<FixtureForUi[]>([]);

  const [tab, setTab] =
    useState<Tab>('overview');

  const [
    playerCodes,
    setPlayerCodes,
  ] = useState('');

  const [
    fixtureDrawMode,
    setFixtureDrawMode,
  ] =
    useState<FixtureDrawMode>(
      'SINGLE',
    );

  const [
    groupCount,
    setGroupCount,
  ] = useState(2);

  const [
    shuffleFixtures,
    setShuffleFixtures,
  ] = useState(true);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  async function loadTournament() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          tournament:
            Tournament;
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}`,
      );

    setTournament(
      response.data.tournament,
    );

    return response.data.tournament;
  }

  async function loadFixtures() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          fixtures:
            FixtureForUi[];
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}/fixtures`,
      );

    setFixtures(
      response.data.fixtures,
    );
  }

  async function loadRegistrations() {
    const response =
      await authenticatedRequest<{
        success: true;

        data: {
          registrations:
            Registration[];
        };

        error: null;
      }>(
        `/tournaments/${tournamentId}/registrations`,
      );

    setRegistrations(
      response.data.registrations,
    );
  }

  useEffect(() => {
    async function load() {
      try {
        const current =
          await getCurrentUser();

        setUser(current);

        if (
          current.player
            ?.playerCode
        ) {
          setPlayerCodes(
            current.player
              .playerCode,
          );
        }

        const competition =
          await loadTournament();

        await loadFixtures();

        if (
          competition
            .isLeagueAdmin
        ) {
          await loadRegistrations();
        }
      } catch {
        router.replace(
          '/dashboard',
        );
      }
    }

    void load();
  }, [
    router,
    tournamentId,
  ]);

  async function changeRegistration(
    action:
      | 'open'
      | 'close',
  ) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const path =
        action === 'open'
          ? `/tournaments/${tournamentId}/open-registration`
          : `/tournaments/${tournamentId}/close-registration`;

      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          path,
          {
            method: 'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update registration.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(true);
    setMessage('');
    setError('');

    const data =
      new FormData(
        event.currentTarget,
      );

    const codes =
      playerCodes
        .split(/[\n,]+/)
        .map((value) =>
          value
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean);

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/register`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                entryName:
                  String(
                    data.get(
                      'entryName',
                    ) ?? '',
                  ) ||
                  undefined,

                playerCodes:
                  codes,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      if (
        tournament
          ?.isLeagueAdmin
      ) {
        await loadRegistrations();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function review(
    registrationId: string,
    action:
      | 'approve'
      | 'reject',
  ) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/${action}`,
          {
            method: 'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await Promise.all([
        loadTournament(),
        loadRegistrations(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review registration.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateFixtures() {
    const selectedGroupCount =
      fixtureDrawMode ===
        'GROUPS' &&
      tournament?.format ===
        'ROUND_ROBIN'
        ? groupCount
        : 1;

    const drawLabel =
      selectedGroupCount > 1
        ? `${selectedGroupCount} groups`
        : 'a single table';

    if (
      !window.confirm(
        `Generate fixtures using all approved entries as ${drawLabel}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
            participants:
              number;
            fixtures: number;
            groupCount: number;
            groups: Array<{
              name: string;
              participants:
                number;
            }>;
            shuffled: boolean;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/fixtures/generate`,
          {
            method: 'POST',
            body:
              JSON.stringify({
                groupCount:
                  selectedGroupCount,
                shuffle:
                  shuffleFixtures,
              }),
          },
        );

      const groupSummary =
        response.data.groups.length >
        1
          ? ` ${response.data.groups
              .map(
                (group) =>
                  `Group ${group.name}: ${group.participants}`,
              )
              .join(' • ')}.`
          : '';

      setMessage(
        `${response.data.message} ${response.data.participants} entries → ${response.data.fixtures} fixtures.${groupSummary}`,
      );

      await Promise.all([
        loadTournament(),
        loadFixtures(),
      ]);

      setTab('fixtures');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate fixtures.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateSettings(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    setBusy(true);
    setMessage('');
    setError('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            message: string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/scheduling-settings`,
          {
            method: 'PATCH',

            body:
              JSON.stringify({
                dailyMatchLimit:
                  Number(
                    data.get(
                      'dailyMatchLimit',
                    ),
                  ),

                matchesPerParticipantPerDay:
                  Number(
                    data.get(
                      'matchesPerParticipantPerDay',
                    ),
                  ),

                matchDurationMinutes:
                  Number(
                    data.get(
                      'matchDurationMinutes',
                    ),
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update scheduling settings.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (
    !user ||
    !tournament
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080d] text-slate-500">
        Loading Tournament...
      </div>
    );
  }

  const registrationOpen =
    tournament.status ===
    'REGISTRATION_OPEN';

  const registrationClosed =
    tournament.status ===
    'REGISTRATION_CLOSED';

  const pending =
    registrations.filter(
      (item) =>
        item.status ===
        'PENDING',
    );

  const approved =
    registrations.filter(
      (item) =>
        item.status ===
        'APPROVED',
    );

  const approvedEntries =
    tournament.approvedEntries;

  const maxGroupCount =
    Math.max(
      1,
      Math.floor(
        approvedEntries / 2,
      ),
    );

  const selectedGroupCount =
    fixtureDrawMode ===
      'GROUPS'
      ? Math.min(
          groupCount,
          maxGroupCount,
        )
      : 1;

  const groupSizes =
    Array.from(
      {
        length:
          selectedGroupCount,
      },
      (_, index) =>
        Math.floor(
          approvedEntries /
            selectedGroupCount,
        ) +
        (index <
        approvedEntries %
          selectedGroupCount
          ? 1
          : 0),
    );

  const expectedRoundRobinFixtures =
    groupSizes.reduce(
      (total, size) =>
        total +
        (size *
          (size - 1)) /
          2,
      0,
    );

  const grouped =
    fixtures.reduce<
      Record<
        string,
        FixtureForUi[]
      >
    >(
      (
        result,
        fixture,
      ) => {
        if (
          !result[
            fixture.roundName
          ]
        ) {
          result[
            fixture.roundName
          ] = [];
        }

        result[
          fixture.roundName
        ].push(fixture);

        return result;
      },
      {},
    );

  return (
    <AppShell
      playerName={
        user.player?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <Link
          href={`/leagues/${tournament.leagueId}/tournaments`}
          className="text-sm font-bold text-slate-500 hover:text-white"
        >
          ← Back to Tournaments
        </Link>

        <section className="rounded-[30px] border border-white/10 bg-[#0a1018] p-6 md:p-9">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-400">
              {
                tournament.mode
              }
            </span>

            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-400">
              {tournament.format.replaceAll(
                '_',
                ' ',
              )}
            </span>

            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-slate-400">
              {tournament.status.replaceAll(
                '_',
                ' ',
              )}
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-black md:text-6xl">
            {tournament.name}
          </h1>

          <p className="mt-2 font-mono text-sm text-sky-400">
            {tournament.code}
          </p>

          {tournament.isLeagueAdmin ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {tournament.status ===
                'DRAFT' ||
              (registrationClosed &&
                fixtures.length ===
                  0) ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    void changeRegistration(
                      'open',
                    )
                  }
                  className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black"
                >
                  Open Registration
                </button>
              ) : null}

              {registrationOpen ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    void changeRegistration(
                      'close',
                    )
                  }
                  className="rounded-xl border border-amber-400/30 px-4 py-3 text-sm font-black text-amber-300"
                >
                  Close Registration
                </button>
              ) : null}


            </div>
          ) : null}
        </section>

        {tournament.isLeagueAdmin &&
        registrationClosed &&
        fixtures.length === 0 ? (
          <section className="rounded-[28px] border border-sky-400/20 bg-[#08111a] p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400">
                  League Admin • Fixture Engine
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Generate Fixtures
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  Choose a single round-robin table or divide approved entries into balanced groups. Each team plays every other team in its own group exactly once.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                  Approved Entries
                </p>

                <p className="mt-1 text-3xl font-black text-white">
                  {approvedEntries}
                </p>
              </div>
            </div>

            {tournament.format ===
            'ROUND_ROBIN' ? (
              <div className="mt-7 space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFixtureDrawMode(
                        'SINGLE',
                      )
                    }
                    className={`rounded-2xl border p-5 text-left transition ${
                      fixtureDrawMode ===
                      'SINGLE'
                        ? 'border-sky-400/50 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      Single Table
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      All {approvedEntries} entries play in one Round Robin table.
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={
                      approvedEntries <
                      4
                    }
                    onClick={() => {
                      setFixtureDrawMode(
                        'GROUPS',
                      );

                      setGroupCount(
                        Math.min(
                          2,
                          maxGroupCount,
                        ),
                      );
                    }}
                    className={`rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      fixtureDrawMode ===
                      'GROUPS'
                        ? 'border-sky-400/50 bg-sky-400/10'
                        : 'border-white/10 bg-black/10'
                    }`}
                  >
                    <p className="font-black">
                      Group Division
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Split entries into balanced Group A, Group B and more.
                    </p>
                  </button>
                </div>

                {fixtureDrawMode ===
                'GROUPS' ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <label className="grid gap-2 text-sm font-black">
                      Number of Groups

                      <input
                        type="number"
                        min="2"
                        max={
                          maxGroupCount
                        }
                        value={
                          groupCount
                        }
                        onChange={(
                          event,
                        ) =>
                          setGroupCount(
                            Math.max(
                              2,
                              Math.min(
                                maxGroupCount,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) ||
                                  2,
                              ),
                            ),
                          )
                        }
                        className="mt-1 rounded-xl border border-white/10 bg-[#080e15] px-4 py-3 text-lg font-black outline-none focus:border-sky-400/60"
                      />
                    </label>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {groupSizes.map(
                        (
                          size,
                          index,
                        ) => (
                          <span
                            key={
                              index
                            }
                            className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs font-black text-sky-300"
                          >
                            Group{' '}
                            {String.fromCharCode(
                              65 +
                                index,
                            )}
                            : {size}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
                  <input
                    type="checkbox"
                    checked={
                      shuffleFixtures
                    }
                    onChange={(
                      event,
                    ) =>
                      setShuffleFixtures(
                        event.target
                          .checked,
                      )
                    }
                    className="h-4 w-4 accent-sky-400"
                  />

                  <span>
                    <span className="block text-sm font-black">
                      Shuffle entries before draw
                    </span>

                    <span className="mt-1 block text-xs text-slate-500">
                      Randomizes group assignment / fixture draw before the round-robin engine runs.
                    </span>
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Structure
                    </p>

                    <p className="mt-2 font-black">
                      {fixtureDrawMode ===
                      'GROUPS'
                        ? `${selectedGroupCount} Groups`
                        : '1 Table'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Fixtures
                    </p>

                    <p className="mt-2 font-black">
                      {
                        expectedRoundRobinFixtures
                      }
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      Rule
                    </p>

                    <p className="mt-2 font-black">
                      Play each opponent once
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    approvedEntries <
                      2
                  }
                  onClick={() =>
                    void generateFixtures()
                  }
                  className="w-full rounded-xl bg-sky-400 px-5 py-4 font-black text-[#041019] disabled:opacity-50"
                >
                  {busy
                    ? 'Generating Fixtures...'
                    : 'Generate Fixture Draw'}
                </button>
              </div>
            ) : (
              <div className="mt-7">
                <p className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
                  Knockout tournaments use a single elimination bracket. Group Division is available for Round Robin tournaments.
                </p>

                <button
                  type="button"
                  disabled={
                    busy ||
                    approvedEntries <
                      2
                  }
                  onClick={() => {
                    setFixtureDrawMode(
                      'SINGLE',
                    );

                    void generateFixtures();
                  }}
                  className="mt-4 w-full rounded-xl bg-sky-400 px-5 py-4 font-black text-[#041019] disabled:opacity-50"
                >
                  {busy
                    ? 'Generating Bracket...'
                    : 'Generate Knockout Bracket'}
                </button>
              </div>
            )}
          </section>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto">
          {[
            'overview',
            'register',
            'fixtures',
          ].map((value) => (
            <button
              key={value}
              onClick={() =>
                setTab(
                  value as Tab,
                )
              }
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                tab === value
                  ? 'bg-sky-400 text-black'
                  : 'border border-white/10 text-slate-400'
              }`}
            >
              {value ===
              'register'
                ? 'Registration'
                : value
                    .charAt(0)
                    .toUpperCase() +
                  value.slice(1)}
            </button>
          ))}

          <Link
            href={`/tournaments/${tournamentId}/standings`}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-400 transition hover:border-sky-400/30 hover:text-sky-300"
          >
            Standings
          </Link>

          {tournament.isLeagueAdmin ? (
            <button
              onClick={() => {
                setTab('admin');
                void loadRegistrations();
              }}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                tab === 'admin'
                  ? 'bg-sky-400 text-black'
                  : 'border border-white/10 text-slate-400'
              }`}
            >
              Admin ({pending.length})
            </button>
          ) : null}
        </div>

        {tab === 'overview' ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
              <h2 className="text-2xl font-black">
                Overview
              </h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">
                {tournament.description ||
                  'No description.'}
              </p>

              <h3 className="mt-7 font-black">
                Rules
              </h3>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                {tournament.rules ||
                  'No rules.'}
              </p>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
              <h2 className="text-2xl font-black">
                Competition
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Approved
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {
                      tournament.approvedEntries
                    }
                    /
                    {
                      tournament.maxEntries
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-600">
                    Fixtures
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {
                      fixtures.length
                    }
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'register' ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <h2 className="text-2xl font-black">
              Registration
            </h2>

            {!registrationOpen ? (
              <p className="mt-5 text-amber-300">
                Registration is closed.
              </p>
            ) : (
              <form
                onSubmit={
                  submitRegistration
                }
                className="mt-5 grid gap-4"
              >
                {tournament.mode !==
                'SOLO' ? (
                  <input
                    name="entryName"
                    required
                    placeholder={
                      tournament.mode ===
                      'DUO'
                        ? 'Duo Name'
                        : 'Team Name'
                    }
                  />
                ) : null}

                <textarea
                  value={playerCodes}
                  onChange={(event) =>
                    setPlayerCodes(
                      event.target.value,
                    )
                  }
                  rows={Math.max(
                    3,
                    tournament.teamSize,
                  )}
                  required
                  className="rounded-xl border border-white/10 bg-[#080e15] p-4"
                  placeholder="FC ARENA Player IDs"
                />

                <button
                  disabled={busy}
                  className="rounded-xl bg-sky-400 px-5 py-3 font-black text-black"
                >
                  Submit Registration
                </button>
              </form>
            )}
          </section>
        ) : null}

        {tab === 'fixtures' ? (
          <div className="space-y-5">
            {tournament.isLeagueAdmin ? (
              <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
                <h2 className="text-xl font-black">
                  Scheduling Settings
                </h2>

                <form
                  onSubmit={
                    updateSettings
                  }
                  className="mt-5 grid gap-3 md:grid-cols-3"
                >
                  <label className="grid gap-2 text-sm">
                    Daily Match Limit

                    <input
                      name="dailyMatchLimit"
                      type="number"
                      min="1"
                      max="256"
                      defaultValue={
                        tournament.dailyMatchLimit
                      }
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    Matches / Player / Day

                    <input
                      name="matchesPerParticipantPerDay"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue={
                        tournament.matchesPerParticipantPerDay
                      }
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    Match Duration Minutes

                    <input
                      name="matchDurationMinutes"
                      type="number"
                      min="10"
                      max="300"
                      defaultValue={
                        tournament.matchDurationMinutes
                      }
                      required
                    />
                  </label>

                  <button className="rounded-xl bg-white px-4 py-3 text-sm font-black text-black md:col-span-3">
                    Save Scheduling Settings
                  </button>
                </form>
              </section>
            ) : null}

            {Object.entries(
              grouped,
            ).map(
              ([
                round,
                items,
              ]) => (
                <section
                  key={round}
                  className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6"
                >
                  <h2 className="text-2xl font-black">
                    {round}
                  </h2>

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {items.map(
                      (fixture) => (
                        <FixtureCard
                          key={
                            fixture.id
                          }
                          fixture={
                            fixture
                          }
                          isAdmin={
                            tournament.isLeagueAdmin
                          }
                          onChanged={
                            loadFixtures
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              ),
            )}

            {fixtures.length ===
            0 ? (
              <p className="rounded-[24px] border border-dashed border-white/10 p-12 text-center text-slate-500">
                No fixtures generated.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === 'admin' &&
        tournament.isLeagueAdmin ? (
          <section className="rounded-[24px] border border-white/10 bg-[#0a1018] p-6">
            <h2 className="text-2xl font-black">
              Registration Review
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Approved: {approved.length}
            </p>

            <div className="mt-5 space-y-3">
              {registrations.map(
                (item) => (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-black">
                        {item.entryName ||
                          item.members[0]
                            ?.user.player
                            ?.identity
                            ?.inGameName ||
                          item.registeredBy
                            .fullName}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.status}
                      </p>
                    </div>

                    {item.status ===
                    'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            void review(
                              item.id,
                              'approve',
                            )
                          }
                          className="rounded-xl bg-emerald-400 px-4 py-2 font-black text-black"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            void review(
                              item.id,
                              'reject',
                            )
                          }
                          className="rounded-xl border border-red-400/20 px-4 py-2 font-black text-red-300"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}