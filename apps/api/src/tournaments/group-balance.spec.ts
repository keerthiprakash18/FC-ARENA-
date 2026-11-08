import { describe, expect, it } from 'vitest';
import { assertBalancedGroupCounts, assertBalancedGroupInputs, groupBalance, groupInputsFingerprint, type GroupInputs } from './group-balance.js';

const inputs = (sizes: number[]): GroupInputs => ({ groups: sizes.map((_, i) => ({ id: 'g' + i, name: 'Group ' + i, position: i + 1 })), entries: sizes.flatMap((count, i) => Array.from({ length: count }, (_, n) => ({ id: `e${i}-${n}`, groupId: 'g' + i, sortOrder: n, createdAt: new Date('2026-11-08T00:00:00Z') }))) });
describe('whole-tournament group balance invariant', () => {
  it('accepts equal groups and the unavoidable one-team remainder for every supported draw size', () => {
    for (let groupCount = 2; groupCount <= 16; groupCount++) for (let count = groupCount * 2; count <= 128; count++) {
      const sizes = Array.from({ length: groupCount }, (_, i) => Math.floor(count / groupCount) + (i < count % groupCount ? 1 : 0));
      expect(() => assertBalancedGroupInputs(inputs(sizes))).not.toThrow();
    }
  });
  it('rejects 7/5 groups while allowing 7/6 when an odd number of teams cannot divide equally', () => {
    expect(() => assertBalancedGroupInputs(inputs([7, 5]))).toThrow(expect.objectContaining({ status: 409, response: { success: false, data: null, error: { code: 'GROUPS_UNBALANCED', message: expect.stringContaining('5–7') } } }));
    expect(() => assertBalancedGroupInputs(inputs([7, 6]))).not.toThrow();
  });
  it('never omits an unassigned approved entry or one carrying a foreign tournament group ID', () => {
    const data = inputs([6, 6]); data.entries.push({ id: 'late', groupId: null, sortOrder: 12, createdAt: new Date() });
    expect(groupBalance(data).unassigned).toBe(1);
    expect(() => assertBalancedGroupInputs(data)).toThrow(expect.objectContaining({ response: expect.objectContaining({ error: expect.objectContaining({ code: 'UNASSIGNED_ENTRIES' }) }) }));
    data.entries.at(-1)!.groupId = 'foreign-group'; expect(groupBalance(data).unassigned).toBe(1);
  });
  it('requires playable groups and detects an empty or excessive group setup', () => {
    for (const sizes of [[], [12], [1, 1], [0, 0], [2, 2, 0]]) expect(() => assertBalancedGroupInputs(inputs(sizes))).toThrow();
    expect(() => assertBalancedGroupCounts([{ name: 'A', count: 6 }, { name: 'B', count: 6 }], 1)).toThrow();
  });
  it('fingerprints ignore read ordering but detect approval changes, membership moves and renamed groups', () => {
    const data = inputs([3, 3]), original = groupInputsFingerprint(data);
    expect(groupInputsFingerprint({ groups: [...data.groups].reverse(), entries: [...data.entries].reverse() })).toBe(original);
    data.entries[0].groupId = 'g1'; expect(groupInputsFingerprint(data)).not.toBe(original);
    data.entries[0].groupId = 'g0'; data.groups[0].name = 'Renamed'; expect(groupInputsFingerprint(data)).not.toBe(original);
    data.groups[0].name = 'Group 0'; data.entries.pop(); expect(groupInputsFingerprint(data)).not.toBe(original);
  });
});

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
    let thrown: { getResponse(): unknown } | undefined;
    try {
      assertBalancedGroups(make([7,6,6,5,6,6,6]), 42);
    } catch (error) {
      thrown = error as { getResponse(): unknown };
    }
    expect(thrown).toBeDefined();
    expect(thrown!.getResponse()).toMatchObject({
      error: { code: 'GROUPS_UNBALANCED' },
    });
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
