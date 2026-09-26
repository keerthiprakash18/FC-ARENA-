import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';

const fixturesServiceSource =
  readFileSync(
    new URL(
      './fixtures.service.ts',
      import.meta.url,
    ),
    'utf8',
  );

describe(
  'fixture scheduling integrity',
  () => {
    it(
      'blocks duplicate participant appearances in the same Matchday',
      () => {
        expect(
          fixturesServiceSource,
        ).toContain(
          'PARTICIPANT_MATCHDAY_CONFLICT',
        );

        expect(
          fixturesServiceSource,
        ).toContain(
          'assertRoundRobinSchedulingIntegrity',
        );
      },
    );

    it(
      'blocks duplicate Round Robin pairings',
      () => {
        expect(
          fixturesServiceSource,
        ).toContain(
          'DUPLICATE_PAIRING',
        );

        expect(
          fixturesServiceSource,
        ).toContain(
          'roundRobinRoundsPerLeg',
        );
      },
    );

    it(
      'keeps Round Robin round number aligned with Matchday',
      () => {
        expect(
          fixturesServiceSource,
        ).toMatch(
          /roundNumber:[\s\S]*isCanonicalRoundRobin[\s\S]*proposedMatchday/,
        );

        expect(
          fixturesServiceSource,
        ).toMatch(
          /roundName:[\s\S]*MATCHDAY/,
        );
      },
    );
  },
);
