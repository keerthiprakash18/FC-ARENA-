import { describe, expect, it } from 'vitest';

import { assertRoundRobinComplete } from './completion-integrity.js';
import { generateUclLeaguePhase } from '../tournaments/ucl-engine.js';

function completedFixture(id: string, phase = 'STAGE') {
  return {
    id,
    phase,
    status: 'COMPLETED',
    groupId: null,
    roundNumber: 1,
    homeRegistrationId: `${id}-HOME`,
    awayRegistrationId: `${id}-AWAY`,
    match: {
      status: 'COMPLETED',
      confirmedResultSubmissionId: `${id}-RESULT`,
      confirmedResult: {
        id: `${id}-RESULT`,
        status: 'CONFIRMED',
      },
    },
  };
}

describe('tournament completion integrity', () => {
  it('accepts eight opponents per team without requiring a full round robin', () => {
    const teams = Array.from({ length: 36 }, (_, index) => `TEAM-${index + 1}`);
    const fixtures = generateUclLeaguePhase(teams).fixtures.map((fixture, index) => ({
      ...completedFixture(`FIXTURE-${index}`), ...fixture, id: `FIXTURE-${index}`,
    }));
    expect(() =>
      assertRoundRobinComplete(
        {
          format: 'ROUND_ROBIN',
          competitionFormat: 'UCL_CUP',
          legType: 'SINGLE_LEG',
        },
        teams.map(id => ({
          id,
          groupId: null,
        })),
        fixtures,
      ),
    ).not.toThrow();
    expect(() => assertRoundRobinComplete({ format: 'ROUND_ROBIN', competitionFormat: 'UCL_CUP', legType: 'SINGLE_LEG' },
      teams.map(id => ({ id, groupId: null })), fixtures.slice(1))).toThrow();
  });

  it('still rejects an incomplete UCL Cup league phase', () => {
    expect(() =>
      assertRoundRobinComplete(
        {
          format: 'ROUND_ROBIN',
          competitionFormat: 'UCL_CUP',
          legType: 'SINGLE_LEG',
        },
        [{ id: 'TEAM-1', groupId: null }],
        [{
          ...completedFixture('FIXTURE-1'),
          status: 'SCHEDULED',
          match: {
            ...completedFixture('FIXTURE-1').match,
            status: 'SCHEDULED',
          },
        }],
      ),
    ).toThrow();
  });
});
