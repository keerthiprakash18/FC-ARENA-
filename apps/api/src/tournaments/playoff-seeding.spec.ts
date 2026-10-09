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
    const fixtures = generateKnockoutFixtures(plan.seedOrder, plan.bracketSlots);
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


describe('Protected playoff bracket progression', () => {
  function draw(count: number, groupCount = 2) {
    const plan = buildPlayoffSeedPlan(groups(groupCount, count));
    const fixtures = generateKnockoutFixtures(plan.seedOrder, plan.bracketSlots);
    const entrants = (key: string): string[] => {
      const fixture = fixtures.find((item) => item.key === key)!;
      return [
        ...(fixture.homeRegistrationId ? [fixture.homeRegistrationId] : entrants(fixture.homeSourceKey!)),
        ...(fixture.awayRegistrationId ? [fixture.awayRegistrationId] : entrants(fixture.awaySourceKey!)),
      ];
    };
    return { plan, fixtures, entrants };
  }

  it('matches the approved 12-team quarterfinal paths', () => {
    const { fixtures, entrants } = draw(6);
    const quarters = fixtures.filter((f) => f.roundName === 'QUARTER FINAL');
    expect(quarters.map((f) => entrants(f.key))).toEqual([
      ['G1-R1', 'G2-R4', 'G1-R5'],
      ['G2-R2', 'G1-R3', 'G2-R6'],
      ['G2-R1', 'G1-R4', 'G2-R5'],
      ['G1-R2', 'G2-R3', 'G1-R6'],
    ]);
    const firstRound = fixtures.filter((f) => f.roundNumber === 1);
    expect(firstRound).toHaveLength(4);
    expect(firstRound.every((f) => f.homeRegistrationId!.slice(0, 2) !== f.awayRegistrationId!.slice(0, 2))).toBe(true);
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 16])('protects seeds and every progression path with Top-%i groups', (count) => {
    const { plan, fixtures, entrants } = draw(count);
    expect(fixtures).toHaveLength(2 * count - 1);
    const final = fixtures.find((f) => f.roundName === 'FINAL')!;
    expect(entrants(final.key).sort()).toEqual([...plan.seedOrder].sort());
    const semis = fixtures.filter((f) => f.roundName === 'SEMI FINAL');
    expect(entrants(semis[0].key)).toContain('G1-R1');
    expect(entrants(semis[0].key)).not.toContain('G2-R1');
    expect(entrants(semis[1].key)).toContain('G2-R1');
    expect(entrants(semis[0].key)).not.toContain('G1-R2');
    expect(entrants(semis[1].key)).not.toContain('G2-R2');
    const byes = plan.bracketSlots.flatMap((id, i, slots) => i % 2 === 0 && slots[i + 1] === null ? [id] : []);
    expect(byes.sort()).toEqual(plan.seedOrder.slice(0, plan.byeCount).sort());
    for (const fixture of fixtures) {
      for (const source of [fixture.homeSourceKey, fixture.awaySourceKey]) {
        if (!source) continue;
        expect(fixtures.find((f) => f.key === source)!.roundNumber).toBe(fixture.roundNumber - 1);
        expect(fixtures.filter((f) => f.homeSourceKey === source || f.awaySourceKey === source)).toHaveLength(1);
      }
    }
  });

  it('keeps four group winners in separate quarters', () => {
    const { fixtures, entrants } = draw(3, 4);
    const quarters = fixtures.filter((f) => f.roundName === 'QUARTER FINAL');
    expect(quarters.map((f) => entrants(f.key).filter((id) => id.endsWith('-R1')).length)).toEqual([1, 1, 1, 1]);
  });

  it('rejects missing, duplicate and empty-branch slot layouts', () => {
    expect(() => generateKnockoutFixtures(['A', 'B', 'C'], ['A', null, 'B', 'B'])).toThrow();
    expect(() => generateKnockoutFixtures(['A', 'B'], [null, null])).toThrow();
    expect(() => generateKnockoutFixtures(['A', 'B'], ['A', 'X'])).toThrow();
  });
});
