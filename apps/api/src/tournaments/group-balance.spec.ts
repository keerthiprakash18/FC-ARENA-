import { assertBalancedGroups, planGroupRebalance } from './group-balance.js';

const make = (sizes: number[]) =>
  sizes.map((size, i) => ({
    id: `group-${i}`, name: `Group ${i + 1}`,
    registrations: Array.from({ length: size }, (_, j) => ({ id: `team-${i}-${j}` })),
  }));

describe('group draw balance', () => {
  it('accepts 42 teams in seven groups of six', () => {
    expect(() => assertBalancedGroups(make([6,6,6,6,6,6,6]), 42)).not.toThrow();
  });
  it('rejects 7/5 fixture generation even when all 42 teams are assigned', () => {
    try {
      assertBalancedGroups(make([7,6,6,5,6,6,6]), 42);
      fail('Expected a balance validation error');
    } catch (error) {
      expect((error as { getResponse(): unknown }).getResponse()).toMatchObject({
        error: { code: 'GROUPS_UNBALANCED' },
      });
    }
  });
  it('rejects unassigned teams', () => {
    expect(() => assertBalancedGroups(make([6,6,6,5,6,6,6]), 42)).toThrow();
  });
  it('moves exactly one team from the seven-team group to the five-team group', () => {
    const groups = make([7,6,6,5,6,6,6]);
    const changes = planGroupRebalance(groups, []);
    expect(changes).toHaveLength(1);
    expect(changes[0].fromGroupId).toBe('group-0');
    expect(changes[0].groupId).toBe('group-3');
  });
  it('keeps an already balanced draw unchanged', () => {
    expect(planGroupRebalance(make([6,6,6,6,6,6,6]), [])).toEqual([]);
  });
  it('handles non-divisible team counts (43 / 7)', () => {
    const groups = make([8,6,6,5,6,6,6]);
    const changes = planGroupRebalance(groups, []);
    expect(changes).toHaveLength(1);
    const sizes = groups.map((group) => group.registrations.length);
    for (const change of changes) {
      sizes[Number(change.fromGroupId!.slice(6))]--;
      sizes[Number(change.groupId.slice(6))]++;
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
  it('places unassigned teams without disturbing existing groups', () => {
    const groups = make([5,6,6,6,6,6,6]);
    const changes = planGroupRebalance(groups, ['late-team']);
    expect(changes).toEqual([{
      registrationId: 'late-team', fromGroupId: null, groupId: 'group-0',
    }]);
  });
});
