import { describe, expect, it } from 'vitest';
import { buildUclPlayoffPlan, generateUclLeaguePhase, uclQualification } from './ucl-engine.js';

const ids = (count: number) => Array.from({ length: count }, (_, index) => `team-${index + 1}`);

describe('UCL league phase and knockout format', () => {
  it('gives 36 teams eight matchdays, eight unique opponents, and one home/away opponent per pot', () => {
    const teams = ids(36), schedule = generateUclLeaguePhase(teams);
    expect(schedule.fixtures).toHaveLength(144);
    for (const team of teams) {
      const matches = schedule.fixtures.filter(fixture => [fixture.homeRegistrationId, fixture.awayRegistrationId].includes(team));
      expect(matches).toHaveLength(8);
      expect(new Set(matches.map(fixture => fixture.matchday)).size).toBe(8);
      expect(new Set(matches.map(fixture => fixture.homeRegistrationId === team ? fixture.awayRegistrationId : fixture.homeRegistrationId)).size).toBe(8);
      for (let pot = 0; pot < 4; pot++) {
        expect(matches.filter(fixture => fixture.homeRegistrationId === team && Math.floor(teams.indexOf(fixture.awayRegistrationId) / 9) === pot)).toHaveLength(1);
        expect(matches.filter(fixture => fixture.awayRegistrationId === team && Math.floor(teams.indexOf(fixture.homeRegistrationId) / 9) === pot)).toHaveLength(1);
      }
    }
  });

  it('sends top eight directly to R16 and ranks 9–24 to eight two-legged play-offs', () => {
    expect(uclQualification(36)).toEqual({ qualifiers: 24, direct: 8, knockoutSize: 16 });
    const plan = buildUclPlayoffPlan(ids(36));
    expect(plan.fixtures).toHaveLength(45);
    expect(plan.fixtures.filter(fixture => fixture.roundNumber === 1)).toHaveLength(16);
    expect(plan.fixtures.filter(fixture => fixture.roundNumber === 2)).toHaveLength(16);
    expect(plan.fixtures.filter(fixture => fixture.matchday === null)).toHaveLength(1);
    expect(plan.fixtures.find(fixture => fixture.key === 'ucl-playoff-1-leg-2')).toMatchObject({ homeRegistrationId: 'team-9', awayRegistrationId: 'team-24' });
    expect(plan.seedOrder).not.toContain('team-25');
    const keys = new Set<string>();
    for (const fixture of plan.fixtures) {
      for (const source of [fixture.homeSource, fixture.awaySource]) if (source) expect(keys.has(source.key)).toBe(true);
      keys.add(fixture.key);
    }
  });

  it.each([2,3,5,8,12,21,35,36])('adapts the format to a saved field of %i entries without missing teams', count => {
    const schedule = generateUclLeaguePhase(ids(count));
    expect(new Set(schedule.fixtures.flatMap(fixture => [fixture.homeRegistrationId, fixture.awayRegistrationId])).size).toBe(count);
    const plan = buildUclPlayoffPlan(ids(count));
    expect(plan.fixtures.at(-1)?.roundName).toBe('UCL FINAL');
    expect(plan.fixtures.every(fixture => fixture.homeRegistrationId !== fixture.awayRegistrationId || fixture.homeRegistrationId === null)).toBe(true);
  });
});
