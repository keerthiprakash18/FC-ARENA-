'use client';

import { useState } from 'react';
import { duoPlayerLabel } from './duo-player-label';

/** Individual games contribute to one combined team score. */
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
const label = duoPlayerLabel;

function fixturePairings(home: ReturnType<typeof members>, away: ReturnType<typeof members>, crossPlay: boolean, swap = false) {
  return home.flatMap((player, index) => (crossPlay ? away : [away[swap ? 1 - index : index]!])
    .map(opponent => ({ player, opponent })));
}

export function readDuoAggregateForm(
  data: FormData,
  home: DuoEntry | null,
  away: DuoEntry | null,
  prefix: string,
  gameCount = 2,
): { homeScore: number; awayScore: number; duoGames: DuoGame[] } {
  const homePlayers = members(home);
  const awayPlayers = members(away);
  if (homePlayers.length !== 2 || awayPlayers.length !== 2) {
    throw new Error('Both Duo teams must contain exactly two players before submitting.');
  }
  const games = fixturePairings(homePlayers, awayPlayers, gameCount === 4).map(({ player, opponent }, index) => {
    const homeInput = data.get(prefix + 'Home' + index);
    const awayInput = data.get(prefix + 'Away' + index);
    const awayPlayerId = gameCount === 4 ? opponent.id : data.get(prefix + 'AwayPlayer' + index);
    if (typeof homeInput !== 'string' || !/^\d{1,2}$/.test(homeInput) ||
        typeof awayInput !== 'string' || !/^\d{1,2}$/.test(awayInput) ||
        typeof awayPlayerId !== 'string' || !awayPlayers.some(member => member.id === awayPlayerId)) {
      throw new Error('Enter a valid score for each Duo game.');
    }
    return {
      homePlayerId: player.id,
      awayPlayerId,
      homeGoals: Number(homeInput),
      awayGoals: Number(awayInput),
    };
  });
  if (gameCount !== 4 && new Set(games.map(game => game.awayPlayerId)).size !== 2) {
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
  home, away, prefix, initial, gameCount = 2, disabled = false,
}: {
  home: DuoEntry | null;
  away: DuoEntry | null;
  prefix: string;
  initial?: DuoGame[] | null;
  gameCount?: number;
  disabled?: boolean;
}) {
  const homePlayers = members(home);
  const awayPlayers = members(away);
  const crossPlay = gameCount === 4;
  const [swapAway, setSwapAway] = useState(() =>
    Boolean(homePlayers[0] && initial?.find(game => game.homePlayerId === homePlayers[0].id)?.awayPlayerId === awayPlayers[1]?.id));
  const pairings = homePlayers.length === 2 && awayPlayers.length === 2
    ? fixturePairings(homePlayers, awayPlayers, crossPlay, swapAway) : [];
  const [scores, setScores] = useState(() => pairings.map(({ player, opponent }) => {
    const game = initial?.find(item => item.homePlayerId === player.id && item.awayPlayerId === opponent.id);
    return { home: game?.homeGoals.toString() ?? '', away: game?.awayGoals.toString() ?? '' };
  }));
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
      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Duo aggregate · {gameCount} games</p>
      <h3 className="theme-text text-lg font-semibold">{crossPlay ? "Each player faces both opponents" : "Each player plays one game"}</h3>
      <p className="theme-secondary-text text-sm">The individual scores are added. The higher combined goal total wins this fixture.</p>
    </header>
    {!crossPlay && <button type="button" disabled={disabled} onClick={() => setSwapAway(current => !current)}
      className="theme-secondary-button min-h-11 justify-self-start rounded-xl border px-4 py-2 text-sm font-semibold">
      Swap opponent pairings
    </button>}
    {pairings.map(({ player, opponent }, index) => {
      return <div key={player.id + ":" + opponent.id} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-3">
        <p className="text-xs font-bold text-amber-300">Game {index + 1}</p>
        <p className="[overflow-wrap:anywhere] text-sm font-semibold">{label(player)} vs {label(opponent)}</p>
        <input type="hidden" name={prefix + 'AwayPlayer' + index} value={opponent.id} />
        <div className="grid grid-cols-2 items-end gap-3">
          {(['home', 'away'] as const).map(side => (
            <label key={side} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 text-xs font-semibold">
              <span className="[overflow-wrap:anywhere]">{side === 'home' ? 'Home' : 'Away'}: {side === 'home' ? label(player) : label(opponent)} goals</span>
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
