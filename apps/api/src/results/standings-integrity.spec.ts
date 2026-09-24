import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  canonicalizeRoundRobinStandingsFixtures,
} from './standings-integrity.js';

const registrations = [
  { id: 'A', groupId: 'GROUP-1' },
  { id: 'B', groupId: 'GROUP-1' },
  { id: 'C', groupId: 'GROUP-1' },
  { id: 'D', groupId: 'GROUP-1' },
];

describe(
  'standings fixture integrity',
  () => {
    it(
      'drops stale fixtures from old groups',
      () => {
        const result =
          canonicalizeRoundRobinStandingsFixtures(
            [
              {
                id: 'stale',
                sequence: 1,
                groupId:
                  'OLD-GROUP',
                matchday: 1,
                homeRegistrationId:
                  'A',
                awayRegistrationId:
                  'B',
              },
              {
                id: 'current',
                sequence: 2,
                groupId:
                  'GROUP-1',
                matchday: 1,
                homeRegistrationId:
                  'A',
                awayRegistrationId:
                  'B',
              },
            ],
            registrations,
            {
              competitionFormat:
                'LEAGUE_ROUND_ROBIN',
              legType:
                'SINGLE_LEG',
              tournamentFormat:
                'ROUND_ROBIN',
              hasGroups: true,
            },
          );

        expect(
          result.map(
            (fixture) =>
              fixture.id,
          ),
        ).toEqual([
          'current',
        ]);
      },
    );

    it(
      'allows only one match per participant per Matchday',
      () => {
        const result =
          canonicalizeRoundRobinStandingsFixtures(
            [
              {
                id: 'first',
                sequence: 1,
                groupId:
                  'GROUP-1',
                matchday: 2,
                homeRegistrationId:
                  'A',
                awayRegistrationId:
                  'B',
              },
              {
                id: 'duplicate',
                sequence: 2,
                groupId:
                  'GROUP-1',
                matchday: 2,
                homeRegistrationId:
                  'A',
                awayRegistrationId:
                  'C',
              },
            ],
            registrations,
            {
              competitionFormat:
                'LEAGUE_ROUND_ROBIN',
              legType:
                'SINGLE_LEG',
              tournamentFormat:
                'ROUND_ROBIN',
              hasGroups: true,
            },
          );

        expect(
          result.map(
            (fixture) =>
              fixture.id,
          ),
        ).toEqual([
          'first',
        ]);
      },
    );

    it(
      'keeps Home/Away return fixture only in the second leg',
      () => {
        const result =
          canonicalizeRoundRobinStandingsFixtures(
            [
              {
                id: 'leg-1',
                sequence: 1,
                groupId:
                  'GROUP-1',
                matchday: 1,
                homeRegistrationId:
                  'A',
                awayRegistrationId:
                  'B',
              },
              {
                id: 'bad-reverse',
                sequence: 2,
                groupId:
                  'GROUP-1',
                matchday: 3,
                homeRegistrationId:
                  'B',
                awayRegistrationId:
                  'A',
              },
              {
                id: 'leg-2',
                sequence: 3,
                groupId:
                  'GROUP-1',
                matchday: 4,
                homeRegistrationId:
                  'B',
                awayRegistrationId:
                  'A',
              },
            ],
            registrations,
            {
              competitionFormat:
                'LEAGUE_ROUND_ROBIN',
              legType:
                'HOME_AWAY',
              tournamentFormat:
                'ROUND_ROBIN',
              hasGroups: true,
            },
          );

        expect(
          result.map(
            (fixture) =>
              fixture.id,
          ),
        ).toEqual([
          'leg-1',
          'leg-2',
        ]);
      },
    );
  },
);
