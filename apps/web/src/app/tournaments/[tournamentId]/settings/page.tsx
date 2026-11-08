'use client';

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by resource identifiers; loader callback identity must not retrigger network work. */

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import type {
  FormEvent,
} from 'react';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  competitionLabel,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  TournamentNavigation,
} from '@/components/tournaments/tournament-navigation';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';


interface Tournament {
  id: string;
  name: string;
  status: string;
  isLeagueAdmin: boolean;
  canManageAdmins: boolean;
  competitionFormat?: string;
  format: string;
  groupMode?: string;
  legType?: string;
  fixtureMode?: string;
  visibility?: string;
  registrationMode?: string;
  maxEntries: number;
  dailyMatchLimit: number;
  matchesPerParticipantPerDay: number;
  matchDurationMinutes: number;
  resultDeadlineHours: number;
}

interface SmartScheduleResult {
  applied: boolean;
  proposals: Array<{
    fixtureId: string;
    fixtureCode: string;
    scheduledAt: string;
    resultDeadlineAt: string;
  }>;
  conflicts: Array<{
    fixtureId: string;
    fixtureCode: string;
    code: string;
    message: string;
  }>;
}

interface DeadlineCase {
  id: string;
  dueAt: string;
  status: string;
  resolutionNote: string | null;
  fixture: {
    fixtureCode: string;
    scheduledAt: string | null;
    homeRegistration: { entryName: string | null } | null;
    awayRegistration: { entryName: string | null } | null;
  };
}


interface FixtureResetImpact {
  tournamentCode: string;
  tournamentName: string;
  groupMode: string;
  fixtures: number;
  matches: number;
  scheduled: number;
  published: number;
  protectedMatches: number;
  canReset: boolean;
  reason: string | null;
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


export default function TournamentSettingsPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId:
        string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
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
    useState<Registration[]>(
      [],
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    smartSchedule,
    setSmartSchedule,
  ] = useState<SmartScheduleResult | null>(null);

  const [
    deadlineCases,
    setDeadlineCases,
  ] = useState<DeadlineCase[]>([]);

  const [resetImpact, setResetImpact] = useState<FixtureResetImpact | null>(null);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetPanelOpen, setResetPanelOpen] = useState(false);


  async function loadTournament() {
    const response =
      await authenticatedRequest<any>(
        `/tournaments/${tournamentId}`,
      );

    const value:
      Tournament =
      response
        .data
        .tournament;

    setTournament(
      value,
    );

    if (
      value.isLeagueAdmin
    ) {
      const registrationsResponse =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/registrations`,
        );

      setRegistrations(
        registrationsResponse
          .data
          .registrations,
      );
    }

    return value;
  }


  async function loadResetImpact() {
    try {
      const response = await authenticatedRequest<{ data: FixtureResetImpact }>(
        `/tournaments/${tournamentId}/fixtures/reset-impact`,
      );
      setResetImpact(response.data);
    } catch {
      setResetImpact(null);
    }
  }

  async function resetTournamentFixtures() {
    if (!resetImpact || !resetImpact.canReset) return;
    const expected = `RESET ${resetImpact.tournamentCode}`;
    if (resetConfirmation.trim() !== expected) {
      setError('Type the exact confirmation phrase before resetting fixtures.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(
        `/tournaments/${tournamentId}/fixtures/reset`,
        {
          method: 'POST',
          body: JSON.stringify({ confirmation: expected }),
        },
      );
      setResetPanelOpen(false);
      setResetConfirmation('');
      setMessage(response.data.message);
      await loadTournament();
      await loadResetImpact();
      router.push(`/tournaments/${tournamentId}/${resetImpact.groupMode === 'MULTIPLE_GROUPS' ? 'groups' : 'wizard/fixture-settings'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fixture reset failed. No fixture changes were confirmed.');
      await loadResetImpact();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setUser(
          await getCurrentUser(),
        );

        await loadTournament();
        await loadResetImpact();
      } catch {
        router.replace(
          `/tournaments/${tournamentId}`,
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);


  async function changeRegistration(
    action:
      | 'open'
      | 'close',
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          action ===
          'open'
            ? `/tournaments/${tournamentId}/open-registration`
            : `/tournaments/${tournamentId}/close-registration`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update registration.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function review(
    registrationId:
      string,

    action:
      | 'approve'
      | 'reject',
  ) {
    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/registrations/${registrationId}/${action}`,
          {
            method:
              'POST',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review registration.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function updateScheduling(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const data =
      new FormData(
        event.currentTarget,
      );

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      const response =
        await authenticatedRequest<any>(
          `/tournaments/${tournamentId}/scheduling-settings`,
          {
            method:
              'PATCH',

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

                resultDeadlineHours:
                  Number(
                    data.get(
                      'resultDeadlineHours',
                    ),
                  ),
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadTournament();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update scheduling settings.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function runSmartSchedule(
    apply: boolean,
  ) {
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedRequest<{
        data: SmartScheduleResult;
      }>(
        `/tournaments/${tournamentId}/fixtures/smart-schedule`,
        {
          method: 'POST',
          body: JSON.stringify({ apply }),
        },
      );
      setSmartSchedule(response.data);
      setMessage(
        apply && response.data.applied
          ? `Applied ${response.data.proposals.length} conflict-aware fixture slots.`
          : `Previewed ${response.data.proposals.length} fixture slots with ${response.data.conflicts.length} conflicts.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smart scheduling failed.');
    } finally {
      setBusy(false);
    }
  }

  async function loadDeadlineCases() {
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedRequest<{
        data: { cases: DeadlineCase[] };
      }>(`/tournaments/${tournamentId}/deadline-cases`);
      setDeadlineCases(response.data.cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deadline cases could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  async function reviewDeadlineCase(caseId: string, status: 'RESOLVED' | 'WAIVED') {
    setBusy(true);
    try {
      await authenticatedRequest(`/deadline-cases/${caseId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await loadDeadlineCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deadline case could not be reviewed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await authenticatedRequest(`/tournaments/${tournamentId}/template`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setMessage('Tournament template saved for this league.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function exportVerifiedResults() {
    setBusy(true);
    try {
      const response = await authenticatedRequest<{
        data: { filename: string; csv: string };
      }>(`/tournaments/${tournamentId}/export`);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([response.data.csv], { type: 'text/csv;charset=utf-8' }));
      link.download = response.data.filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export could not be created.');
    } finally {
      setBusy(false);
    }
  }


  if (
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen
        label="Loading Tournament Settings..."
      />
    );
  }


  const pending =
    registrations.filter(
      (
        registration,
      ) =>
        registration.status ===
        'PENDING',
    );

  const rows = [
    [
      'Format',
      tournament.competitionFormat ||
      tournament.format,
    ],
    [
      'Group Mode',
      tournament.groupMode,
    ],
    [
      'Leg Type',
      tournament.legType,
    ],
    [
      'Fixture Mode',
      tournament.fixtureMode,
    ],
    [
      'Visibility',
      tournament.visibility,
    ],
    [
      'Registration',
      tournament.registrationMode,
    ],
    [
      'Maximum Entries',
      tournament.maxEntries,
    ],
  ];


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref={
            `/tournaments/${tournamentId}`
          }
          backLabel="Tournament Overview"
          eyebrow={
            tournament.name
          }
          title="Settings"
          subtitle={
            tournament.isLeagueAdmin
              ? 'Tournament administration, registration control and scheduling rules.'
              : 'Tournament configuration.'
          }
          action={
            <FcStatusBadge
              label={
                tournament.status
              }
              tone={
                tournament.status ===
                'DRAFT'
                  ? 'amber'
                  : 'cyan'
              }
            />
          }
        />

        <TournamentNavigation
          tournamentId={
            tournamentId
          }
        />


        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


         <FcPanel className="p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Configuration
          </p>

          <div className="mt-4 divide-y divide-white/[0.06]">
            {rows.map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    String(
                      label,
                    )
                  }
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <p className="text-sm text-slate-500">
                    {
                      label
                    }
                  </p>

                  <p className="text-right text-sm font-black">
                    {
                      competitionLabel(
                        String(
                          value ??
                          '—',
                        ),
                      )
                    }
                  </p>
                </div>
              ),
            )}
          </div>

           {tournament.status ===
             'DRAFT' &&
          tournament.isLeagueAdmin ? (
            <Link
              href={
                `/tournaments/${tournamentId}/wizard/setup`
              }
              className="mt-5 inline-flex rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019]"
            >
              Continue Setup Wizard
            </Link>
           ) : null}

          {tournament.canManageAdmins ? (
            <Link
              href={`/tournaments/${tournamentId}/admins`}
              className="mt-3 inline-flex rounded-xl border border-amber-300/20 px-4 py-3 text-sm font-black text-amber-200"
            >
              Manage Admins
            </Link>
          ) : null}
         </FcPanel>


        {tournament.isLeagueAdmin ? (
          <>
            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Registration Control
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <FcStatusBadge
                  label={
                    tournament.status
                  }
                  tone={
                    tournament.status ===
                    'REGISTRATION_OPEN'
                      ? 'emerald'
                      : 'amber'
                  }
                />

                {tournament.status ===
                  'REGISTRATION_OPEN' ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void changeRegistration(
                        'close',
                      )
                    }
                    className="rounded-xl border border-amber-400/20 px-4 py-3 text-sm font-black text-amber-300 disabled:opacity-40"
                  >
                    Close Registration
                  </button>
                ) : tournament.status ===
                    'DRAFT' ||
                  tournament.status ===
                    'REGISTRATION_CLOSED' ? (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void changeRegistration(
                        'open',
                      )
                    }
                    className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    Open Registration
                  </button>
                ) : null}
              </div>
            </FcPanel>


            <section
              aria-labelledby="fixture-reset-heading"
              className="rounded-[26px] border border-amber-500/40 !bg-[#fff8ed] p-5 !text-[#172b3e] md:p-6"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] !text-[#8a4a07]">
                Tournament Settings · Fixture Management
              </p>
              <h2 id="fixture-reset-heading" className="mt-2 text-xl font-black !text-[#172b3e]">
                Reset Fixtures &amp; Set Up Again
              </h2>
              <p className="mt-2 text-sm leading-6 !text-[#31475a]">
                Created the wrong draw or need to change your groups? Remove all unplayed fixtures
                and start the setup again. Approved teams, tournament settings and group names stay saved.
              </p>
              {resetImpact ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['Fixtures', resetImpact.fixtures],
                    ['Matches', resetImpact.matches],
                    ['Scheduled', resetImpact.scheduled],
                    ['Published', resetImpact.published],
                  ] as const).map(([label, count]) => (
                    <div key={label} className="rounded-xl border border-amber-500/25 bg-white/80 p-3">
                      <p className="text-xs font-semibold !text-[#546476]">{label}</p>
                      <p className="mt-1 text-xl font-black !text-[#172b3e]">{count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm !text-[#7f4b19]">Checking whether fixtures can be reset...</p>
              )}

              {resetImpact?.reason ? (
                <div role="alert" className="mt-4 rounded-xl border border-red-300 !bg-[#fff1f2] p-4 text-sm font-semibold leading-6 !text-[#85232e]">
                  {resetImpact.reason}
                </div>
              ) : null}

              {resetImpact?.canReset ? (
                <>
                  {!resetPanelOpen ? (
                    <button type="button" onClick={() => setResetPanelOpen(true)}
                      className="mt-4 rounded-xl border border-red-700 px-4 py-3 text-sm font-black !text-[#991b1b]">
                      Reset All Fixtures
                    </button>
                  ) : (
                    <div className="mt-4 rounded-xl border border-red-300 bg-white p-4">
                      <p className="font-black !text-[#991b1b]">Permanent fixture reset</p>
                      <p className="mt-2 text-sm leading-6 !text-[#334155]">
                        This deletes {resetImpact.fixtures} fixtures and {resetImpact.matches} unplayed match records,
                        including scheduled dates and published fixture links. Players and groups are retained.
                        Any existing match results or disputes will block this operation automatically.
                      </p>
                      <label className="mt-4 block text-sm font-semibold !text-[#1e293b]">
                        Type <strong className="font-mono">RESET {resetImpact.tournamentCode}</strong> to confirm
                        <input
                          type="text"
                          value={resetConfirmation}
                          onChange={(event) => setResetConfirmation(event.target.value)}
                          autoCapitalize="characters"
                          autoComplete="off"
                          spellCheck={false}
                          className="mt-2 block w-full rounded-xl border border-slate-400 bg-white px-3 py-3 font-mono text-sm !text-[#0f172a]"
                          placeholder={`RESET ${resetImpact.tournamentCode}`}
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" disabled={busy || resetConfirmation.trim() !== `RESET ${resetImpact.tournamentCode}`}
                          onClick={() => void resetTournamentFixtures()}
                          className="rounded-xl !bg-[#b91c1c] px-4 py-3 text-sm font-bold !text-white disabled:opacity-40">
                          {busy ? 'Resetting...' : 'Confirm Reset & Reconfigure'}
                        </button>
                        <button type="button" disabled={busy}
                          onClick={() => { setResetPanelOpen(false); setResetConfirmation(''); }}
                          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold !text-[#334155]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
              {resetImpact?.fixtures === 0 ? (
                <p className="mt-3 text-sm font-semibold !text-[#17603b]">
                  No fixtures generated yet. You can already edit groups and create a new draw.
                </p>
              ) : null}
            </section>

            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Scheduling Rules
              </p>

              <form
                onSubmit={
                  updateScheduling
                }
                className="mt-4 grid gap-4 lg:grid-cols-3"
              >
                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Daily Match Limit
                  </span>

                 <input
                    name="dailyMatchLimit"
                    type="number"
                    min="1"
                    defaultValue={
                      tournament.dailyMatchLimit
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Result Deadline Hours
                  </span>

                  <input
                    name="resultDeadlineHours"
                    type="number"
                    min="1"
                    defaultValue={tournament.resultDeadlineHours}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Matches Per Participant / Day
                  </span>

                  <input
                    name="matchesPerParticipantPerDay"
                    type="number"
                    min="1"
                    defaultValue={
                      tournament.matchesPerParticipantPerDay
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-slate-500">
                    Match Duration Minutes
                  </span>

                  <input
                    name="matchDurationMinutes"
                    type="number"
                    min="5"
                    defaultValue={
                      tournament.matchDurationMinutes
                    }
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  />
                </label>

                <div className="lg:col-span-3">
                  <button
                    disabled={
                      busy
                    }
                    className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-black text-[#031019] disabled:opacity-40"
                  >
                    Save Scheduling Rules
                  </button>
                </div>
              </form>
            </FcPanel>

            <FcPanel className="p-5 sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Organizer Tools
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Preview a schedule before applying it. The planner respects daily capacity, participant limits and result deadlines.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={() => void runSmartSchedule(false)} className="rounded-xl border border-sky-400/30 px-4 py-3 text-sm font-black text-sky-300 disabled:opacity-40">
                  Preview Smart Schedule
                </button>
                <button type="button" disabled={busy} onClick={() => void runSmartSchedule(true)} className="rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-[#031019] disabled:opacity-40">
                  Apply Schedule
                </button>
                <button type="button" disabled={busy} onClick={() => void saveTemplate()} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-40">
                  Save as Template
                </button>
                <button type="button" disabled={busy} onClick={() => void exportVerifiedResults()} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-200 disabled:opacity-40">
                  Export Verified CSV
                </button>
                <button type="button" disabled={busy} onClick={() => void loadDeadlineCases()} className="rounded-xl border border-amber-400/20 px-4 py-3 text-sm font-black text-amber-300 disabled:opacity-40">
                  Review Deadlines
                </button>
              </div>

              {smartSchedule ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Proposed slots</p>
                    <p className="mt-2 text-2xl font-black">{smartSchedule.proposals.length}</p>
                    <ul className="mt-3 space-y-1 text-xs text-slate-400">
                      {smartSchedule.proposals.slice(0, 5).map((proposal) => (
                        <li key={proposal.fixtureId}>{proposal.fixtureCode} · {new Date(proposal.scheduledAt).toLocaleString()}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-300">Conflicts requiring attention</p>
                    <p className="mt-2 text-2xl font-black">{smartSchedule.conflicts.length}</p>
                    <ul className="mt-3 space-y-1 text-xs text-slate-400">
                      {smartSchedule.conflicts.slice(0, 5).map((conflict) => (
                        <li key={conflict.fixtureId}>{conflict.fixtureCode} · {conflict.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {deadlineCases.length ? (
                <div className="mt-5 space-y-2">
                  {deadlineCases.map((deadlineCase) => (
                    <div key={deadlineCase.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4 text-sm">
                      <div>
                        <p className="font-black">{deadlineCase.fixture.fixtureCode} · {deadlineCase.fixture.homeRegistration?.entryName ?? 'TBD'} vs {deadlineCase.fixture.awayRegistration?.entryName ?? 'TBD'}</p>
                        <p className="mt-1 text-xs text-slate-500">Due {new Date(deadlineCase.dueAt).toLocaleString()} · {deadlineCase.status}</p>
                      </div>
                      {deadlineCase.status === 'OPEN' ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void reviewDeadlineCase(deadlineCase.id, 'RESOLVED')} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-[#031019]">Resolve</button>
                          <button type="button" onClick={() => void reviewDeadlineCase(deadlineCase.id, 'WAIVED')} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black">Waive</button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </FcPanel>


            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                    Admin Review
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Pending Registrations
                  </h2>
                </div>

                <FcStatusBadge
                  label={
                    `${pending.length} Pending`
                  }
                  tone="amber"
                />
              </div>

              <div className="grid gap-3">
                {pending.map(
                  (
                    registration,
                  ) => (
                    <FcPanel
                      key={
                        registration.id
                      }
                      className="p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black">
                            {registration.entryName ||
                              registration.members
                                .map(
                                  (
                                    member,
                                  ) =>
                                    member
                                      .user
                                      .player
                                      ?.identity
                                      ?.inGameName ||
                                    member
                                      .user
                                      .fullName,
                                )
                                .join(
                                  ' + ',
                                )}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Registered by{' '}
                            {
                              registration
                                .registeredBy
                                .fullName
                            }
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void review(
                                registration.id,
                                'approve',
                              )
                            }
                            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#031019] disabled:opacity-40"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void review(
                                registration.id,
                                'reject',
                              )
                            }
                            className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-black text-red-300 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </FcPanel>
                  ),
                )}

                {pending.length ===
                0 ? (
                  <FcPanel className="border-dashed p-8 text-center text-sm text-slate-500">
                    No pending Tournament registrations.
                  </FcPanel>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <FcPanel className="p-5">
            <p className="text-sm leading-6 text-slate-500">
              Only authorized League admins can change Tournament registration and scheduling settings.
            </p>
          </FcPanel>
        )}
      </div>
    </AppShell>
  );
}
