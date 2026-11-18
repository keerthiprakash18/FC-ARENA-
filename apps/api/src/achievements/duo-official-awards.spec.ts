import { describe, expect, it } from 'vitest';
import { officialDuoIndividualAwards } from './duo-official-awards.js';
import type { AwardMetricRow } from './award-scoring.js';

function metric(userId: string, goalsFor: number, cleanSheets = 0, matches = 5): AwardMetricRow {
  return {
    userId, matches, wins: 3, draws: 1, losses: 1,
    goalsFor, goalsAgainst: cleanSheets ? 2 : 10, goalDifference: goalsFor - (cleanSheets ? 2 : 10),
    cleanSheets, bigMatchPoints: 0, longestWinStreak: 2,
  };
}

describe('official Duo awards are data-backed and participant-bound', () => {
  it('awards player-level goals only to approved, verified individuals', () => {
    const players = [
      metric('player-a', 12, 2),
      metric('player-b', 8, 3),
      metric('not-registered', 99, 5),
    ];
    const result = officialDuoIndividualAwards(players, new Set(['player-a', 'player-b']));
    expect(result.goldenBoot.map(x => x.userId)).toEqual(['player-a']);
    expect(result.goldenGlove.map(x => x.userId)).toEqual(['player-b']);
    expect(result.playerOfTournament?.userId).not.toBe('not-registered');
  });

  it('does not claim a Golden Glove without any recorded clean sheet', () => {
    const result = officialDuoIndividualAwards(
      [metric('player-a', 4), metric('player-b', 2)],
      new Set(['player-a', 'player-b']),
    );
    expect(result.goldenGlove).toEqual([]);
  });

  it('does not award Player of Tournament from a single game', () => {
    const result = officialDuoIndividualAwards(
      [metric('player-a', 4, 1, 1)],
      new Set(['player-a']),
    );
    expect(result.playerOfTournament).toBeNull();
    expect(result.goldenBoot).toHaveLength(1);
  });

  it('cannot award personal honours when only team aggregate results exist', () => {
    const result = officialDuoIndividualAwards([], new Set(['player-a', 'player-b']));
    expect(result).toEqual({ goldenBoot: [], goldenGlove: [], playerOfTournament: null });
  });

  it('respects a true Golden Boot tie', () => {
    const result = officialDuoIndividualAwards(
      [metric('player-a', 10, 1), metric('player-b', 10, 1)],
      new Set(['player-a', 'player-b']),
    );
    expect(result.goldenBoot).toHaveLength(2);
  });
});
