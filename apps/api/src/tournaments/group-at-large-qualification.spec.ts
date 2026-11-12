import { describe, expect, it } from 'vitest';
import { PlayoffsService } from './playoffs.service.js';
import { buildPlayoffSeedPlan, separateOpeningGroupRematches } from './playoff-seeding.js';
import { generateKnockoutFixtures } from './fixture-engine.js';
import { buildUniversalPlayoffPlan } from './universal-playoff-engine.js';
import { describeTournamentFormat } from './tournament-format-guide.js';

function sample() {
  const groups = Array.from({ length: 7 }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Group ${index + 1}`,
    position: index + 1,
  }));
  const entries = groups.flatMap((group, groupIndex) =>
    Array.from({ length: 6 }, (_, index) => ({
      id: `G${groupIndex + 1}-R${index + 1}`,
      entryName: `Entry G${groupIndex + 1} rank ${index + 1}`,
      groupId: group.id,
      groupPosition: index + 1,
      sortOrder: index,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      points: index === 2
        ? 10 + (groupIndex === 2 ? 5 : groupIndex === 4 ? 4 : 0)
        : 30 - index * 10,
      goalDifference: 10 - index,
      goalsFor: 20 - index,
      wins: 6 - index,
    })),
  );
  return { groups, entries };
}

function qualify(
  groups: ReturnType<typeof sample>['groups'],
  entries: ReturnType<typeof sample>['entries'],
  requested: number | null,
) {
  const service = new PlayoffsService({} as never, {} as never);
  const method = (service as unknown as {
    buildQualification: (input: unknown) => {
      entries: Array<{ id: string }>;
      groups: Array<{ id: string; position: number; qualifiers: Array<{ id: string }> }>;
      qualifiersPerGroup: number;
    };
  }).buildQualification.bind(service);
  return method({
    source: 'GROUP_QUALIFIERS',
    tournament: { qualifiersPerGroup: 2, playoffQualifiersTotal: requested },
    groups,
    entries,
    dto: {},
  });
}

describe('42 approved teams / seven groups / 16-team playoff field', () => {
  it('takes seven groups top two plus best two third-place teams with zero byes', () => {
    const { groups, entries } = sample();
    const result = qualify(groups, entries, 16);
    const selectedIds = result.entries.map(row => row.id);
    expect(selectedIds).toHaveLength(16);
    expect(new Set(selectedIds).size).toBe(16);
    expect(result.qualifiersPerGroup).toBe(2);
    expect(selectedIds.filter(id => id.endsWith('R1'))).toHaveLength(7);
    expect(selectedIds.filter(id => id.endsWith('R2'))).toHaveLength(7);
    expect(selectedIds.filter(id => id.endsWith('R3')).sort()).toEqual(['G3-R3', 'G5-R3']);
    expect(entries).toHaveLength(42);

    const plan = buildPlayoffSeedPlan(result.groups);
    expect(plan.bracketSize).toBe(16);
    expect(plan.byeCount).toBe(0);
    expect(plan.seedOrder).toHaveLength(16);
    expect(new Set(plan.seedOrder).size).toBe(16);
    const protectedSlots = separateOpeningGroupRematches(plan.bracketSlots, result.groups);
    const ownerGroup = new Map(result.groups.flatMap(group =>
      group.qualifiers.map(entry => [entry.id, group.id] as const),
    ));
    for (let index = 0; index < protectedSlots.length; index += 2) {
      expect(ownerGroup.get(protectedSlots[index]!)).not.toBe(ownerGroup.get(protectedSlots[index + 1]!));
    }
    expect([...protectedSlots].filter(Boolean).sort()).toEqual([...plan.bracketSlots].filter(Boolean).sort());
    const completePlan = buildUniversalPlayoffPlan('PROTECTED_SEED', plan.seedOrder, protectedSlots);
    expect(completePlan).toMatchObject({ bracketSize: 16, byeCount: 0 });
    expect(completePlan.fixtures).toHaveLength(15);
    const fixtures = generateKnockoutFixtures(plan.seedOrder, protectedSlots);
    expect(fixtures).toHaveLength(15);
    expect(fixtures.filter(fixture => fixture.roundNumber === 1)).toHaveLength(8);
  });

  it('retains legacy per-group-only rules when no total was requested', () => {
    const { groups, entries } = sample();
    const result = qualify(groups, entries, null);
    expect(result.entries).toHaveLength(14);
    expect(result.groups.every(group => group.qualifiers.length === 2)).toBe(true);
  });

  it('rejects a mismatched total rather than silently generating the wrong bracket', () => {
    const { groups, entries } = sample();
    expect(() => qualify(groups, entries, 13)).toThrow('Saved playoff places');
    expect(() => qualify(groups, entries, 22)).toThrow('Saved playoff places');
  });

  it('refuses cross-group next-place selection when group sizes differ', () => {
    const { groups, entries } = sample();
    const uneven = entries.filter(row => row.id !== 'G7-R6');
    expect(() => qualify(groups, uneven, 16)).toThrow('equally sized groups');
  });

  it('reports only direct bands, and warns next-place positions are comparative', () => {
    const { groups } = sample();
    const guide = describeTournamentFormat({
      name: '42 Team UCL-style Cup',
      competitionFormat: 'GROUP_STAGE_KNOCKOUT',
      mode: 'SOLO',
      teamSize: 1,
      maxEntries: 42,
      status: 'ONGOING',
      groupMode: 'MULTIPLE_GROUPS',
      legType: 'SINGLE_LEG',
      fixtureMode: 'AUTOMATIC',
      playoffSource: 'GROUP_QUALIFIERS',
      qualifiersPerGroup: 2,
      playoffQualifiersTotal: 16,
      playoffFormat: 'PROTECTED_SEED',
      playoffSeedingBasis: 'AUTO',
      _count: { registrations: 42 },
      groups: groups.map(group => ({ name: group.name, _count: { registrations: 6 } })),
    });
    expect(guide.qualification).toMatchObject({
      source: 'GROUP_QUALIFIERS',
      state: 'READY',
      total: 16,
      perGroup: 2,
      eliminated: 26,
    });
    expect(guide.qualification.description).toContain('best 2 next-place finishers');
    expect(guide.qualification.bands).toHaveLength(1);
    expect(guide.qualification.bands[0]).toMatchObject({ from: 1, to: 2 });
    expect(guide.note).toContain('Best next-place selection');
  });
});

describe('protected opening group separation with at-large entrants', () => {
  it('keeps already safe bracket slots unchanged', () => {
    const groups = [
      { id: 'G1', position: 1, qualifiers: [{ id: 'A' }, { id: 'D' }] },
      { id: 'G2', position: 2, qualifiers: [{ id: 'B' }, { id: 'C' }] },
    ];
    const safe = ['A', 'B', 'C', 'D'];
    expect(separateOpeningGroupRematches(safe, groups)).toEqual(safe);
  });
  it('rejects an impossible same-group-only draw rather than publishing it', () => {
    expect(() => separateOpeningGroupRematches(['A', 'B', 'C', 'D'], [
      { id: 'G1', position: 1, qualifiers: [
        { id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' },
      ] },
    ])).toThrow('Unable to avoid a first-round rematch');
  });
});
