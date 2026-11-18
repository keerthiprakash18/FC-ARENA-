import { describe, expect, it } from 'vitest';
import { completionPlacementPolicy } from './competition-winner-policy.js';

describe('award and champion completion policy', () => {
  it('never awards first in league as champion after choosing top-eight playoffs', () => {
    const converted = { competitionFormat: 'GROUP_STAGE_KNOCKOUT', format: 'ROUND_ROBIN' };
    expect(completionPlacementPolicy(converted, 0, 0)).toEqual({
      source: 'KNOCKOUT', filterToPlayoffs: true, errorCode: 'PLAYOFF_STAGE_REQUIRED',
    });
    expect(completionPlacementPolicy(converted, 0, 7)).toEqual({
      source: 'KNOCKOUT', filterToPlayoffs: true, errorCode: null,
    });
  });

  it('does not count 190 STAGE fixtures as an existing playoff stage', () => {
    const converted = { competitionFormat: 'GROUP_STAGE_KNOCKOUT', format: 'ROUND_ROBIN' };
    // Caller counts phase=PLAYOFF only. All 190 stage fixtures have groupId=null.
    expect(completionPlacementPolicy(converted, 0, 0).errorCode).toBe('PLAYOFF_STAGE_REQUIRED');
  });

  it('keeps plain round-robin first place as champion', () => {
    expect(completionPlacementPolicy(
      { competitionFormat: 'LEAGUE_ROUND_ROBIN', format: 'ROUND_ROBIN' }, 0, 0,
    ).source).toBe('LEAGUE');
  });

  it.each(['GROUP_STAGE_KNOCKOUT', 'UCL_CUP', 'ELITE_CUP'])(
    '%s grouped/league-stage cup requires a published bracket', (competitionFormat) => {
      expect(completionPlacementPolicy({ competitionFormat, format: 'ROUND_ROBIN' }, 0, 0))
        .toMatchObject({ source: 'KNOCKOUT', filterToPlayoffs: true, errorCode: 'PLAYOFF_STAGE_REQUIRED' });
    },
  );

  it('preserves legacy direct-knockout fixture phase behavior', () => {
    expect(completionPlacementPolicy(
      { competitionFormat: 'SINGLE_ELIMINATION', format: 'KNOCKOUT' }, 0, 0,
    )).toEqual({ source: 'KNOCKOUT', filterToPlayoffs: false, errorCode: null });
  });

  it('prevents a league with actual groups from awarding an overall-table champion', () => {
    expect(completionPlacementPolicy(
      { competitionFormat: 'LEAGUE_ROUND_ROBIN', format: 'ROUND_ROBIN' }, 7, 0,
    ).errorCode).toBe('PLAYOFF_STAGE_REQUIRED');
  });
});
