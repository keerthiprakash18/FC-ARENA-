import { describe, expect, it } from 'vitest';

import { generateKnockoutFixtures } from './fixture-engine.js';
import { buildPlayoffSeedPlan } from './playoff-seeding.js';

function groups(groupCount: number, qualifiersPerGroup: number) {
  return Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: `GROUP-${groupIndex + 1}`,
    position: groupIndex + 1,
    qualifiers: Array.from({ length: qualifiersPerGroup }, (_, rank) => ({
      id: `G${groupIndex + 1}-R${rank + 1}`,
    })),
  }));
}

describe('playoff seeding plan', () => {
  it('supports two groups with Top 6 using four byes and four play-in matches', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 6));

    expect(plan.bracketSize).toBe(16);
    expect(plan.byeCount).toBe(4);
    expect(plan.playInMatches).toBe(4);
    expect(plan.seedOrder).toHaveLength(12);
    expect(new Set(plan.seedOrder).size).toBe(12);
    expect(plan.seedOrder.slice(0, 4)).toEqual([
      'G1-R1',
      'G2-R1',
      'G1-R2',
      'G2-R2',
    ]);

    const fixtures = generateKnockoutFixtures(plan.seedOrder);
    expect(fixtures).toHaveLength(11);
    expect(fixtures.filter((fixture) => fixture.roundNumber === 1)).toHaveLength(4);
    expect(fixtures.filter((fixture) => fixture.roundNumber === 2)).toHaveLength(4);
  });

  it('supports Top 3 from two groups without duplicates', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 3));

    expect(plan.bracketSize).toBe(8);
    expect(plan.byeCount).toBe(2);
    expect(plan.playInMatches).toBe(2);
    expect(plan.seedOrder.slice(0, 2)).toEqual(['G1-R1', 'G2-R1']);
    expect(new Set(plan.seedOrder).size).toBe(6);
  });

  it('preserves deterministic cross-group high-v-low ordering for a power-of-two field', () => {
    const plan = buildPlayoffSeedPlan(groups(2, 4));

    expect(plan.byeCount).toBe(0);
    expect(plan.playInMatches).toBe(0);
    expect(plan.seedOrder).toEqual([
      'G1-R1', 'G2-R4',
      'G2-R1', 'G1-R4',
      'G1-R2', 'G2-R3',
      'G2-R2', 'G1-R3',
    ]);
  });

  it('distributes byes by group rank for four groups', () => {
    const plan = buildPlayoffSeedPlan(groups(4, 3));

    expect(plan.bracketSize).toBe(16);
    expect(plan.byeCount).toBe(4);
    expect(plan.seedOrder.slice(0, 4)).toEqual([
      'G1-R1',
      'G2-R1',
      'G3-R1',
      'G4-R1',
    ]);
    expect(new Set(plan.seedOrder).size).toBe(12);
  });
});
