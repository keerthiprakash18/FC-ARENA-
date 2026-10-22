import { describe, expect, it } from 'vitest';

import {
  generateEliteCupSchedule,
  resolveEliteCupPlayoffQualifierCount,
} from './elite-cup-engine.js';

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `TEAM-${index + 1}`);
}

function pairKey(home: string, away: string): string {
  return [home, away].sort().join(':');
}

describe('Elite Cup engine', () => {
  it.each([
    [2, 1, 1],
    [4, 3, 3],
    [5, 4, 4],
    [7, 5, 6],
    [10, 7, 7],
  ])(
    'creates a valid partial league phase for %i teams',
    (teamCount, requested, expectedEffective) => {
      const schedule = generateEliteCupSchedule(ids(teamCount), requested);

      expect(schedule.effectiveMatchesPerTeam).toBe(expectedEffective);
      expect(schedule.fixtures).toHaveLength(
        (teamCount * expectedEffective) / 2,
      );

      const pairings = new Set<string>();
      const appearances = new Map<number, Set<string>>();
      const counts = new Map<string, number>();
      const homeCounts = new Map<string, number>();

      for (const teamId of ids(teamCount)) {
        counts.set(teamId, 0);
        homeCounts.set(teamId, 0);
      }

      for (const fixture of schedule.fixtures) {
        expect(fixture.homeTeamId).not.toBe(fixture.awayTeamId);

        const key = pairKey(fixture.homeTeamId, fixture.awayTeamId);
        expect(pairings.has(key)).toBe(false);
        pairings.add(key);

        const matchdayTeams = appearances.get(fixture.matchday) ?? new Set();
        expect(matchdayTeams.has(fixture.homeTeamId)).toBe(false);
        expect(matchdayTeams.has(fixture.awayTeamId)).toBe(false);
        matchdayTeams.add(fixture.homeTeamId);
        matchdayTeams.add(fixture.awayTeamId);
        appearances.set(fixture.matchday, matchdayTeams);

        counts.set(
          fixture.homeTeamId,
          (counts.get(fixture.homeTeamId) ?? 0) + 1,
        );
        counts.set(
          fixture.awayTeamId,
          (counts.get(fixture.awayTeamId) ?? 0) + 1,
        );
        homeCounts.set(
          fixture.homeTeamId,
          (homeCounts.get(fixture.homeTeamId) ?? 0) + 1,
        );
      }

      expect(pairings.size).toBe(schedule.fixtures.length);
      for (const teamId of ids(teamCount)) {
        expect(counts.get(teamId)).toBe(expectedEffective);
        const home = homeCounts.get(teamId) ?? 0;
        const away = expectedEffective - home;
        expect(Math.abs(home - away)).toBeLessThanOrEqual(1);
      }
    },
  );

  it('caps requested matches at N - 1 and rounds odd-N odd degrees up', () => {
    const schedule = generateEliteCupSchedule(ids(5), 99);
    expect(schedule.cappedMatchesPerTeam).toBe(4);
    expect(schedule.effectiveMatchesPerTeam).toBe(4);

    const oddDegree = generateEliteCupSchedule(ids(5), 3);
    expect(oddDegree.cappedMatchesPerTeam).toBe(3);
    expect(oddDegree.effectiveMatchesPerTeam).toBe(4);
  });

  it('is deterministic, including home and away assignment', () => {
    const first = generateEliteCupSchedule(ids(8), 4);
    const second = generateEliteCupSchedule(ids(8), 4);
    expect(second).toEqual(first);
  });

  it.each([
    [2, 2],
    [3, 3],
    [4, 4],
    [7, 4],
    [16, 16],
    [17, 16],
    [32, 16],
  ])(
    'resolves automatic playoff qualifiers for %i teams',
    (teamCount, expected) => {
      expect(resolveEliteCupPlayoffQualifierCount(teamCount)).toBe(expected);
    },
  );

  it('accepts a valid explicit qualifier override', () => {
    expect(resolveEliteCupPlayoffQualifierCount(20, 6)).toBe(6);
  });

  it.each([0, 1, 21, 2.5, Number.NaN])(
    'rejects invalid explicit qualifier override %s',
    (override) => {
      expect(() => resolveEliteCupPlayoffQualifierCount(20, override)).toThrow(
        /override/i,
      );
    },
  );

  it('rejects fewer than two teams and duplicate team IDs', () => {
    expect(() => generateEliteCupSchedule(ids(1), 1)).toThrow(/at least 2/i);
    expect(() => generateEliteCupSchedule(['A', 'A'], 1)).toThrow(/unique/i);
  });
});
