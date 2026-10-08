import { describe, expect, it } from 'vitest';
import { generateKnockoutFixtures } from './fixture-engine.js';
import { buildPlayoffSeedPlan } from './playoff-seeding.js';

function groups(groupCount: number, qualifiersPerGroup: number) {
  return Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: `GROUP-${groupIndex + 1}`, position: groupIndex + 1,
    qualifiers: Array.from({ length: qualifiersPerGroup }, (_, rank) => ({ id: `G${groupIndex + 1}-R${rank + 1}` })),
  }));
}

describe('Established playoff seeding rules', () => {
  it('supports two Top-6 groups with four high-seed byes and four play-ins', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 6));
    expect(plan).toMatchObject({ bracketSize: 16, byeCount: 4, playInMatches: 4 });
    expect(plan.seedOrder.slice(0, 4)).toEqual(['G1-R1', 'G2-R1', 'G1-R2', 'G2-R2']);
    expect(new Set(plan.seedOrder).size).toBe(12);
    const fixtures = generateKnockoutFixtures(plan.seedOrder);
    expect(fixtures).toHaveLength(11);
    expect(fixtures.filter((fixture) => fixture.roundNumber === 1)).toHaveLength(4);
    expect(fixtures.filter((fixture) => fixture.roundNumber === 2)).toHaveLength(4);
  });
  it('supports Top-3 groups without duplicate or missing qualifiers', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 3));
    expect(plan).toMatchObject({ bracketSize: 8, byeCount: 2, playInMatches: 2 });
    expect(plan.seedOrder.slice(0, 2)).toEqual(['G1-R1', 'G2-R1']);
    expect(new Set(plan.seedOrder).size).toBe(6);
  });
  it('preserves cross-group high-v-low seeding for power-of-two brackets', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 4));
    expect(plan.byeCount).toBe(0);
    expect(plan.seedOrder).toEqual(['G1-R1', 'G2-R4', 'G2-R1', 'G1-R4', 'G1-R2', 'G2-R3', 'G2-R2', 'G1-R3']);
  });
  it('distributes four-group byes by group rank', () => {
    const plan = buildPlayoffSeedPlan(groups(4, 3));
    expect(plan).toMatchObject({ bracketSize: 16, byeCount: 4 });
    expect(plan.seedOrder.slice(0, 4)).toEqual(['G1-R1', 'G2-R1', 'G3-R1', 'G4-R1']);
    expect(new Set(plan.seedOrder).size).toBe(12);
  });
  it('rejects duplicate qualifiers before bracket generation', () => {
    expect(() => buildPlayoffSeedPlan([{ id: 'A', position: 1, qualifiers: [{ id: 'duplicate' }, { id: 'duplicate' }] }])).toThrow('Duplicate');
  });
});
