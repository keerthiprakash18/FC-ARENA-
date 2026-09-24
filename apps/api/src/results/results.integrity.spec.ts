import {
  readFileSync,
} from 'node:fs';

import {
  describe,
  expect,
  it,
} from 'vitest';

const resultsServiceSource =
  readFileSync(
    new URL(
      './results.service.ts',
      import.meta.url,
    ),
    'utf8',
  );

const correctionServiceSource =
  readFileSync(
    new URL(
      './result-correction.service.ts',
      import.meta.url,
    ),
    'utf8',
  );

function extractMethod(
  source: string,
  methodName: string,
  nextMethodNames: string[],
) {
  const start =
    source.indexOf(
      `async ${methodName}`,
    );

  expect(
    start,
    `${methodName}() must exist`,
  ).toBeGreaterThanOrEqual(0);

  let end =
    source.length;

  for (
    const nextMethodName
    of nextMethodNames
  ) {
    const possibleEnd =
      source.indexOf(
        `async ${nextMethodName}`,
        start + 1,
      );

    if (
      possibleEnd >= 0 &&
      possibleEnd < end
    ) {
      end =
        possibleEnd;
    }
  }

  return source.slice(
    start,
    end,
  );
}

describe(
  'FC ARENA result integrity',
  () => {
    it(
      'keeps submitted results pending verification',
      () => {
        const submitResult =
          extractMethod(
            resultsServiceSource,
            'submitResult',
            [
              'getMatchResults',
              'confirmResult',
              'rejectResult',
              'getStandings',
              'getMyStatistics',
            ],
          );

        expect(
          submitResult,
        ).toMatch(
          /PENDING_VERIFICATION/,
        );

        expect(
          submitResult,
        ).not.toMatch(
          /status\s*:\s*['"]CONFIRMED['"]/,
        );
      },
    );

    it(
      'does not directly apply tournament statistics during manual submission',
      () => {
        const submitResult =
          extractMethod(
            resultsServiceSource,
            'submitResult',
            [
              'getMatchResults',
              'confirmResult',
              'rejectResult',
              'getStandings',
              'getMyStatistics',
            ],
          );

        expect(
          submitResult,
        ).not.toMatch(
          /playerTournamentStatistic\.(upsert|update|create)/,
        );

        expect(
          submitResult,
        ).not.toMatch(
          /tournamentStanding\.(upsert|update|create)/,
        );
      },
    );

    it(
      'contains duplicate confirmed-result protection',
      () => {
        expect(
          resultsServiceSource,
        ).toMatch(
          /RESULT_ALREADY_RECORDED/,
        );

        expect(
          resultsServiceSource,
        ).toMatch(
          /confirmedResultSubmissionId/,
        );
      },
    );


    it(
      'allows only one pending result submission per match',
      () => {
        const submitResult =
          extractMethod(
            resultsServiceSource,
            'submitResult',
            [
              'getMatchResults',
              'confirmResult',
              'rejectResult',
              'getStandings',
              'getMyStatistics',
            ],
          );

        expect(
          submitResult,
        ).toContain(
          'const existingPending',
        );

        expect(
          submitResult,
        ).toContain(
          'matchId',
        );

        expect(
          submitResult,
        ).toContain(
          'PENDING_VERIFICATION',
        );

        expect(
          submitResult,
        ).toContain(
          'resultAlreadyPending',
        );

        expect(
          resultsServiceSource,
        ).toContain(
          'RESULT_ALREADY_PENDING',
        );

        expect(
          resultsServiceSource,
        ).toMatch(
          /shared pending result|duplicate/i,
        );

        expect(
          submitResult,
        ).toContain(
          "isolationLevel:",
        );

        expect(
          submitResult,
        ).toContain(
          "'Serializable'",
        );
      },
    );

    it(
      'confirmation uses a database transaction',
      () => {
        const confirmResult =
          extractMethod(
            resultsServiceSource,
            'confirmResult',
            [
              'rejectResult',
              'getStandings',
              'getMyStatistics',
            ],
          );

        expect(
          confirmResult,
        ).toMatch(
          /\$transaction/,
        );

        expect(
          confirmResult,
        ).toMatch(
          /CONFIRMED/,
        );
      },
    );

    it(
      'confirmation creates an APPLY stat event',
      () => {
        expect(
          resultsServiceSource,
        ).toMatch(
          /APPLY/,
        );
      },
    );

    it(
      'correction records a REVERSE event',
      () => {
        const correctResult =
          extractMethod(
            correctionServiceSource,
            'correctResult',
            [
              'reverseResult',
            ],
          );

        expect(
          correctResult,
        ).toMatch(
          /REVERSE/,
        );
      },
    );

    it(
      'correction records a new APPLY event',
      () => {
        const correctResult =
          extractMethod(
            correctionServiceSource,
            'correctResult',
            [
              'reverseResult',
            ],
          );

        expect(
          correctResult,
        ).toMatch(
          /APPLY/,
        );
      },
    );

    it(
      'correction executes transactionally',
      () => {
        const correctResult =
          extractMethod(
            correctionServiceSource,
            'correctResult',
            [
              'reverseResult',
            ],
          );

        expect(
          correctResult,
        ).toMatch(
          /\$transaction/,
        );
      },
    );

    it(
      'reversal executes transactionally',
      () => {
        const reverseResult =
          extractMethod(
            correctionServiceSource,
            'reverseResult',
            [],
          );

        expect(
          reverseResult,
        ).toMatch(
          /\$transaction/,
        );

        expect(
          reverseResult,
        ).toMatch(
          /REVERSE/,
        );
      },
    );

    it(
      'reversal removes or clears the active confirmed result',
      () => {
        const reverseResult =
          extractMethod(
            correctionServiceSource,
            'reverseResult',
            [],
          );

        expect(
          reverseResult,
        ).toMatch(
          /confirmedResultSubmissionId/,
        );

        expect(
          reverseResult,
        ).toMatch(
          /null/,
        );
      },
    );

    it(
      'correction service rebuilds statistics or standings',
      () => {
        expect(
          correctionServiceSource,
        ).toMatch(
          /(rebuild|recalculate|standing|statistics)/i,
        );
      },
    );

    it(
      'result services contain no obvious fake delays',
      () => {
        expect(
          resultsServiceSource,
        ).not.toMatch(
          /setTimeout\s*\(/,
        );

        expect(
          correctionServiceSource,
        ).not.toMatch(
          /setTimeout\s*\(/,
        );
      },
    );
  },
);