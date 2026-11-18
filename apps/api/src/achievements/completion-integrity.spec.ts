import { describe, expect, it } from 'vitest';

import { assertRoundRobinComplete } from './completion-integrity.js';
import { generateUclLeaguePhase } from '../tournaments/ucl-engine.js';
import { generateRoundRobinFixtures } from '../tournaments/fixture-engine.js';

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
  it('validates all 190 legacy league fixtures after conversion and ignores new playoff matches', () => {
    const teamIds = Array.from({ length: 20 }, (_, index) => `DUO-${index + 1}`);
    const stage = generateRoundRobinFixtures(teamIds).map((fixture, index) => ({
      ...completedFixture(`STAGE-${index}`),
      ...fixture,
      sequence: index + 1,
      id: `STAGE-${index}`,
      phase: 'STAGE',
      status: 'COMPLETED',
    }));
    const playoff = {
      ...completedFixture('PLAYOFF-QF-1', 'PLAYOFF'),
      roundNumber: 1,
      matchday: null,
      sequence: 191,
    };
    const tournament = {
      format: 'ROUND_ROBIN', competitionFormat: 'GROUP_STAGE_KNOCKOUT', legType: 'SINGLE_LEG',
    };
    const registrations = teamIds.map(id => ({ id, groupId: null }));
    expect(stage).toHaveLength(190);
    expect(() => assertRoundRobinComplete(tournament, registrations, [...stage, playoff])).not.toThrow();
    expect(() => assertRoundRobinComplete(tournament, registrations, [...stage.slice(1), playoff])).toThrow();
  });

});
