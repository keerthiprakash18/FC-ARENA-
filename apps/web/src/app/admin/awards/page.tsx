'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminNavigation } from '@/components/admin/admin-navigation';
import { confirmAction } from '@/components/fc/confirmation-provider';
import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';
import { authenticatedRequest } from '@/lib/auth-client';

interface Membership {
  adminRole: 'OWNER' | 'ADMIN' | null;
  league: {
    id: string;
    name: string;
  };
}

interface Tournament {
  id: string;
  name: string;
  code: string;
  mode: string;
  status: string;
}

interface Season {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  minMatches: number;
  rankingSize: number;
  soloOnly: boolean;
  status: string;
  canManage: boolean;
  winnerRating: number | null;
  league: {
    id: string;
    name: string;
  } | null;
  winner: {
    id: string;
    fullName: string;
    player?: {
      identity?: {
        inGameName?: string | null;
      } | null;
    } | null;
  } | null;
  tournaments: Array<{
    tournament: Tournament;
  }>;
}

function addMonths(dateString: string, months: number) {
  const value = new Date(dateString + 'T00:00:00');
  value.setMonth(value.getMonth() + months);
  return value.toISOString().slice(0, 10);
}

function playerName(season: Season) {
  return (
    season.winner?.player?.identity?.inGameName ||
    season.winner?.fullName ||
    '—'
  );
}

export default function AdminAwardsPage() {
  const [adminLeagues, setAdminLeagues] = useState<Membership[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leagueId, setLeagueId] = useState('');
  const [name, setName] = useState('FC Arena Ballon — Season 01');
  const [startAt, setStartAt] = useState('');
  const [duration, setDuration] = useState('3');
  const [customEndAt, setCustomEndAt] = useState('');
  const [minMatches, setMinMatches] = useState('15');
  const [rankingSize, setRankingSize] = useState('20');
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const endAt = useMemo(() => {
    if (!startAt) {
      return '';
    }

    if (duration === 'custom') {
      return customEndAt;
    }

    return addMonths(startAt, Number(duration));
  }, [customEndAt, duration, startAt]);

  async function loadSeasons() {
    const response =
      await authenticatedRequest<any>('/ballon/seasons');

    setSeasons(response.data.seasons ?? []);
  }

  useEffect(() => {
    void (async () => {
      try {
        const leagues =
          await authenticatedRequest<any>('/leagues/my');

        const values: Membership[] =
          leagues.data.leagues.filter(
            (membership: Membership) => Boolean(membership.adminRole),
          );

        setAdminLeagues(values);

        if (values[0]) {
          setLeagueId(values[0].league.id);
        }

        await loadSeasons();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load award management.',
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!leagueId) {
      setTournaments([]);
      setSelectedTournamentIds([]);
      return;
    }

    void authenticatedRequest<any>(
      '/leagues/' + leagueId + '/tournaments',
    )
      .then((response) => {
        const solo = (response.data.tournaments ?? []).filter(
          (tournament: Tournament) => tournament.mode === 'SOLO',
        );

        setTournaments(solo);
        setSelectedTournamentIds([]);
      })
      .catch(() => {
        setTournaments([]);
        setSelectedTournamentIds([]);
      });
  }, [leagueId]);

  function toggleTournament(tournamentId: string) {
    setSelectedTournamentIds((current) =>
      current.includes(tournamentId)
        ? current.filter((id) => id !== tournamentId)
        : [...current, tournamentId],
    );
  }

  async function createSeason() {
    if (!leagueId || !startAt || !endAt || !name.trim()) {
      setError('League, season name, start date and end date are required.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        '/ballon/seasons',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            startAt: new Date(startAt + 'T00:00:00').toISOString(),
            endAt: new Date(endAt + 'T23:59:59').toISOString(),
            minMatches: Number(minMatches),
            rankingSize: Number(rankingSize),
            soloOnly: true,
            leagueId,
            tournamentIds:
              selectedTournamentIds.length > 0
                ? selectedTournamentIds
                : undefined,
          }),
        },
      );

      setMessage(
        'FC Arena Ballon season created as DRAFT. Review it, then start the season to lock its rules.',
      );

      await loadSeasons();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create Ballon season.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function seasonAction(
    season: Season,
    action: 'start' | 'finalize' | 'archive',
  ) {
    const label =
      action === 'start'
        ? 'Start this Ballon season? Scoring rules should not change after this.'
        : action === 'finalize'
          ? 'Finalize this Ballon season and lock the winner permanently?'
          : 'Archive this locked Ballon season?';

    if (!(await confirmAction(label))) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await authenticatedRequest(
        '/ballon/seasons/' + season.id + '/' + action,
        {
          method: 'POST',
        },
      );

      setMessage(
        action === 'start'
          ? 'Ballon season is now LIVE.'
          : action === 'finalize'
            ? 'Ballon season finalized and winners locked.'
            : 'Ballon season archived.',
      );

      await loadSeasons();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update Ballon season.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="Awards Management"
      subtitle="Create and manage FC Arena Ballon seasons. Tournament awards continue to generate automatically from verified results."
    >
      <AdminNavigation />

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

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <FcPanel className="p-6">
          <div className="flex items-center gap-3">
            <img
              src="/awards/fc-arena-ballon-mark.svg"
              alt=""
              className="h-14 w-14 rounded-xl"
            />

            <div>
              <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
                New Season
              </p>
              <h2 className="theme-text mt-1 text-xl font-black">
                Create FC Arena Ballon
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="theme-secondary-text text-xs font-semibold">
                Season name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
              />
            </label>

            <label className="block">
              <span className="theme-secondary-text text-xs font-semibold">
                League
              </span>
              <select
                value={leagueId}
                onChange={(event) => setLeagueId(event.target.value)}
                className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
              >
                <option value="">Select League</option>
                {adminLeagues.map((membership) => (
                  <option
                    key={membership.league.id}
                    value={membership.league.id}
                  >
                    {membership.league.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="theme-secondary-text text-xs font-semibold">
                  Start date
                </span>
                <input
                  type="date"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
                />
              </label>

              <label className="block">
                <span className="theme-secondary-text text-xs font-semibold">
                  Duration
                </span>
                <select
                  value={duration}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDuration(next);

                    if (next === '1') {
                      setMinMatches('6');
                    } else if (next === '2') {
                      setMinMatches('10');
                    } else if (next === '3') {
                      setMinMatches('15');
                    }
                  }}
                  className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
                >
                  <option value="1">1 Month</option>
                  <option value="2">2 Months</option>
                  <option value="3">3 Months</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            {duration === 'custom' ? (
              <label className="block">
                <span className="theme-secondary-text text-xs font-semibold">
                  Custom end date
                </span>
                <input
                  type="date"
                  value={customEndAt}
                  onChange={(event) => setCustomEndAt(event.target.value)}
                  className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
                />
              </label>
            ) : (
              <div className="theme-elevated rounded-xl border p-3">
                <p className="theme-muted text-xs">Calculated end date</p>
                <p className="theme-text mt-1 font-black">
                  {endAt || 'Choose a start date'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="theme-secondary-text text-xs font-semibold">
                  Minimum matches
                </span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={minMatches}
                  onChange={(event) => setMinMatches(event.target.value)}
                  className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
                />
              </label>

              <label className="block">
                <span className="theme-secondary-text text-xs font-semibold">
                  Ranking size
                </span>
                <select
                  value={rankingSize}
                  onChange={(event) => setRankingSize(event.target.value)}
                  className="theme-elevated theme-text mt-2 w-full rounded-xl border px-4 py-3 outline-none"
                >
                  <option value="10">Top 10</option>
                  <option value="20">Top 20</option>
                  <option value="50">Top 50</option>
                </select>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="theme-secondary-text text-xs font-semibold">
                  Eligible SOLO tournaments
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTournamentIds([])}
                  className="theme-text-link text-xs font-black"
                >
                  Use all
                </button>
              </div>

              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                {tournaments.length === 0 ? (
                  <div className="theme-elevated rounded-xl border p-3 text-xs">
                    No SOLO tournaments found for this League. Leaving the selection empty means all eligible SOLO tournaments in the period.
                  </div>
                ) : (
                  tournaments.map((tournament) => (
                    <label
                      key={tournament.id}
                      className="theme-elevated flex cursor-pointer items-center gap-3 rounded-xl border p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTournamentIds.includes(tournament.id)}
                        onChange={() => toggleTournament(tournament.id)}
                      />
                      <span className="min-w-0">
                        <span className="theme-text block truncate text-sm font-black">
                          {tournament.name}
                        </span>
                        <span className="theme-muted text-xs">
                          {tournament.code} · {tournament.status}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void createSeason()}
              className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-black text-[#171005] disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Create Ballon Season'}
            </button>
          </div>
        </FcPanel>

        <FcPanel className="p-6">
          <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
            Scoring Rules
          </p>
          <h2 className="theme-text mt-1 text-xl font-black">
            FC Arena Ballon — 100 Point Rating
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Match Performance', '30', 'Points per match and win performance'],
              ['Attack', '20', 'Goals per match'],
              ['Defence', '15', 'Clean-sheet rate and GA per match'],
              ['Goal Difference', '15', 'Goal difference per match'],
              ['Big Matches + Titles', '15', 'QF, SF, Final, Champion and Runner-Up bonuses'],
              ['Consistency', '5', 'Win rate and winning streak'],
            ].map(([label, points, detail]) => (
              <div
                key={label}
                className="theme-elevated rounded-2xl border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="theme-text font-black">{label}</p>
                  <p className="text-xl font-black text-amber-400">
                    {points}
                  </p>
                </div>
                <p className="theme-muted mt-2 text-xs leading-5">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6">
            Only confirmed canonical results count. Cancelled or unverified matches do not count. Awards V1 Ballon ranking is SOLO-only by default so individual statistics stay fair.
          </div>
        </FcPanel>
      </section>

      <section>
        <p className="theme-text-link text-[10px] font-black uppercase tracking-[0.18em]">
          Ballon Seasons
        </p>
        <h2 className="theme-text mt-1 text-2xl font-black">
          Manage Seasons
        </h2>

        {seasons.length === 0 ? (
          <div className="mt-4">
            <FcEmptyState
              title="No Ballon seasons yet"
              description="Create the first FC Arena Ballon season using the form above."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {seasons.map((season) => (
              <FcPanel key={season.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="theme-muted text-[10px] font-black uppercase tracking-[0.14em]">
                      {season.league?.name ?? 'All Leagues'}
                    </p>
                    <h3 className="theme-text mt-1 text-xl font-black">
                      {season.name}
                    </h3>
                    <p className="theme-muted mt-2 text-xs">
                      {new Date(season.startAt).toLocaleDateString()} —{' '}
                      {new Date(season.endAt).toLocaleDateString()}
                    </p>
                  </div>

                  <FcStatusBadge
                    label={season.status}
                    tone={
                      season.status === 'LIVE'
                        ? 'emerald'
                        : season.status === 'DRAFT'
                          ? 'amber'
                          : 'cyan'
                    }
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="theme-elevated rounded-xl border p-3">
                    <p className="theme-muted text-[10px]">MIN MATCHES</p>
                    <p className="theme-text mt-1 font-black">{season.minMatches}</p>
                  </div>
                  <div className="theme-elevated rounded-xl border p-3">
                    <p className="theme-muted text-[10px]">RANKING</p>
                    <p className="theme-text mt-1 font-black">Top {season.rankingSize}</p>
                  </div>
                  <div className="theme-elevated rounded-xl border p-3">
                    <p className="theme-muted text-[10px]">TOURNAMENTS</p>
                    <p className="theme-text mt-1 font-black">
                      {season.tournaments.length || 'ALL'}
                    </p>
                  </div>
                </div>

                {season.winner ? (
                  <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                    <p className="theme-muted text-[10px] uppercase">
                      Winner
                    </p>
                    <p className="theme-text mt-1 font-black">
                      {playerName(season)}
                    </p>
                    <p className="text-sm font-black text-amber-400">
                      {season.winnerRating ?? '—'} rating
                    </p>
                  </div>
                ) : null}

                {season.canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {season.status === 'DRAFT' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void seasonAction(season, 'start')}
                        className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-[#07150d]"
                      >
                        Start Season
                      </button>
                    ) : null}

                    {season.status === 'LIVE' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void seasonAction(season, 'finalize')}
                        className="rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-[#171005]"
                      >
                        Finalize & Lock
                      </button>
                    ) : null}

                    {season.status === 'LOCKED' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void seasonAction(season, 'archive')}
                        className="theme-action-row rounded-xl border px-4 py-2.5 text-xs font-black"
                      >
                        Archive
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </FcPanel>
            ))}
          </div>
        )}
      </section>
    </SecondaryFeaturePage>
  );
}
