'use client';

import { useState } from 'react';

/** One competitive game per Duo player. Both game results are added for the team winner. */
export type DuoGame = {
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number;
  awayGoals: number;
};
export type DuoEntry = {
  id: string;
  members: Array<{ id: string; fullName: string; inGameName: string | null }>;
};

const members = (entry: DuoEntry | null) =>
  [...(entry?.members ?? [])].sort((a, b) => a.id.localeCompare(b.id));
const label = (member: { inGameName: string | null; fullName: string }) =>
  member.inGameName || member.fullName;

export function readDuoAggregateForm(
  data: FormData,
  home: DuoEntry | null,
  away: DuoEntry | null,
  prefix: string,
): { homeScore: number; awayScore: number; duoGames: DuoGame[] } {
  const homePlayers = members(home);
  const awayPlayers = members(away);
  if (homePlayers.length !== 2 || awayPlayers.length !== 2) {
    throw new Error('Both Duo teams must contain exactly two players before submitting.');
  }
  const games = homePlayers.map((player, index) => {
    const homeInput = data.get(prefix + 'Home' + index);
    const awayInput = data.get(prefix + 'Away' + index);
    const awayPlayerId = data.get(prefix + 'AwayPlayer' + index);
    if (typeof homeInput !== 'string' || !/^\d{1,2}$/.test(homeInput) ||
        typeof awayInput !== 'string' || !/^\d{1,2}$/.test(awayInput) ||
        typeof awayPlayerId !== 'string' || !awayPlayers.some(member => member.id === awayPlayerId)) {
      throw new Error('Enter a valid score for each of the two Duo games.');
    }
    return {
      homePlayerId: player.id,
      awayPlayerId,
      homeGoals: Number(homeInput),
      awayGoals: Number(awayInput),
    };
  });
  if (new Set(games.map(game => game.awayPlayerId)).size !== 2) {
    throw new Error('Each away-side Duo player must play exactly one game.');
  }
  const homeScore = games.reduce((sum, game) => sum + game.homeGoals, 0);
  const awayScore = games.reduce((sum, game) => sum + game.awayGoals, 0);
  if (homeScore > 99 || awayScore > 99) {
    throw new Error('The combined score must be 99 or fewer goals per side.');
  }
  return { homeScore, awayScore, duoGames: games };
}

export function DuoAggregateInputs({
  home, away, prefix, initial, disabled = false,
}: {
  home: DuoEntry | null;
  away: DuoEntry | null;
  prefix: string;
  initial?: DuoGame[] | null;
  disabled?: boolean;
}) {
  const homePlayers = members(home);
  const awayPlayers = members(away);
  const initialByHome = new Map((initial ?? []).map(game => [game.homePlayerId, game]));
  const [scores, setScores] = useState(() => homePlayers.map(player => ({
    home: initialByHome.get(player.id)?.homeGoals.toString() ?? '',
    away: initialByHome.get(player.id)?.awayGoals.toString() ?? '',
  })));
  const [swapAway, setSwapAway] = useState(() =>
    Boolean(homePlayers[0] && initialByHome.get(homePlayers[0].id)?.awayPlayerId === awayPlayers[1]?.id));
  if (homePlayers.length !== 2 || awayPlayers.length !== 2) {
    return <p className="theme-danger" role="alert">Both Duo entries need exactly two verified players before results can be submitted.</p>;
  }

  const update = (index: number, side: 'home' | 'away', value: string) => {
    setScores(current => current.map((item, currentIndex) =>
      currentIndex === index ? { ...item, [side]: value } : item));
  };
  const total = (side: 'home' | 'away') =>
    scores.some(item => item[side] === '') ? '—' :
      scores.reduce((sum, item) => sum + Number(item[side]), 0);

  return <div className="col-span-full grid min-w-0 gap-4 rounded-2xl border border-amber-400/20 bg-black/10 p-4 sm:p-5">
    <header className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Duo aggregate · Two games</p>
      <h3 className="theme-text text-lg font-semibold">Each player plays one game</h3>
      <p className="theme-secondary-text text-sm">The two individual scores are added. The higher combined goal total wins this fixture.</p>
    </header>
    <button type="button" disabled={disabled} onClick={() => setSwapAway(current => !current)}
      className="theme-secondary-button min-h-11 justify-self-start rounded-xl border px-4 py-2 text-sm font-semibold">
      Swap opponent pairings
    </button>
    {homePlayers.map((player, index) => {
      const opponent = awayPlayers[swapAway ? 1 - index : index]!;
      return <div key={player.id} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3">
        <p className="text-xs font-bold text-amber-300">Game {index + 1}</p>
        <p className="break-words text-sm font-semibold">{label(player)} vs {label(opponent)}</p>
        <input type="hidden" name={prefix + 'AwayPlayer' + index} value={opponent.id} />
        <div className="grid grid-cols-2 gap-3">
          {(['home', 'away'] as const).map(side => (
            <label key={side} className="grid min-w-0 gap-2 text-xs font-semibold">
              <span className="break-words">{side === 'home' ? label(player) : label(opponent)} goals</span>
              <input type="number" inputMode="numeric" min={0} max={99} required
                disabled={disabled} name={prefix + (side === 'home' ? 'Home' : 'Away') + index}
                value={scores[index]?.[side] ?? ''} onChange={event => update(index, side, event.target.value)}
                className="theme-input min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-center text-lg font-semibold tabular-nums" />
            </label>
          ))}
        </div>
      </div>;
    })}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[.06] p-4" role="status">
      <span className="text-sm font-semibold">Combined Duo score</span>
      <strong className="text-xl font-bold tabular-nums">{total('home')} – {total('away')}</strong>
    </div>
  </div>;
}
