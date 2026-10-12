import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  countMissingRequiredFixtureResults,
  requiresConfirmedResultForEveryFixture,
} from './competition-completion.js';

describe(
  'double-leg tournament completion integrity',
  () => {
    it(
      'requires confirmed results for Double Round Robin and Home/Away formats',
      () => {
        expect(
          requiresConfirmedResultForEveryFixture(
            'DOUBLE_ROUND_ROBIN',
            'SINGLE_LEG',
          ),
        ).toBe(true);

        expect(
          requiresConfirmedResultForEveryFixture(
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          ),
        ).toBe(true);

        expect(
          requiresConfirmedResultForEveryFixture(
            'LEAGUE_ROUND_ROBIN',
            'SINGLE_LEG',
          ),
        ).toBe(false);
      },
    );

    it(
      'blocks cancelled or unconfirmed fixtures in a double-leg competition',
      () => {
        const missing =
          countMissingRequiredFixtureResults(
            [
              {
                status: 'COMPLETED',
                confirmedResultSubmissionId:
                  'RESULT-1',
              },
              {
                status: 'CANCELLED',
                confirmedResultSubmissionId:
                  null,
              },
              {
                status: 'COMPLETED',
                confirmedResultSubmissionId:
                  null,
              },
            ],
            'DOUBLE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        expect(missing).toBe(2);
      },
    );

    it(
      'allows completion only when every double-leg fixture has a confirmed score',
      () => {
        const missing =
          countMissingRequiredFixtureResults(
            [
              {
                status: 'COMPLETED',
                confirmedResultSubmissionId:
                  'RESULT-1',
              },
              {
                status: 'COMPLETED',
                confirmedResultSubmissionId:
                  'RESULT-2',
              },
            ],
            'DOUBLE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        expect(missing).toBe(0);
      },
    );
  },
);
