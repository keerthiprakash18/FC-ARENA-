import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  deduplicateFixtureRecords,
  deduplicateVisibleFixtureRecords,
  isCanonicalCompletedFixture,
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
    );


    it(
      'does not let a stale confirmed-result pointer outrank a real completed fixture',
      () => {
        const fixtures =
          deduplicateFixtureRecords(
            [
              {
                id:
                  'stale-legacy',
                sequence:
                  1,
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
                    'stale-result',
                },
              },
              {
                id:
                  'real-completed',
                sequence:
                  2,
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
                    'real-result',
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
          'real-completed',
        );
      },
    );


    it(
      'counts only fixtures that are visibly completed and linked to a CONFIRMED result',
      () => {
        expect(
          isCanonicalCompletedFixture(
            {
              id:
                'completed',
              status:
                'COMPLETED',
              match: {
                status:
                  'COMPLETED',
                confirmedResultSubmissionId:
                  'result-1',
                confirmedResult: {
                  id:
                    'result-1',
                  status:
                    'CONFIRMED',
                },
              },
            },
          ),
        ).toBe(
          true,
        );

        expect(
          isCanonicalCompletedFixture(
            {
              id:
                'phantom',
              status:
                'UNSCHEDULED',
              match: {
                status:
                  'UNSCHEDULED',
                confirmedResultSubmissionId:
                  'result-2',
                confirmedResult: {
                  id:
                    'result-2',
                  status:
                    'CONFIRMED',
                },
              },
            },
          ),
        ).toBe(
          false,
        );

        expect(
          isCanonicalCompletedFixture(
            {
              id:
                'rejected',
              status:
                'COMPLETED',
              match: {
                status:
                  'COMPLETED',
                confirmedResultSubmissionId:
                  'result-3',
                confirmedResult: {
                  id:
                    'result-3',
                  status:
                    'REJECTED',
                },
              },
            },
          ),
        ).toBe(
          false,
        );
      },
    );


    it(
      'shows one canonical logical fixture per Home/Away leg while keeping the real return leg separate',
      () => {
        const fixtures =
          deduplicateVisibleFixtureRecords(
            [
              {
                id:
                  'same-leg-old',
                sequence:
                  1,
                matchday:
                  1,
                homeRegistrationId:
                  'KALKI',
                awayRegistrationId:
                  'DHEENA',
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
                  'same-leg-completed',
                sequence:
                  2,
                matchday:
                  2,
                homeRegistrationId:
                  'DHEENA',
                awayRegistrationId:
                  'KALKI',
                status:
                  'COMPLETED',
                match: {
                  status:
                    'COMPLETED',
                  confirmedResultSubmissionId:
                    'result-leg-1',
                },
              },
              {
                id:
                  'dummy-md3',
                sequence:
                  3,
                matchday:
                  3,
                homeRegistrationId:
                  'C',
                awayRegistrationId:
                  'D',
                status:
                  'UNSCHEDULED',
              },
              {
                id:
                  'return-leg',
                sequence:
                  4,
                matchday:
                  4,
                homeRegistrationId:
                  'DHEENA',
                awayRegistrationId:
                  'KALKI',
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
                  'dummy-md5',
                sequence:
                  5,
                matchday:
                  5,
                homeRegistrationId:
                  'C',
                awayRegistrationId:
                  'A',
                status:
                  'UNSCHEDULED',
              },
              {
                id:
                  'dummy-md6',
                sequence:
                  6,
                matchday:
                  6,
                homeRegistrationId:
                  'D',
                awayRegistrationId:
                  'B',
                status:
                  'UNSCHEDULED',
              },
            ],
            'LEAGUE_ROUND_ROBIN',
            'HOME_AWAY',
          );

        const kalkiDheena =
          fixtures.filter(
            (
              fixture,
            ) =>
              [
                fixture.homeRegistrationId,
                fixture.awayRegistrationId,
              ]
                .filter(Boolean)
                .sort()
                .join(':') ===
              'DHEENA:KALKI',
          );

        expect(
          kalkiDheena,
        ).toHaveLength(
          2,
        );

        expect(
          kalkiDheena.map(
            (
              fixture,
            ) =>
              fixture.id,
          ),
        ).toEqual([
          'same-leg-completed',
          'return-leg',
        ]);
      },
    );


    it(
      'preserves Home & Away legs when the competition format is League Round Robin',
      () => {
        const fixtures =
          deduplicateFixtureRecords(
            [
              {
                id:
                  'league-leg-one',
                sequence:
                  1,
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
                  'league-leg-two',
                sequence:
                  56,
                groupId:
                  null,
                homeRegistrationId:
                  'BILLA',
                awayRegistrationId:
                  'LEO',
                status:
                  'UNSCHEDULED',
                match: {
                  status:
                    'UNSCHEDULED',
                  confirmedResultSubmissionId:
                    null,
                },
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
  },
);
