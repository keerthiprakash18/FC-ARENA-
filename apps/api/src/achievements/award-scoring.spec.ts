import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculatePerformanceRatings,
  tiedGoldenBootWinners,
  tiedGoldenGloveWinners,
  type AwardMetricRow,
} from './award-scoring.js';

function row(
  overrides: Partial<AwardMetricRow>,
): AwardMetricRow {
  return {
    userId: 'player',
    matches: 10,
    wins: 6,
    draws: 2,
    losses: 2,
    goalsFor: 20,
    goalsAgainst: 10,
    goalDifference: 10,
    cleanSheets: 3,
    bigMatchPoints: 0,
    longestWinStreak: 3,
    ...overrides,
  };
}

describe('FC Arena award scoring', () => {
  it('keeps every rating inside the 100 point envelope', () => {
    const ratings = calculatePerformanceRatings([
      row({
        userId: 'a',
        wins: 10,
        draws: 0,
        losses: 0,
        goalsFor: 60,
        goalsAgainst: 0,
        goalDifference: 60,
        cleanSheets: 10,
        bigMatchPoints: 99,
        longestWinStreak: 10,
      }),
    ]);

    expect(ratings[0].rating).toBeLessThanOrEqual(100);
    expect(ratings[0].ratingBreakdown.bigMatches).toBe(15);
  });

  it('uses goals per match after total goals for Golden Boot', () => {
    const winners = tiedGoldenBootWinners([
      row({
        userId: 'efficient',
        matches: 10,
        goalsFor: 20,
      }),
      row({
        userId: 'volume',
        matches: 20,
        goalsFor: 20,
      }),
    ]);

    expect(winners.map((winner) => winner.userId)).toEqual([
      'efficient',
    ]);
  });

  it('allows a complete Golden Boot tie', () => {
    const winners = tiedGoldenBootWinners([
      row({ userId: 'a' }),
      row({ userId: 'b' }),
    ]);

    expect(winners).toHaveLength(2);
  });

  it('uses clean sheets as the primary Golden Glove criterion', () => {
    const winners = tiedGoldenGloveWinners([
      row({
        userId: 'clean-sheets',
        cleanSheets: 6,
        goalsAgainst: 12,
      }),
      row({
        userId: 'low-ga',
        cleanSheets: 5,
        goalsAgainst: 5,
      }),
    ]);

    expect(winners.map((winner) => winner.userId)).toEqual([
      'clean-sheets',
    ]);
  });

  it('uses clean-sheet rate then GA per match as Golden Glove tie breakers', () => {
    const winners = tiedGoldenGloveWinners([
      row({
        userId: 'better-rate',
        matches: 8,
        cleanSheets: 4,
        goalsAgainst: 8,
      }),
      row({
        userId: 'more-matches',
        matches: 10,
        cleanSheets: 4,
        goalsAgainst: 8,
      }),
    ]);

    expect(winners.map((winner) => winner.userId)).toEqual([
      'better-rate',
    ]);
  });

  it('does not reward match volume by itself in the overall rating', () => {
    const ratings = calculatePerformanceRatings([
      row({
        userId: 'efficient',
        matches: 10,
        wins: 8,
        draws: 1,
        losses: 1,
        goalsFor: 25,
        goalsAgainst: 7,
        goalDifference: 18,
        cleanSheets: 5,
      }),
      row({
        userId: 'volume',
        matches: 20,
        wins: 10,
        draws: 4,
        losses: 6,
        goalsFor: 30,
        goalsAgainst: 22,
        goalDifference: 8,
        cleanSheets: 4,
      }),
    ]);

    expect(ratings[0].userId).toBe('efficient');
  });
});
