import { describe, expect, it } from 'vitest';
import { leagueWarCompletionReadiness, assertCompleteWarFixtures } from './league-war-integrity.js';

const war = { playerCount: 2, legType: 'HOME_AWAY', homeLeagueId: 'HOME', awayLeagueId: 'AWAY' };
const roster = [
  { leagueId: 'HOME', userId: 'h1' }, { leagueId: 'HOME', userId: 'h2' },
  { leagueId: 'AWAY', userId: 'a1' }, { leagueId: 'AWAY', userId: 'a2' },
];
const match = (leg: number, homePlayerUserId: string, awayPlayerUserId: string) => ({
  leg, homePlayerUserId, awayPlayerUserId,
  status: 'COMPLETED', resultStatus: 'CONFIRMED', homeScore: 2, awayScore: 1,
});
const valid = [
  match(1, 'h1', 'a1'), match(1, 'h2', 'a2'),
  match(2, 'a1', 'h1'), match(2, 'a2', 'h2'),
];

describe('League War complete readiness before official trophy', () => {
  it('unlocks only after both legs and every canonical pairing are verified', () => {
    expect(leagueWarCompletionReadiness(war, roster, valid)).toEqual({
      required: 4, verified: 4, remaining: 0, disputes: 0, canComplete: true,
    });
    expect(() => assertCompleteWarFixtures(war, roster, valid)).not.toThrow();
  });
  it('never unlocks if result is marked complete but still disputed', () => {
    const matches = valid.map((item, index) => index === 3 ? { ...item, resultStatus: 'DISPUTED' } : item);
    expect(leagueWarCompletionReadiness(war, roster, matches)).toMatchObject({
      verified: 3, remaining: 1, disputes: 1, canComplete: false,
    });
    expect(() => assertCompleteWarFixtures(war, roster, matches)).toThrow();
  });
  it('guards missing/duplicate return legs, even if all presented matches are confirmed', () => {
    const bad = [...valid.slice(0,3), valid[2]];
    expect(leagueWarCompletionReadiness(war, roster, bad)).toMatchObject({
      verified: 4, remaining: 0, canComplete: false,
    });
  });
  it('prevents a war with no actual pairings or unapproved rosters being completed', () => {
    expect(leagueWarCompletionReadiness(war, roster, [])).toMatchObject({
      verified: 0, remaining: 4, canComplete: false,
    });
    expect(leagueWarCompletionReadiness(war, roster.slice(1), valid).canComplete).toBe(false);
  });
  it('supports single-leg matches with confirmed walkovers', () => {
    const single = { ...war, legType: 'SINGLE_LEG' };
    const matches = valid.slice(0,2).map(item => ({ ...item, resultStatus: 'WALKOVER_CONFIRMED' }));
    expect(leagueWarCompletionReadiness(single, roster, matches).canComplete).toBe(true);
  });
});
