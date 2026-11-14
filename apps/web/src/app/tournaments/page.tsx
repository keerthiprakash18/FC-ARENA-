"use client";
import { useActiveLeague } from '@/lib/active-league';
import { TournamentRegistrationSummary, type RegistrationSummaryData } from '@/components/tournaments/registration-summary';

import { ResumeWizard } from "@/components/tournaments/resume-wizard";
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { confirmNamedDeletion } from "@/components/fc/confirmation-provider";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app/app-shell";

import {
  competitionLabel,
  FcCrest,
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcNotice,
  FcStatusBadge,
} from "@/components/fc/fc-ui";

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from "@/lib/auth-client";


import { FcIcon, type FcIconName } from '@/components/fc/fc-icons';
import styles from './cup.module.css';

interface Membership {
  membershipType: "PRIMARY" | "SECONDARY";

  adminRole: "OWNER" | "ADMIN" | null;

  league: {
    id: string;
    name: string;
    code: string;
  };
}

interface Tournament extends RegistrationSummaryData {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  logoUrl?: string | null;
  mode: string;
  format: string;
  competitionFormat?: string;
  groupMode?: string;
  status: string;
  maxEntries: number;
  approvedEntries: number;
  startAt: string | null;
  endAt?: string | null;
  fixturesGeneratedAt?: string | null;
}

type Filter = "ACTIVE" | "UPCOMING" | "COMPLETED";

type CompetitionFormat =
  | "LEAGUE_ROUND_ROBIN"
  | "DOUBLE_ROUND_ROBIN"
  | "SINGLE_ELIMINATION"
  | "GROUP_STAGE_KNOCKOUT"
  | "ELITE_CUP"
  | "UCL_CUP";

function tournamentFilter(tournament: Tournament): Filter {
  if (["COMPLETED", "CANCELLED"].includes(tournament.status)) {
    return "COMPLETED";
  }

  if (
    tournament.status === "DRAFT" ||
    (tournament.startAt &&
      new Date(tournament.startAt).getTime() > Date.now() &&
      !["ACTIVE", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(
        tournament.status,
      ))
  ) {
    return "UPCOMING";
  }

  return "ACTIVE";
}

function toneForStatus(status: string) {
  if (status === "COMPLETED") {
    return "emerald" as const;
  }

  if (status === "CANCELLED") {
    return "red" as const;
  }

  if (status.includes("REGISTRATION")) {
    return "cyan" as const;
  }

  if (status === "DRAFT") {
    return "amber" as const;
  }

  return "emerald" as const;
}

export default function TournamentsPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedLeagueId, selectLeague] = useActiveLeague(user?.id, memberships, searchParams.get('leagueId'));
  const [record, setRecord] = useState<{ leagueId: string; tournaments: Tournament[] } | null>(null);
  const tournaments = useMemo(() => record?.leagueId === selectedLeagueId ? record.tournaments : [], [record, selectedLeagueId]);
  const requestedView = searchParams.get('view');
  const filter: Filter = requestedView === 'UPCOMING' || requestedView === 'COMPLETED' ? requestedView : 'ACTIVE';
  const requestedFormat = searchParams.get('format');
  const formatFilter = ['LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'SINGLE_ELIMINATION', 'GROUP_STAGE_KNOCKOUT', 'ELITE_CUP', 'UCL_CUP'].includes(requestedFormat ?? '') ? requestedFormat as CompetitionFormat : null;
  function choose(key: string, value: string | null) {
    if (key === 'leagueId' && value) selectLeague(value);
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    window.history.replaceState(null, '', '/tournaments' + (next.size ? '?' + next : ''));
  }
  const setFilter = (value: Filter) => choose('view', value === 'ACTIVE' ? null : value);
  const setFormatFilter = (value: CompetitionFormat | null) => choose('format', value);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [deletingTournamentId, setDeletingTournamentId] = useState<
    string | null
  >(null);

  const initialLoad = useRecoverableLoad(async signal => {
      try {
        const [currentUser, leagueResponse] = await Promise.all([
          getCurrentUser({ signal }),

          authenticatedRequest<{
            data: {
              leagues: Membership[];
            };
          }>("/leagues/my", { signal }),
        ]);

        if (signal.aborted) return;
        setUser(currentUser);

        const leagues = leagueResponse.data.leagues;

        setMemberships(leagues);

      } finally {
        if (!signal.aborted) setLoading(false);
      }
  });

  const tournamentLoad = useRecoverableLoad(async signal => {
    if (!selectedLeagueId) return;
    if (record?.leagueId !== selectedLeagueId) setLoading(true);
    try {
      const response = await authenticatedRequest<{ data: { tournaments: Tournament[] } }>(`/leagues/${selectedLeagueId}/tournaments`, { signal });
      if (!signal.aborted) setRecord({ leagueId: selectedLeagueId, tournaments: response.data.tournaments });
    } finally { if (!signal.aborted) setLoading(false); }
  }, selectedLeagueId);

  const selectedMembership = useMemo(
    () =>
      memberships.find((item) => item.league.id === selectedLeagueId) ?? null,
    [memberships, selectedLeagueId],
  );

  const filtered = useMemo(
    () =>
      tournaments.filter((tournament) => {
        if (tournamentFilter(tournament) !== filter) {
          return false;
        }

        if (!formatFilter) {
          return true;
        }

        const format = tournament.competitionFormat || tournament.format;

        return format === formatFilter;
      }),
    [tournaments, filter, formatFilter],
  );

  const counts = useMemo(
    () => ({
      ACTIVE: tournaments.filter(
        (tournament) => tournamentFilter(tournament) === "ACTIVE",
      ).length,

      UPCOMING: tournaments.filter(
        (tournament) => tournamentFilter(tournament) === "UPCOMING",
      ).length,

      COMPLETED: tournaments.filter(
        (tournament) => tournamentFilter(tournament) === "COMPLETED",
      ).length,
    }),
    [tournaments],
  );

  async function deleteTournament(tournament: Tournament) {
    if (!(tournament.canManageSettings ?? Boolean(selectedMembership?.adminRole))) {
      return;
    }

    const confirmation = await confirmNamedDeletion('Tournament', tournament.name);

    if (confirmation === null) {
      return;
    }

    if (confirmation.trim() !== tournament.name.trim()) {
      setError("Tournament name confirmation does not match.");

      return;
    }

    setDeletingTournamentId(tournament.id);

    setError("");
    setMessage("");

    try {
      await authenticatedRequest(`/tournaments/${tournament.id}`, {
        method: "DELETE",

        body: JSON.stringify({
          confirmName: confirmation,
        }),
      });

      setRecord(current => current ? { ...current, tournaments: current.tournaments.filter(item => item.id !== tournament.id) } : current);
      setMessage(`“${tournament.name}” deleted.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete Tournament.",
      );
    } finally {
      setDeletingTournamentId(null);
    }
  }

  if (initialLoad.error) return <AppShell><FcErrorState message={initialLoad.error} onRetry={initialLoad.retry} /></AppShell>;
  if (!user || (loading && memberships.length === 0)) {
    return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Loading Tournaments..." embedded /></AppShell>;
  }

  const leagueId = selectedMembership?.league.id;
  const studioHref = '/tournaments/studio?leagueId=' + leagueId;
  const manageHref = '/leagues/' + leagueId + '/tournaments?create=1';
  const canCreate = Boolean(selectedMembership?.adminRole);
  const statusLabels = { ACTIVE: 'Live', UPCOMING: 'Upcoming', COMPLETED: 'Completed' };
  const stageLabel = statusLabels[filter];

  return (
    <AppShell currentUser={user} playerName={user.player?.identity?.inGameName} playerRole={selectedMembership?.adminRole || 'Player'}>
      <div className={styles.center}>
        <header className={styles.hero}>
          <div className={styles.heroBody}>
            <h1>Cup Center</h1>
            <p>Follow your league’s tournaments, draws and champions.</p>
            {canCreate && <Link className={styles.goldButton} href={studioHref}><FcIcon name="plus" /> Create tournament</Link>}
          </div>
          <div className={styles.heroTrophy} aria-hidden="true"><FcIcon name="trophy" /></div>
        </header>

        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>
        {!selectedMembership ? (
          <FcEmptyState title="Join a league" description="Join or create a league to access its tournaments." actionLabel="Open leagues" actionHref="/leagues" />
        ) : (
          <>
            <div className={styles.leagueBar}>
              <FcCrest name={selectedMembership.league.name} size="sm" />
              <label>
                <span>League</span>
                <select aria-label="Select tournament league" value={selectedLeagueId ?? ''} onChange={event => choose('leagueId', event.target.value)}>
                  {memberships.map(({ league }) => <option value={league.id} key={league.id}>{league.name}</option>)}
                </select>
              </label>
              <Link href={'/leagues/' + leagueId} aria-label="League overview"><FcIcon name="chevronRight" /></Link>
            </div>
            <div role="group" aria-label="Filter tournaments by status" className={styles.statusBar}>
              {(['ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map(value => (
                <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}>
                  {value === 'ACTIVE' && <span className={styles.liveDot} aria-hidden="true" />}
                  {statusLabels[value]} <strong>{counts[value]}</strong>
                </button>
              ))}
            </div>

            <section aria-labelledby="cup-stage">
              <div className={styles.sectionHead}>
                <h2 id="cup-stage">{stageLabel} tournaments</h2>
                {filter !== 'COMPLETED' && !filtered.length && counts.COMPLETED > 0 && <button type="button" onClick={() => setFilter('COMPLETED')}>View completed</button>}
              </div>
              {formatFilter && <button className={styles.filterClear} type="button" onClick={() => setFormatFilter(null)}>{competitionLabel(formatFilter)} <span aria-hidden="true">×</span><span className="sr-only">, clear format filter</span></button>}
              {tournamentLoad.error ? <FcErrorState message={tournamentLoad.error} onRetry={tournamentLoad.retry} /> : loading || record?.leagueId !== leagueId ? (
                <div className={styles.skeleton} role="status"><span className="sr-only">Loading tournaments</span></div>
              ) : filtered.length ? (
                <div className={styles.tournamentList} key={filter + (formatFilter ?? '')}>
                  {filtered.map((tournament, index) => (
                    <article key={tournament.id} className={index === 0 ? styles.feature : styles.tournamentRow}>
                      <Link href={'/tournaments/' + tournament.id} className={styles.tournamentLink}>
                        <FcCrest name={tournament.name} imageUrl={tournament.logoUrl} size="lg" />
                        <div className={styles.tournamentMeta}>
                          <p>{competitionLabel(tournament.competitionFormat || tournament.format)}</p>
                          <h3>{tournament.name}</h3>
                          <p>{tournament.approvedEntries}/{tournament.maxEntries} approved · {tournament.startAt ? new Date(tournament.startAt).toLocaleDateString('en-GB') : 'Date to be set'}</p>
                        </div>
                        <FcIcon name="chevronRight" />
                      </Link>
                      <div className={styles.cardActions}>
                        <FcStatusBadge label={competitionLabel(tournament.status)} tone={toneForStatus(tournament.status)} />
                        {tournament.status === 'DRAFT' && (tournament.canManageSettings ?? canCreate) && (
                          <Link href={studioHref + '&draft=' + tournament.id}>Resume draft</Link>
                        )}
                        {tournament.status === 'COMPLETED' && <Link href={'/tournaments/' + tournament.id + '/summary'}>View summary</Link>}
                        <details>
                          <summary>Details</summary>
                          <TournamentRegistrationSummary tournament={tournament} />
                          {tournament.status === 'DRAFT' && (tournament.canManageSettings ?? canCreate) && <ResumeWizard tournamentId={tournament.id} />}
                          {(tournament.canManageSettings ?? canCreate) && <button className={styles.danger} type="button" disabled={deletingTournamentId === tournament.id} onClick={() => void deleteTournament(tournament)}>Delete tournament</button>}
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.empty} key={filter + (formatFilter ?? '')}>
                  <span aria-hidden="true"><FcIcon name="trophy" /></span>
                  <div><h3>No {stageLabel.toLowerCase()} tournaments</h3><p>{formatFilter ? 'Clear the format filter to see more tournaments.' : filter === 'ACTIVE' ? 'Live tournaments will appear here once they start.' : 'This league has no tournaments in this view.'}</p></div>
                </div>
              )}
            </section>

            {canCreate && (
              <section aria-labelledby="cup-create">
                <div className={styles.sectionHead}><h2 id="cup-create">Start a tournament</h2></div>
                <div className={styles.modeGrid}>
                  {([
                    ['SOLO', 'Solo', '1 player', 'profile'],
                    ['DUO', 'Duo', '2 players', 'team'],
                    ['TEAM', 'Team', '3–11 players', 'football'],
                  ] satisfies [string, string, string, FcIconName][]).map(([value, label, description, icon]) => (
                    <Link href={studioHref + '&mode=' + value} key={value}>
                      <FcIcon name={icon} /><strong>{label}</strong><span>{description}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="cup-library">
              <div className={styles.sectionHead}><h2 id="cup-library">Competition library</h2></div>
              <div className={styles.library}>
                <button type="button" aria-pressed={formatFilter === 'ELITE_CUP'} onClick={() => setFormatFilter(formatFilter === 'ELITE_CUP' ? null : 'ELITE_CUP')}><FcIcon name="trophy" /> Elite Cup</button>
                <button type="button" aria-pressed={formatFilter === 'UCL_CUP'} onClick={() => setFormatFilter(formatFilter === 'UCL_CUP' ? null : 'UCL_CUP')}><FcIcon name="football" /> UCL Cup</button>
                {canCreate && <Link href={manageHref}><FcIcon name="fixtures" /> Templates</Link>}
                <Link href="/tournaments/history"><FcIcon name="history" /> History</Link>
              </div>
              <details className={styles.formatList}>
                <summary>More competition formats</summary>
                <div className={styles.library}>
                  {(['LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'SINGLE_ELIMINATION', 'GROUP_STAGE_KNOCKOUT'] as const).map(format => (
                    <button key={format} type="button" aria-pressed={formatFilter === format} onClick={() => setFormatFilter(formatFilter === format ? null : format)}>{competitionLabel(format)}</button>
                  ))}
                </div>
              </details>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
