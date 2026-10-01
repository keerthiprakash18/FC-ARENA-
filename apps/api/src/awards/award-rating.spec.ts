import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  scoreAwardCandidates,
  sortGoldenBoot,
  sortGoldenGlove,
} from './award-rating.js';

describe('award rating', () => {
  it('keeps the FC Arena Ballon rating within 0..100', () => {
    const [candidate] =
      scoreAwardCandidates([
        {
          userId: 'u1',
          matches: 20,
          wins: 16,
          draws: 2,
          losses: 2,
          goalsFor: 44,
          goalsAgainst: 12,
          cleanSheets: 9,
          maxWinningStreak: 6,
          bigMatchRaw: 8,
        },
      ]);

    expect(
      candidate.rating,
    ).toBeGreaterThanOrEqual(
      0,
    );

    expect(
      candidate.rating,
    ).toBeLessThanOrEqual(
      100,
    );
  });

  it('uses goals per match as the first Golden Boot tie-break', () => {
    const ranked =
      sortGoldenBoot([
        {
          displayName: 'A',
          goalsFor: 20,
          goalsPerMatch: 2,
          goalDifference: 8,
          wins: 5,
        },
        {
          displayName: 'B',
          goalsFor: 20,
          goalsPerMatch: 1.25,
          goalDifference: 15,
          wins: 8,
        },
      ]);

    expect(
      ranked[0].displayName,
    ).toBe('A');
  });

  it('prioritizes clean sheets for Golden Glove', () => {
    const ranked =
      sortGoldenGlove([
        {
          displayName: 'A',
          cleanSheets: 8,
          cleanSheetRate: 40,
          goalsAgainstPerMatch: 0.7,
          matches: 20,
          goalsAgainst: 14,
        },
        {
          displayName: 'B',
          cleanSheets: 7,
          cleanSheetRate: 50,
          goalsAgainstPerMatch: 0.5,
          matches: 14,
          goalsAgainst: 7,
        },
      ]);

    expect(
      ranked[0].displayName,
    ).toBe('A');
  });
});
