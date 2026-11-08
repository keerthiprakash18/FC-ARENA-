import { describe, expect, it } from 'vitest';
import { generateDoubleRoundRobinFixtures, generateRoundRobinFixtures } from './fixture-engine.js';
import { canonicalizeRoundRobinStandingsFixtures, roundRobinRoundsPerLeg } from '../results/standings-integrity.js';
import { groupFixtureProtectionReason, isGroupFixtureProtected, planGroupFixtureChanges, type GroupFixtureReconciliationInput, type OldGroupFixture } from './group-fixture-reconciliation.js';

const group = (id: string, count: number, position = 1) => ({ id, name: 'Group ' + id, position, registrationIds: Array.from({ length: count }, (_, i) => id + i) });
function generated(groups: GroupFixtureReconciliationInput['groups'], double = false): OldGroupFixture[] {
  return groups.flatMap(g => (double ? generateDoubleRoundRobinFixtures(g.registrationIds) : generateRoundRobinFixtures(g.registrationIds)).map((f, i) => ({
    id: `${g.id}-fixture-${i}`, fixtureCode: `${g.id.toUpperCase()}-F-${i}`, groupId: g.id, homeRegistrationId: f.homeRegistrationId, awayRegistrationId: f.awayRegistrationId,
    phase: 'STAGE', status: 'UNSCHEDULED', roundNumber: f.roundNumber, matchday: f.matchday, roundName: `${g.name} - ${f.roundName}`, bracketPosition: f.bracketPosition,
    publishedAt: '2026-11-08T10:00:00Z', scheduledAt: null,
    match: { id: `${g.id}-match-${i}`, status: 'UNSCHEDULED', confirmedResultSubmissionId: null, homeReadyAt: null, awayReadyAt: null, arenaPost: null, _count: { resultSubmissions: 0, statEvents: 0, ocrExtractions: 0, disputes: 0 } },
  })));
}
const sizes = (groups: GroupFixtureReconciliationInput['groups']) => Object.fromEntries(groups.map(g => [g.id, g.registrationIds.length]));
function recorded(f: OldGroupFixture) {
  f.status = 'COMPLETED'; f.match!.status = 'COMPLETED'; f.match!.confirmedResultSubmissionId = 'confirmed-' + f.id;
  f.match!._count.resultSubmissions = 1; f.match!._count.statEvents = 1;
  return f;
}
function afterPlan(input: GroupFixtureReconciliationInput) {
  const plan = planGroupFixtureChanges(input), removed = new Set(plan.removeFixtureIds), updates = new Map(plan.updates.map(f => [f.id, f]));
  return { plan, fixtures: [...input.fixtures.filter(f => !removed.has(f.id)).map(f => ({ ...f, ...updates.get(f.id) })), ...plan.creates.map((f, i) => ({ ...f, id: 'new-' + i, phase: 'STAGE' }))] };
}

describe('safe group fixture reconciliation', () => {
  it.each(Array.from({ length: 14 }, (_, i) => i + 3))('keeps every pair canonical across odd/even parity changes when balancing %i-team groups', size => {
    for (const double of [false, true]) {
      const old = [group('a', size + 1), group('b', size - 1, 2)];
      const moving = 'a' + size;
      const groups = [{ ...old[0], registrationIds: old[0].registrationIds.slice(0, size) }, { ...old[1], registrationIds: [...old[1].registrationIds, moving] }];
      const { fixtures } = afterPlan({ groups, oldGroupSizes: sizes(old), fixtures: generated(old, double), legType: double ? 'HOME_AWAY' : 'SINGLE_LEG' });
      expect(fixtures).toHaveLength(size * (size - 1) * (double ? 2 : 1));
      const scope = groups.flatMap(g => g.registrationIds.map(id => ({ id, groupId: g.id })));
      expect(canonicalizeRoundRobinStandingsFixtures(fixtures, scope, { competitionFormat: double ? 'DOUBLE_ROUND_ROBIN' : 'GROUP_STAGE_KNOCKOUT', legType: double ? 'HOME_AWAY' : 'SINGLE_LEG', tournamentFormat: 'ROUND_ROBIN', hasGroups: true })).toHaveLength(fixtures.length);
    }
  });

  it('repairs the reported 7/5 draw to 6/6 while retaining all 25 unchanged pairs and creating only five new pairs', () => {
    const old = [group('a', 7), group('d', 5, 4)], fixtures = generated(old), before = structuredClone(fixtures);
    const groups = [{ ...old[0], registrationIds: old[0].registrationIds.slice(0, 6) }, { ...old[1], registrationIds: [...old[1].registrationIds, 'a6'] }];
    const { plan, fixtures: result } = afterPlan({ groups, oldGroupSizes: sizes(old), fixtures, legType: 'SINGLE_LEG' });
    expect(plan.updates).toHaveLength(25); expect(plan.creates).toHaveLength(5); expect(plan.removeFixtureIds).toHaveLength(6);
    expect(plan.removeFixtureIds.every(id => { const f = fixtures.find(row => row.id === id)!; return f.homeRegistrationId === 'a6' || f.awayRegistrationId === 'a6'; })).toBe(true);
    expect(result).toHaveLength(30); expect(result.filter(f => f.groupId === 'a')).toHaveLength(15); expect(result.filter(f => f.groupId === 'd')).toHaveLength(15);
    expect(fixtures).toEqual(before);
    for (const update of plan.updates) { expect(update).not.toHaveProperty('homeRegistrationId'); expect(update).not.toHaveProperty('scheduledAt'); expect(update).not.toHaveProperty('status'); expect(update).not.toHaveProperty('match'); }
  });

  it('never plans an operation for fixtures outside the affected group subset', () => {
    const all = [group('a', 7), group('b', 6, 2), group('d', 5, 3)], allFixtures = generated(all);
    const affected = [all[0], all[2]], requested = [{ ...affected[0], registrationIds: affected[0].registrationIds.slice(0, 6) }, { ...affected[1], registrationIds: [...affected[1].registrationIds, 'a6'] }];
    const plan = planGroupFixtureChanges({ groups: requested, fixtures: allFixtures.filter(f => f.groupId !== 'b'), oldGroupSizes: sizes(all), legType: 'SINGLE_LEG' });
    const changed = new Set([...plan.updates.map(f => f.id), ...plan.removeFixtureIds]); expect(allFixtures.filter(f => f.groupId === 'b').every(f => !changed.has(f.id))).toBe(true);
  });

  it('preserves played pairs, IDs and every result/proof/schedule field when their connected component moves together', () => {
    const old = [group('a', 3), group('b', 3, 2)], fixtures = generated(old);
    const protectedFixture = recorded(fixtures.find(f => [f.homeRegistrationId, f.awayRegistrationId].includes('a0') && [f.homeRegistrationId, f.awayRegistrationId].includes('a1'))!);
    protectedFixture.scheduledAt = '2026-11-08T10:00:00Z'; protectedFixture.match!.arenaPost = { id: 'post' }; protectedFixture.deadlineCase = { id: 'deadline' };
    const before = structuredClone(protectedFixture);
    const groups = [{ ...old[0], registrationIds: ['a2', 'b0', 'b1', 'b2'] }, { ...old[1], registrationIds: ['a0', 'a1'] }];
    const { plan, fixtures: result } = afterPlan({ groups, fixtures, oldGroupSizes: sizes(old), legType: 'SINGLE_LEG' });
    expect(plan.removeFixtureIds).not.toContain(protectedFixture.id);
    const kept = result.find(f => f.id === protectedFixture.id)!;
    expect(kept).toMatchObject({ id: before.id, fixtureCode: before.fixtureCode, groupId: 'b', homeRegistrationId: before.homeRegistrationId, awayRegistrationId: before.awayRegistrationId, scheduledAt: before.scheduledAt, status: before.status, match: before.match, deadlineCase: before.deadlineCase });
    expect(protectedFixture).toEqual(before);
  });

  it('rejects a move splitting a played pair, with its fixture code and an actionable conflict', () => {
    const old = [group('a', 3), group('b', 3, 2)], fixtures = generated(old), f = recorded(fixtures[0]);
    const moved = f.homeRegistrationId!;
    const groups = [{ ...old[0], registrationIds: old[0].registrationIds.filter(id => id !== moved) }, { ...old[1], registrationIds: [...old[1].registrationIds, moved] }];
    expect(() => planGroupFixtureChanges({ groups, fixtures, oldGroupSizes: sizes(old), legType: 'SINGLE_LEG' })).toThrowError(expect.objectContaining({ status: 409, response: expect.objectContaining({ error: expect.objectContaining({ code: 'GROUP_FIXTURE_HAS_ACTIVITY', fixtureCode: f.fixtureCode, message: expect.stringContaining('Keep both teams together') }) }) }));
  });

  it.each(['LIVE', 'CANCELLED', 'COMPLETED'])('protects existing fixture status %s from removal', status => {
    const f = generated([group('a', 2)])[0]; f.status = status; expect(isGroupFixtureProtected(f)).toBe(true);
  });

  it.each(['resultSubmissions', 'statEvents', 'ocrExtractions', 'disputes'] as const)('protects recorded %s even if its match still says UNSCHEDULED', field => {
    const f = generated([group('a', 2)])[0]; f.match!._count[field] = 1; expect(isGroupFixtureProtected(f)).toBe(true);
  });

  it('protects readiness, Arena posts, deadline cases and unverifiable match activity', () => {
    for (const edit of [
      (f: OldGroupFixture) => { f.match!.homeReadyAt = new Date(); },
      (f: OldGroupFixture) => { f.match!.awayReadyAt = new Date(); },
      (f: OldGroupFixture) => { f.match!.arenaPost = { id: 'post' }; },
      (f: OldGroupFixture) => { f.deadlineCase = { id: 'case' }; },
      (f: OldGroupFixture) => { delete (f.match as { _count?: unknown })._count; },
    ]) { const f = generated([group('a', 2)])[0]; edit(f); expect(groupFixtureProtectionReason(f)).toBeTruthy(); }
  });

  it('allows obsolete scheduled-only fixtures to be replaced through preview while retaining still-valid schedules', () => {
    const old = [group('a', 3), group('b', 3, 2)], fixtures = generated(old);
    fixtures.forEach(f => { f.status = 'SCHEDULED'; f.match!.status = 'SCHEDULED'; f.scheduledAt = '2026-11-09T10:00:00Z'; });
    const groups = [{ ...old[0], registrationIds: ['a0', 'a1'] }, { ...old[1], registrationIds: [...old[1].registrationIds, 'a2'] }];
    const { plan, fixtures: result } = afterPlan({ groups, oldGroupSizes: sizes(old), fixtures, legType: 'SINGLE_LEG' });
    expect(plan.removeFixtureIds).toHaveLength(2); expect(plan.creates).toHaveLength(3);
    for (const oldFixture of fixtures.filter(f => !plan.removeFixtureIds.includes(f.id))) expect(result.find(f => f.id === oldFixture.id)).toMatchObject({ scheduledAt: oldFixture.scheduledAt, status: 'SCHEDULED', match: oldFixture.match });
    const postponed = structuredClone(fixtures[0]); postponed.status = 'POSTPONED'; postponed.match!.status = 'POSTPONED'; expect(isGroupFixtureProtected(postponed)).toBe(false);
  });

  it('keeps both recorded home/away results canonical after a seven-to-six group change moves the leg boundary', () => {
    const old = [group('a', 7), group('b', 5, 2)], fixtures = generated(old, true);
    const first = fixtures.find(f => f.groupId === 'a' && f.matchday === 7 && f.homeRegistrationId !== 'a6' && f.awayRegistrationId !== 'a6')!;
    const second = fixtures.find(f => f.groupId === 'a' && f.homeRegistrationId === first.awayRegistrationId && f.awayRegistrationId === first.homeRegistrationId)!;
    recorded(first); recorded(second);
    const groups = [{ ...old[0], registrationIds: old[0].registrationIds.slice(0, 6) }, { ...old[1], registrationIds: [...old[1].registrationIds, 'a6'] }];
    const { plan, fixtures: result } = afterPlan({ groups, fixtures, oldGroupSizes: sizes(old), legType: 'HOME_AWAY' });
    expect(plan.removeFixtureIds).toHaveLength(12); expect(plan.creates).toHaveLength(10); expect(result).toHaveLength(60);
    const firstAfter = result.find(f => f.id === first.id)!, secondAfter = result.find(f => f.id === second.id)!;
    const rounds = roundRobinRoundsPerLeg(6);
    expect(firstAfter.matchday).toBeLessThanOrEqual(rounds); expect(secondAfter.matchday).toBeGreaterThan(rounds);
    expect(firstAfter).toMatchObject({ homeRegistrationId: first.homeRegistrationId, awayRegistrationId: first.awayRegistrationId, match: first.match });
    expect(secondAfter).toMatchObject({ homeRegistrationId: second.homeRegistrationId, awayRegistrationId: second.awayRegistrationId, match: second.match });
    const registrations = groups.flatMap(g => g.registrationIds.map(id => ({ id, groupId: g.id })));
    const canonical = canonicalizeRoundRobinStandingsFixtures(result, registrations, { competitionFormat: 'DOUBLE_ROUND_ROBIN', legType: 'HOME_AWAY', tournamentFormat: 'ROUND_ROBIN', hasGroups: true });
    expect(canonical).toHaveLength(result.length); expect(canonical.map(f => f.id)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('preserves existing orientations when a new engine order would reverse a pair, creating the missing inverse return leg', () => {
    const old = [group('a', 4)], fixture = generated(old, true).find(f => f.matchday! > 3)!;
    recorded(fixture);
    const desired = [{ ...old[0], registrationIds: [...old[0].registrationIds].reverse() }];
    const plan = planGroupFixtureChanges({ groups: desired, fixtures: [fixture], oldGroupSizes: sizes(old), legType: 'HOME_AWAY' });
    expect(plan.updates).toHaveLength(1); expect(plan.removeFixtureIds).toEqual([]);
    const newFirst = plan.creates.find(f => f.homeRegistrationId === fixture.awayRegistrationId && f.awayRegistrationId === fixture.homeRegistrationId)!;
    expect(newFirst).toBeTruthy(); expect(newFirst.matchday).toBeLessThanOrEqual(3); expect(plan.updates[0].matchday).toBeGreaterThan(3);
  });

  it('rejects protected duplicate pair/legs and ambiguous original leg numbers', () => {
    const groups = [group('a', 2)], fixtures = generated(groups, true);
    const duplicate = structuredClone(fixtures[0]); duplicate.id = 'duplicate'; duplicate.fixtureCode = 'DUPLICATE'; recorded(duplicate); recorded(fixtures[0]);
    expect(() => planGroupFixtureChanges({ groups, fixtures: [...fixtures, duplicate], oldGroupSizes: sizes(groups), legType: 'HOME_AWAY' })).toThrowError(expect.objectContaining({ response: expect.objectContaining({ error: expect.objectContaining({ code: 'GROUP_RECORDED_DUPLICATE_FIXTURES' }) }) }));
    fixtures[0].matchday = 99;
    expect(() => planGroupFixtureChanges({ groups, fixtures, oldGroupSizes: sizes(groups), legType: 'HOME_AWAY' })).toThrowError(expect.objectContaining({ response: expect.objectContaining({ error: expect.objectContaining({ code: 'GROUP_FIXTURE_LEG_UNCERTAIN' }) }) }));
  });

  it('rejects two protected return legs with the same home/away orientation', () => {
    const groups = [group('a', 2)], fixtures = generated(groups, true);
    recorded(fixtures[0]); recorded(fixtures[1]); fixtures[1].homeRegistrationId = fixtures[0].homeRegistrationId; fixtures[1].awayRegistrationId = fixtures[0].awayRegistrationId;
    expect(() => planGroupFixtureChanges({ groups, fixtures, oldGroupSizes: sizes(groups), legType: 'HOME_AWAY' })).toThrowError(expect.objectContaining({ response: expect.objectContaining({ error: expect.objectContaining({ code: 'GROUP_FIXTURE_DIRECTION_CONFLICT' }) }) }));
  });

  it('keeps a protected duplicate instead of a disposable preview and rejects playoff manipulation', () => {
    const groups = [group('a', 2)], fixtures = generated(groups), real = structuredClone(fixtures[0]); real.id = 'real'; real.fixtureCode = 'REAL'; recorded(real);
    const plan = planGroupFixtureChanges({ groups, fixtures: [...fixtures, real], oldGroupSizes: sizes(groups), legType: 'SINGLE_LEG' });
    expect(plan.updates.map(f => f.id)).toEqual(['real']); expect(plan.removeFixtureIds).toEqual([fixtures[0].id]);
    fixtures[0].phase = 'PLAYOFF'; expect(() => planGroupFixtureChanges({ groups, fixtures, oldGroupSizes: sizes(groups), legType: 'SINGLE_LEG' })).toThrowError(expect.objectContaining({ status: 409 }));
  });

  it('rejects duplicated memberships and one-team fixture groups before planning any change', () => {
    expect(() => planGroupFixtureChanges({ groups: [{ ...group('a', 2), registrationIds: ['a0', 'a0'] }], oldGroupSizes: {}, fixtures: [], legType: 'SINGLE_LEG' })).toThrowError(expect.objectContaining({ status: 400 }));
    expect(() => planGroupFixtureChanges({ groups: [group('a', 1)], oldGroupSizes: {}, fixtures: [], legType: 'SINGLE_LEG' })).toThrowError(expect.objectContaining({ status: 400 }));
  });
});
