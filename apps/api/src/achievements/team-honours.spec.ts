import { describe, expect, it } from 'vitest';
import { calculateTeamHonours, type TeamHonourFixture } from './team-honours.js';
function fixture(id: string, home: string, away: string, homeScore: number, awayScore: number): TeamHonourFixture {
  return { id, status: 'COMPLETED',
    fixture: { id, status: 'COMPLETED', homeRegistrationId: home, awayRegistrationId: away },
    confirmedResult: { status: 'CONFIRMED', homeScore, awayScore } };
}
describe('official team honours archive', () => {
  const approved = new Set(['A', 'B', 'C']);
  it('persists verified team scores with fair ties across home and away', () => {
    const rows = calculateTeamHonours([
      fixture('ab', 'A', 'B', 3, 0),
      fixture('ac', 'A', 'C', 1, 2),
      fixture('bc', 'B', 'C', 2, 0),
    ], approved);
    expect(rows.goldenBoot.map(row => row.registrationId)).toEqual(['A']);
    expect(rows.defensiveRecord.map(row => row.registrationId)).toEqual(['A']);
    expect(rows.entries.find(row => row.registrationId === 'A')).toMatchObject({
      matches: 2, goalsFor: 4, goalsAgainst: 2, cleanSheets: 1,
    });
  });
  it('never counts unapproved, unconfirmed, invalid or repeated scores', () => {
    const valid = fixture('one', 'A', 'B', 1, 0);
    const duplicate = { ...valid, id: 'duplicate' };
    const pending = { ...fixture('pending', 'A', 'B', 10, 0), confirmedResult: { status: 'PENDING_VERIFICATION', homeScore: 10, awayScore: 0 } };
    const result = calculateTeamHonours([valid, duplicate, pending, fixture('unknown', 'C', 'X', 99, 0)], approved);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.find(row => row.registrationId === 'A')?.matches).toBe(1);
    expect(result.goldenBoot.map(row => row.registrationId)).toEqual(['A']);
  });
  it('does not invent a Golden Boot winner when teams score zero', () => {
    const result = calculateTeamHonours([fixture('nil', 'A', 'B', 0, 0)], approved);
    expect(result.goldenBoot).toEqual([]);
    expect(result.defensiveRecord.map(row => row.registrationId).sort()).toEqual(['A','B']);
  });
  it('does not award clean-sheet honours when all conceded', () => {
    const result = calculateTeamHonours([fixture('1', 'A', 'B', 1, 1)], approved);
    expect(result.defensiveRecord).toEqual([]);
  });
});
