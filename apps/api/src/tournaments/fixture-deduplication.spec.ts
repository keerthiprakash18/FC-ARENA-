import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  deduplicateFixtureRecords,
} from './fixture-deduplication.js';


describe(
  'fixture deduplication',
  () => {
    it(
      'keeps one canonical fixture for the same single-leg pairing',
      () => {
        const fixtures =
          deduplicateFixtureRecords(
            [
              {
                id:
                  'fixture-old',
                sequence:
                  2,
                groupId:
                  null,
                homeRegistrationId:
                  'LEO',
                awayRegistrationId:
                  'BILLA',
                status:
                  'UNSCHEDULED',
                match: {
                  status:
                    'UNSCHEDULED',
                  confirmedResultSubmissionId:
                    null,
                },
              },
              {
                id:
                  'fixture-confirmed',
                sequence:
                  7,
                groupId:
                  null,
                homeRegistrationId:
                  'BILLA',
                awayRegistrationId:
                  'LEO',
                status:
                  'COMPLETED',
                match: {
                  status:
                    'COMPLETED',
                  confirmedResultSubmissionId:
                    'result-1',
                },
              },
            ],
            'LEAGUE_ROUND_ROBIN',
          );

        expect(
          fixtures,
        ).toHaveLength(
          1,
        );

        expect(
          fixtures[0]?.id,
        ).toBe(
          'fixture-confirmed',
        );
      },
    );


    it(
      'preserves legitimate reversed home-away legs in double round robin',
      () => {
        const fixtures =
          deduplicateFixtureRecords(
            [
              {
                id:
                  'leg-one',
                sequence:
                  1,
                groupId:
                  null,
                homeRegistrationId:
                  'LEO',
                awayRegistrationId:
                  'BILLA',
                status:
                  'SCHEDULED',
                match: {
                  status:
                    'SCHEDULED',
                  confirmedResultSubmissionId:
                    null,
                },
              },
              {
                id:
                  'leg-two',
                sequence:
                  2,
                groupId:
                  null,
                homeRegistrationId:
                  'BILLA',
                awayRegistrationId:
                  'LEO',
                status:
                  'SCHEDULED',
                match: {
                  status:
                    'SCHEDULED',
                  confirmedResultSubmissionId:
                    null,
                },
              },
            ],
            'DOUBLE_ROUND_ROBIN',
          );

        expect(
          fixtures,
        ).toHaveLength(
          2,
        );
      },


    it(
      'preserves reversed legs when Home & Away is configured through legType',
      () => {
        const fixtures =
          deduplicateFixtureRecords(
            [
              {
                id:
                  'leg-one',
                sequence:
                  1,
                groupId:
                  null,
                homeRegistrationId:
                  'LEO',
                awayRegistrationId:
                  'BILLA',
                status:
                  'SCHEDULED',
              },
              {
                id:
                  'leg-two',
                sequence:
                  2,
                groupId:
                  null,
                homeRegistrationId:
                  'BILLA',
                awayRegistrationId:
                  'LEO',
                status:
                  'SCHEDULED',
              },
            ],
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        expect(
          fixtures,
        ).toHaveLength(
          2,
        );
      },
    );
    );
  },
);
