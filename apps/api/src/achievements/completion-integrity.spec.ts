import { describe, expect, it } from 'vitest';

import { assertRoundRobinComplete } from './completion-integrity.js';

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
  it('accepts a completed partial UCL Cup league phase', () => {
    expect(() =>
      assertRoundRobinComplete(
        {
          format: 'ROUND_ROBIN',
          competitionFormat: 'UCL_CUP',
          legType: 'SINGLE_LEG',
        },
        Array.from({ length: 10 }, (_, index) => ({
          id: `TEAM-${index + 1}`,
          groupId: null,
        })),
        [completedFixture('FIXTURE-1'), completedFixture('FIXTURE-2')],
      ),
    ).not.toThrow();
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
