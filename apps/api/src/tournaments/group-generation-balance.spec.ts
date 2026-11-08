import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TournamentFixtureWizardService } from './tournament-fixture-wizard.service.js';
import { TournamentWizardFinalizeService } from './tournament-wizard-finalize.service.js';
import { GroupFixturesService } from './group-fixtures.service.js';

function setup(sizes = [6, 6]) {
  const tournament = { id: 'cup', leagueId: 'league', status: 'REGISTRATION_CLOSED', groupMode: 'MULTIPLE_GROUPS', competitionFormat: 'STANDARD', fixtureMode: 'AUTOMATIC', legType: 'SINGLE_LEG', playoffFormat: 'SINGLE_ELIMINATION', playoffSeedingBasis: 'OVERALL_PERFORMANCE', playoffQualifiersTotal: null };
  const groups = sizes.map((_, i) => ({ id: 'g' + i, name: 'Group ' + i, position: i + 1, tournamentId: 'cup' }));
  const entries = sizes.flatMap((count, i) => Array.from({ length: count }, (_, n) => ({ id: `e${i}-${n}`, groupId: 'g' + i, sortOrder: n, createdAt: new Date('2026-11-08T00:00:00Z') })));
  const db: any = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'SUPER_ADMIN' }) }, leagueAdmin: { findUnique: vi.fn().mockResolvedValue(null) }, tournamentAdmin: { findUnique: vi.fn().mockResolvedValue(null) }, roleAssignment: { findUnique: vi.fn().mockResolvedValue(null) }, tournament: { findUnique: vi.fn().mockResolvedValue(tournament), findUniqueOrThrow: vi.fn().mockResolvedValue(tournament), update: vi.fn().mockResolvedValue({ ...tournament, status: 'ACTIVE' }) }, tournamentGroup: { findMany: vi.fn().mockResolvedValue(groups), findUnique: vi.fn().mockImplementation(async ({ where }) => groups.find(group => group.id === where.id)), count: vi.fn().mockResolvedValue(groups.length) }, tournamentRegistration: { findMany: vi.fn().mockResolvedValue(entries), count: vi.fn().mockResolvedValue(entries.length) }, fixture: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), deleteMany: vi.fn().mockResolvedValue({ count: 42 }), create: vi.fn().mockResolvedValue({ id: 'fixture' }) } };
  db.$transactionWithRetry = vi.fn().mockImplementation(async callback => callback(db));
  const auth = { assertCanManageTournamentPermission: vi.fn(), assertCanManageFixtures: vi.fn() };
  return { tournament, groups, entries, db, auth, wizard: new TournamentFixtureWizardService(db, auth as never), finalize: new TournamentWizardFinalizeService(db, auth as never), groupFixtures: new GroupFixturesService(db, auth as never) };
}

function previewFixture(change: Record<string, any> = {}) {
  return { id: 'preview', fixtureCode: 'FCA-F-PREVIEW', tournamentId: 'cup', groupId: 'g0', phase: 'STAGE', status: 'UNSCHEDULED', sequence: 1, publishedAt: null,
    nextFixtureId: null, nextSlot: null, loserNextFixtureId: null, loserNextSlot: null,
    previousFixtures: [], previousLoserFixtures: [], deadlineCase: null, ...change,
    match: change.match === null ? null : { id: 'match', status: 'UNSCHEDULED', confirmedResultSubmissionId: null, homeReadyAt: null, awayReadyAt: null, arenaPost: null, ...change.match, _count: { resultSubmissions: 0, statEvents: 0, ocrExtractions: 0, disputes: 0, ...change.match?._count } },
  };
}

describe('group generation and publishing preserve complete, balanced inputs', () => {
  it('rejects an uneven whole-tournament draw before removing a valid existing preview', async () => {
    const f = setup([7, 5]); await expect(f.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ status: 409, response: { error: { code: 'GROUPS_UNBALANCED' } } });
    expect(f.db.fixture.deleteMany).not.toHaveBeenCalled(); expect(f.db.$transactionWithRetry).not.toHaveBeenCalled();
  });
  it('rejects late unassigned approved teams instead of silently omitting them', async () => {
    const f = setup(); f.entries.push({ id: 'late', groupId: null as never, sortOrder: 99, createdAt: new Date() });
    await expect(f.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'UNASSIGNED_ENTRIES' } } }); expect(f.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('generates every group from the captured roster and replaces its preview in the same transaction', async () => {
    const f = setup([3, 3]); const result = await f.wizard.generatePreview('admin', 'cup');
    expect(result.data.fixtures).toBe(6); expect(f.db.fixture.create).toHaveBeenCalledTimes(6); expect(f.db.fixture.deleteMany).toHaveBeenCalledOnce();
    expect(f.db.fixture.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(f.db.fixture.create.mock.invocationCallOrder[0]);
    expect(f.db.$transactionWithRetry.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
  });
  it('retains intentional specific-group and selected-participant scopes', async () => {
    const f = setup([7, 5]); const specific = await f.wizard.generatePreview('admin', 'cup', { groupId: 'g0' }); expect(specific.data.fixtures).toBe(21);
    const g = setup([7, 5]); const selected = await g.wizard.generatePreview('admin', 'cup', { registrationIds: ['e0-0', 'e0-1', 'e1-0', 'e1-1'] }); expect(selected.data.fixtures).toBe(2);
    const h = setup(); h.entries.push({ id: 'late', groupId: null as never, sortOrder: 99, createdAt: new Date() });
    await expect(h.wizard.generatePreview('admin', 'cup', { registrationIds: ['e0-0', 'late'] })).rejects.toMatchObject({ response: { error: { code: 'SELECTED_PARTICIPANTS_NOT_GROUPED' } } }); expect(h.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('aborts a group change between planning and creation without deleting or creating fixtures', async () => {
    const f = setup([3, 3]), changed = f.entries.map(entry => ({ ...entry })); changed[0].groupId = 'g1';
    f.db.tournamentRegistration.findMany.mockResolvedValueOnce(f.entries).mockResolvedValue(changed);
    await expect(f.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'FIXTURE_INPUTS_CHANGED' } } });
    expect(f.db.fixture.deleteMany).not.toHaveBeenCalled(); expect(f.db.fixture.create).not.toHaveBeenCalled();
  });
  it('does not replace previews that became official or contain match activity/evidence', async () => {
    const f = setup([3, 3]); f.db.fixture.count.mockResolvedValueOnce(0).mockResolvedValue(6);
    await expect(f.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'PUBLISHED_FIXTURES_LOCKED' } } }); expect(f.db.fixture.deleteMany).not.toHaveBeenCalled();
    const g = setup([3, 3]); g.db.fixture.findMany.mockResolvedValueOnce([previewFixture({ match: { status: 'LIVE' } })]);
    await expect(g.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'FIXTURE_PREVIEW_HAS_MATCH_ACTIVITY' } } }); expect(g.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('preserves existing previews when manual mode is selected or direct knockout configuration is invalid', async () => {
    const f = setup(); f.tournament.fixtureMode = 'MANUAL'; await f.wizard.generatePreview('admin', 'cup'); expect(f.db.fixture.deleteMany).not.toHaveBeenCalled();
    const g = setup([1, 1]); g.tournament.competitionFormat = 'SINGLE_ELIMINATION'; g.tournament.playoffFormat = 'DOUBLE_CHANCE';
    await expect(g.wizard.generatePreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'DOUBLE_CHANCE_REQUIRES_THREE' } } }); expect(g.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('blocks uneven or unassigned groups when publishing, even if fixtures already exist', async () => {
    const f = setup([7, 5]); f.db.fixture.count.mockResolvedValue(30);
    await expect(f.finalize.publishTournament('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'GROUPS_UNBALANCED' } } }); expect(f.db.tournament.update).not.toHaveBeenCalled();
    const g = setup(); g.entries.push({ id: 'late', groupId: null as never, sortOrder: 99, createdAt: new Date() }); g.db.fixture.count.mockResolvedValue(30);
    await expect(g.finalize.publishTournament('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'UNASSIGNED_ENTRIES' } } });
  });
  it('revalidates late approvals inside the publish transaction', async () => {
    const f = setup([3, 3]), fresh = [...f.entries, { id: 'late', groupId: null, sortOrder: 99, createdAt: new Date() }]; f.db.fixture.count.mockResolvedValue(6);
    f.db.tournamentRegistration.findMany.mockResolvedValueOnce(f.entries).mockResolvedValue(fresh);
    await expect(f.finalize.publishTournament('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'FIXTURE_INPUTS_CHANGED' } } }); expect(f.db.tournament.update).not.toHaveBeenCalled();
  });
  it('also guards legacy direct group generation from uneven groups and new approvals', async () => {
    const f = setup([7, 5]); f.db.tournamentGroup.findMany.mockResolvedValue(f.groups.map(group => ({ ...group, registrations: f.entries.filter(entry => entry.groupId === group.id) })));
    await expect(f.groupFixtures.generateGroupFixtures('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'GROUPS_UNBALANCED' } } });
    const g = setup([3, 3]); g.db.tournamentGroup.findMany.mockResolvedValue(g.groups.map(group => ({ ...group, registrations: g.entries.filter(entry => entry.groupId === group.id) })));
    g.db.tournamentRegistration.count.mockResolvedValueOnce(6).mockResolvedValue(7);
    await expect(g.groupFixtures.generateGroupFixtures('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'FIXTURE_INPUTS_CHANGED' } } }); expect(g.db.fixture.create).not.toHaveBeenCalled();
  });
});


describe('reset/replacement preserve unpublished match history', () => {
  const activities: Array<[string, Record<string, any>]> = [
    ['home readiness', { match: { homeReadyAt: new Date() } }],
    ['away readiness', { match: { awayReadyAt: new Date() } }],
    ...['LIVE', 'COMPLETED', 'CANCELLED'].map(status => ['fixture ' + status, { status }] as [string, Record<string, any>]),
    ...['LIVE', 'COMPLETED', 'CANCELLED'].map(status => ['match ' + status, { match: { status } }] as [string, Record<string, any>]),
    ['confirmed result pointer', { match: { confirmedResultSubmissionId: 'result' } }],
    ...['resultSubmissions', 'statEvents', 'ocrExtractions', 'disputes'].map(field => [field, { match: { _count: { [field]: 1 } } }] as [string, Record<string, any>]),
    ['linked arena post', { match: { arenaPost: { id: 'post' } } }],
    ['deadline case', { deadlineCase: { id: 'deadline' } }],
    ['outgoing winner to another scope', { nextFixtureId: 'outside', nextSlot: 'HOME' }],
    ['outgoing loser to another scope', { loserNextFixtureId: 'outside', loserNextSlot: 'AWAY' }],
    ['incoming winner from another scope', { previousFixtures: [{ id: 'outside' }] }],
    ['incoming loser from another scope', { previousLoserFixtures: [{ id: 'outside' }] }],
    ['orphaned progression history', { nextSlot: 'HOME' }],
  ];
  for (const operation of ['reset', 'replace'] as const) it.each(activities)(`${operation} protects %s before any deletion`, async (_name, change) => {
    const f = setup([3, 3]); f.db.fixture.findMany.mockResolvedValue([previewFixture(change)]);
    const action = operation === 'reset' ? f.wizard.resetPreview('admin', 'cup') : f.wizard.generatePreview('admin', 'cup');
    await expect(action).rejects.toMatchObject({ status: 409, response: { error: { code: 'FIXTURE_PREVIEW_HAS_MATCH_ACTIVITY' } } });
    expect(f.db.fixture.deleteMany).not.toHaveBeenCalled(); expect(f.db.fixture.create).not.toHaveBeenCalled();
  });
  it.each(['UNSCHEDULED', 'SCHEDULED', 'POSTPONED'])('resets an activity-free %s preview transactionally without touching official fixtures', async status => {
    const f = setup(); f.db.fixture.findMany.mockResolvedValue([previewFixture({ status, match: { status } })]);
    const result = await f.wizard.resetPreview('admin', 'cup', 'g0');
    expect(result.data.deleted).toBe(42);
    expect(f.db.fixture.findMany.mock.calls[0][0].where).toEqual({ tournamentId: 'cup', groupId: 'g0', publishedAt: null });
    expect(f.db.fixture.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 'cup', groupId: 'g0', publishedAt: null } });
    expect(f.db.$transactionWithRetry.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(f.auth.assertCanManageTournamentPermission).toHaveBeenCalledOnce(); expect(f.db.user.findUnique).toHaveBeenCalled();
    expect(f.db.fixture.findMany.mock.invocationCallOrder[0]).toBeLessThan(f.db.fixture.deleteMany.mock.invocationCallOrder[0]);
  });
  it.each(['reset', 'replace'])('%s allows complete fresh knockout wiring only when every reference is internal', async operation => {
    const f = setup([3, 3]);
    f.db.fixture.findMany.mockResolvedValue([
      previewFixture({ id: 'semi', phase: 'PLAYOFF', nextFixtureId: 'final', nextSlot: 'HOME', loserNextFixtureId: 'third', loserNextSlot: 'AWAY' }),
      previewFixture({ id: 'final', phase: 'PLAYOFF', sequence: 2, previousFixtures: [{ id: 'semi' }] }),
      previewFixture({ id: 'third', phase: 'PLAYOFF', sequence: 3, previousLoserFixtures: [{ id: 'semi' }] }),
    ]);
    if (operation === 'reset') await expect(f.wizard.resetPreview('admin', 'cup')).resolves.toMatchObject({ success: true });
    else await expect(f.wizard.generatePreview('admin', 'cup')).resolves.toMatchObject({ data: { fixtures: 6 } });
    expect(f.db.fixture.deleteMany).toHaveBeenCalledOnce();
  });
  it('revalidates tournament status and group ownership inside the reset transaction', async () => {
    const f = setup(); f.db.tournament.findUniqueOrThrow.mockResolvedValue({ ...f.tournament, status: 'ACTIVE' });
    await expect(f.wizard.resetPreview('admin', 'cup')).rejects.toMatchObject({ response: { error: { code: 'TOURNAMENT_WIZARD_LOCKED' } } }); expect(f.db.fixture.deleteMany).not.toHaveBeenCalled();
    const g = setup(); g.db.tournamentGroup.findUnique.mockResolvedValueOnce(g.groups[0]).mockResolvedValueOnce({ tournamentId: 'foreign' });
    await expect(g.wizard.resetPreview('admin', 'cup', 'g0')).rejects.toMatchObject({ status: 404 }); expect(g.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
  it('rechecks settings permission before resetting rather than relying on an earlier authorization', async () => {
    const f = setup(); f.db.user.findUnique.mockResolvedValue({ role: 'USER' });
    await expect(f.wizard.resetPreview('admin', 'cup')).rejects.toMatchObject({ status: 403 }); expect(f.db.fixture.deleteMany).not.toHaveBeenCalled();
  });
});
