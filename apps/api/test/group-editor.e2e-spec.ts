import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { TournamentsModule } from '../src/tournaments/tournaments.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { balanceGroupMembership } from '../src/tournaments/balanced-group-draw.js';
import { generateRoundRobinFixtures } from '../src/tournaments/fixture-engine.js';
import type { GroupEditorState, GroupEditInput } from '../src/tournaments/group-editor.types.js';

interface Seed { id: string; groups: Array<{ id: string; name: string; position: number; ids: string[] }> }
const normalized = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('group editor with real PostgreSQL, fixtures, results and authenticated HTTP', () => {
  const run = randomUUID().slice(0, 8);
  let app: INestApplication, db: PrismaService, league: string, owner: string, outsider: string, delegate: string, viewer: string;
  let token: string, outsiderToken: string, delegateToken: string, viewerToken: string;
  let number = 0;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    const disposable = url.pathname.endsWith('_test') || (process.env.GITHUB_ACTIONS === 'true' && url.pathname === '/fcarena');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !disposable) throw Error('Requires a disposable loopback *_test database. No production data may be written.');
    process.env.JWT_ACCESS_SECRET ||= 'group-editor-test-access-' + run;
    process.env.JWT_REFRESH_SECRET ||= 'group-editor-test-refresh-' + run;
    for (const key of ['PUSH_ENABLED', 'FIXTURE_DAY_REMINDERS_ENABLED', 'REGISTRATION_NOTIFICATIONS_ENABLED', 'TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED', 'CARD_EXPORT_CLEANUP_ENABLED', 'ARENA_MEDIA_CLEANUP_ENABLED', 'OCR_RETENTION_CLEANUP_ENABLED']) process.env[key] = 'false';
    app = (await Test.createTestingModule({ imports: [PrismaModule, SecurityModule, AuthModule, TournamentsModule] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.init(); db = app.get(PrismaService);
    const users: string[] = [];
    for (let i = 0; i < 4; i++) users.push((await db.user.create({ data: { email: `group-editor-${run}-${i}@example.invalid`, fullName: 'Group Editor Test ' + i, passwordHash: 'not-a-login-hash', status: 'ACTIVE' } })).id);
    [owner, outsider, delegate, viewer] = users;
    league = (await db.league.create({ data: { name: 'KICKOFF-shaped group test', code: 'GE' + run, creatorUserId: owner } })).id;
    for (const userId of [owner, delegate, viewer]) await db.leagueMember.create({ data: { leagueId: league, userId, type: 'PRIMARY' } });
    const sign = (sub: string) => new JwtService().sign({ sub, email: 'test@example.invalid', role: 'USER', type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: 900 });
    token = sign(owner); outsiderToken = sign(outsider); delegateToken = sign(delegate); viewerToken = sign(viewer);
  }, 60000);
  afterAll(async () => {
    if (db && league) await db.league.delete({ where: { id: league } });
    if (db && owner) await db.user.deleteMany({ where: { id: { in: [owner, outsider, delegate, viewer] } } });
    await app?.close();
  });

  async function seed(counts: number[], fixtures = true): Promise<Seed> {
    const index = ++number, publishedAt = new Date('2026-11-01T00:00:00Z');
    const cup = await db.tournament.create({ data: { leagueId: league, createdByUserId: owner, name: 'Group editor test ' + index, code: `GE-${run}-${index}`, mode: 'SOLO', format: 'ROUND_ROBIN', competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS', legType: 'SINGLE_LEG', teamSize: 1, maxEntries: counts.reduce((sum, n) => sum + n, 0), status: fixtures ? 'ACTIVE' : 'REGISTRATION_CLOSED', fixturesGeneratedAt: fixtures ? publishedAt : null, fixturesPublishedAt: fixtures ? publishedAt : null, playoffSource: 'GROUP_QUALIFIERS', qualifiersPerGroup: 2, playoffQualifiersTotal: counts.length * 2 } });
    await db.tournamentAdmin.create({ data: { tournamentId: cup.id, userId: delegate, role: 'ADMIN', permissions: ['MANAGE_PARTICIPANTS'] } });
    const groups: Seed['groups'] = []; let order = 0, sequence = 0;
    for (const [i, count] of counts.entries()) {
      const g = await db.tournamentGroup.create({ data: { tournamentId: cup.id, name: 'Group ' + String.fromCharCode(65 + i), position: i + 1 } });
      const ids: string[] = [];
      for (let j = 0; j < count; j++) ids.push((await db.tournamentRegistration.create({ data: { tournamentId: cup.id, registeredByUserId: owner, groupId: g.id, entryName: `Team ${i}-${j}`, sortOrder: order++, status: 'APPROVED' } })).id);
      groups.push({ id: g.id, name: g.name, position: g.position, ids });
      if (!fixtures) continue;
      for (const blueprint of generateRoundRobinFixtures(ids)) {
        sequence++;
        const date = new Date(Date.UTC(2026, 11, 1, 12) + sequence * 3600000);
        const f = await db.fixture.create({ data: { tournamentId: cup.id, groupId: g.id, fixtureCode: `GE-F-${run}-${index}-${sequence}`, sequence, phase: 'STAGE', roundNumber: blueprint.roundNumber, roundName: `${g.name} - ${blueprint.roundName}`, matchday: blueprint.matchday, bracketPosition: blueprint.bracketPosition, homeRegistrationId: blueprint.homeRegistrationId, awayRegistrationId: blueprint.awayRegistrationId, status: 'SCHEDULED', publishedAt, scheduledAt: date, resultDeadlineAt: new Date(date.getTime() + 172800000), venue: 'Keep this venue' } });
        const m = await db.match.create({ data: { tournamentId: cup.id, fixtureId: f.id, status: 'SCHEDULED' } });
        await db.match.update({ where: { id: m.id }, data: { matchCode: 'FCA-M-' + String(m.serialNumber).padStart(6, '0') } });
      }
    }
    return { id: cup.id, groups };
  }
  const base = (id: string) => `/api/tournaments/${id}/groups`;
  const editorRequest = (id: string, bearer = token) => request(app.getHttpServer()).get(base(id) + '/editor').set('Authorization', 'Bearer ' + bearer);
  async function editor(id: string, bearer = token): Promise<GroupEditorState> { return (await editorRequest(id, bearer).expect(200)).body.data.editor; }
  const inputFrom = (s: GroupEditorState): GroupEditInput => ({ revision: s.revision, groups: s.groups.map(g => ({ id: g.id, name: g.name, registrationIds: g.entries.map(entry => entry.id) })) });
  const balanced = (s: GroupEditorState): GroupEditInput => { const input = inputFrom(s); return { ...input, groups: balanceGroupMembership(input.groups, s.unassigned.map(e => e.id), s.protectedEntryIds) }; };
  const previewRequest = (id: string, input: GroupEditInput, bearer = token) => request(app.getHttpServer()).post(base(id) + '/reorganize/preview').set('Authorization', 'Bearer ' + bearer).send(input);
  const applyRequest = (id: string, input: GroupEditInput, planHash: string, bearer = token) => request(app.getHttpServer()).post(base(id) + '/reorganize').set('Authorization', 'Bearer ' + bearer).send({ ...input, planHash });
  async function save(id: string, input: GroupEditInput, bearer = token) { const preview = await previewRequest(id, input, bearer).expect(201); return applyRequest(id, input, preview.body.data.preview.planHash, bearer).expect(201); }
  const loadFixtures = (id: string) => db.fixture.findMany({ where: { tournamentId: id }, orderBy: { sequence: 'asc' }, include: { deadlineCase: true, match: { include: { resultSubmissions: true, statEvents: true, ocrExtractions: true, disputes: true, arenaPost: true } } } });

  it('repairs the reported 42-team 7/6/6/5/6/6/6 draw with one move and preserves five unaffected groups exactly', async () => {
    const cup = await seed([7, 6, 6, 5, 6, 6, 6]), before = await loadFixtures(cup.id);
    expect(before).toHaveLength(106);
    const state = await editor(cup.id), input = balanced(state);
    expect(input.groups.map(g => g.registrationIds.length)).toEqual([6, 6, 6, 6, 6, 6, 6]);
    const moving = state.groups[0].entries.find(e => !input.groups[0].registrationIds.includes(e.id))!.id;
    const removed = before.filter(f => f.groupId === cup.groups[0].id && [f.homeRegistrationId, f.awayRegistrationId].includes(moving));
    const unaffected = new Set(cup.groups.filter((_, i) => ![0, 3].includes(i)).map(g => g.id));
    const oldReminder = await db.notification.create({ data: { userId: owner, type: 'MATCH_REMINDER', title: 'Pending fixture', message: 'Old fixture reminder', href: `/matches/${removed[0].match!.id}`, entityType: 'FixtureDayReminder', entityId: 'test-reminder-slot', dedupeKey: 'group-editor-reminder-' + run, eventAt: new Date() } });
    // Notifications are not part of the group revision; this added reminder does
    // not invalidate the explicitly reviewed grouping/schedule input snapshot.
    const preview = await previewRequest(cup.id, input).expect(201);
    expect(preview.body.data.preview.impact).toMatchObject({ movedTeams: 1, fixturesRemoved: 6, fixturesCreated: 5, fixturesKept: 100, resultsPreserved: 0 });
    expect(await loadFixtures(cup.id)).toEqual(before); // preview never mutates
    const response = await applyRequest(cup.id, input, preview.body.data.preview.planHash).expect(201), after = await loadFixtures(cup.id);
    expect(after).toHaveLength(105); expect(response.body.data.editor.groups.map((g: { entries: unknown[] }) => g.entries.length)).toEqual([6, 6, 6, 6, 6, 6, 6]);
    expect(normalized(after.filter(f => unaffected.has(f.groupId!)))).toEqual(normalized(before.filter(f => unaffected.has(f.groupId!))));
    const byId = new Map(after.map(f => [f.id, f]));
    for (const f of before.filter(f => !removed.some(r => r.id === f.id))) {
      const kept = byId.get(f.id)!;
      expect(kept).toBeTruthy(); expect(kept.match).toEqual(f.match); expect(kept.scheduledAt).toEqual(f.scheduledAt); expect(kept.resultDeadlineAt).toEqual(f.resultDeadlineAt); expect(kept.venue).toBe(f.venue); expect(kept.fixtureCode).toBe(f.fixtureCode); expect(kept.homeRegistrationId).toBe(f.homeRegistrationId); expect(kept.awayRegistrationId).toBe(f.awayRegistrationId);
    }
    const originalIds = new Set(before.map(f => f.id)), added = after.filter(f => !originalIds.has(f.id));
    expect(added).toHaveLength(5);
    for (const f of added) { expect(f.publishedAt).not.toBeNull(); expect(f.scheduledAt).toBeNull(); expect(f.status).toBe('UNSCHEDULED'); expect(f.match?.status).toBe('UNSCHEDULED'); expect(f.match?.matchCode).toMatch(/^FCA-M-\d+$/); }
    expect(await db.notification.findUnique({ where: { id: oldReminder.id } })).toBeNull();
    expect(await db.tournamentRegistration.count({ where: { tournamentId: cup.id, groupId: null, status: 'APPROVED' } })).toBe(0);
  }, 60000);

  it('preserves a confirmed match and its stat events while canonical standings continue to count its score', async () => {
    const cup = await seed([4, 2]), state = await editor(cup.id), draft = balanced(state);
    const moving = state.groups[0].entries.find(e => !draft.groups[0].registrationIds.includes(e.id))!.id;
    const f = (await loadFixtures(cup.id)).find(f => f.groupId === cup.groups[0].id && ![f.homeRegistrationId, f.awayRegistrationId].includes(moving))!;
    const submission = await db.resultSubmission.create({ data: { matchId: f.match!.id, submittedByUserId: owner, homeScore: 3, awayScore: 1 } });
    await request(app.getHttpServer()).post(`/api/results/${submission.id}/confirm`).set('Authorization', 'Bearer ' + token).expect(201);
    const historical = (await loadFixtures(cup.id)).find(row => row.id === f.id)!;
    expect(historical.match?.statEvents).toHaveLength(1);
    const response = await save(cup.id, balanced(await editor(cup.id))); expect(response.body.data.impact.resultsPreserved).toBe(1);
    const kept = (await loadFixtures(cup.id)).find(row => row.id === f.id)!; expect(kept.match).toEqual(historical.match); expect(kept.status).toBe('COMPLETED');
    const standings = (await request(app.getHttpServer()).get(`/api/tournaments/${cup.id}/standings`).set('Authorization', 'Bearer ' + token).expect(200)).body.data.standings;
    expect(standings.find((r: { registrationId: string }) => r.registrationId === f.homeRegistrationId)).toMatchObject({ played: 1, wins: 1, goalsFor: 3, goalsAgainst: 1, points: 3 });
    expect(standings.find((r: { registrationId: string }) => r.registrationId === f.awayRegistrationId)).toMatchObject({ played: 1, losses: 1, goalsFor: 1, goalsAgainst: 3, points: 0 });
  });

  it.each(['confirmed result', 'pending result', 'OCR proof'] as const)('rejects splitting a pairing with %s and leaves its records intact', async kind => {
    const cup = await seed([3, 3]), before = await loadFixtures(cup.id), f = before.find(row => row.groupId === cup.groups[0].id)!;
    if (kind === 'OCR proof') await db.ocrExtraction.create({ data: { matchId: f.match!.id, submittedByUserId: owner, imagePath: '/test-only/not-exported-proof.png', mimeType: 'image/png', fileSize: 100, status: 'COMPLETED' } });
    else {
      const result = await db.resultSubmission.create({ data: { matchId: f.match!.id, submittedByUserId: owner, homeScore: 2, awayScore: 0 } });
      if (kind === 'confirmed result') await request(app.getHttpServer()).post(`/api/results/${result.id}/confirm`).set('Authorization', 'Bearer ' + token).expect(201);
    }
    const protectedBefore = await loadFixtures(cup.id), state = await editor(cup.id), input = inputFrom(state), moving = f.homeRegistrationId!, replacement = input.groups[1].registrationIds[0];
    input.groups[0].registrationIds = input.groups[0].registrationIds.map(id => id === moving ? replacement : id);
    input.groups[1].registrationIds = input.groups[1].registrationIds.map(id => id === replacement ? moving : id);
    const response = await previewRequest(cup.id, input).expect(409); expect(JSON.stringify(response.body)).toContain(f.fixtureCode);
    expect(await loadFixtures(cup.id)).toEqual(protectedBefore); expect(JSON.stringify(state)).not.toContain('/test-only/not-exported-proof');
  });

  it('rejects a stale revision or forged plan and allows exactly one concurrent application of the same reviewed change', async () => {
    const cup = await seed([3, 3]); let input = inputFrom(await editor(cup.id)); input.groups[0].name = 'Corrected Group A';
    const preview = await previewRequest(cup.id, input).expect(201);
    await applyRequest(cup.id, input, '0'.repeat(64)).expect(409);
    const f = (await loadFixtures(cup.id))[0]; await db.fixture.update({ where: { id: f.id }, data: { scheduledAt: new Date('2026-12-20T12:00:00Z') } });
    const stale = await applyRequest(cup.id, input, preview.body.data.preview.planHash).expect(409); expect(stale.body.error.code).toBe('GROUP_INPUTS_CHANGED');
    expect((await db.tournamentGroup.findUniqueOrThrow({ where: { id: cup.groups[0].id } })).name).toBe('Group A');
    input = inputFrom(await editor(cup.id)); input.groups[0].name = 'Corrected Group A';
    const fresh = await previewRequest(cup.id, input).expect(201), responses = await Promise.all([applyRequest(cup.id, input, fresh.body.data.preview.planHash), applyRequest(cup.id, input, fresh.body.data.preview.planHash)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]); expect((await editor(cup.id)).groups[0].name).toBe('Corrected Group A');
  }, 60000);

  it('guards authentication and permissions and rejects duplicated or foreign roster/group IDs without changing state', async () => {
    const cup = await seed([3, 3]), other = await seed([2, 2]), state = await editor(cup.id), good = inputFrom(state);
    await request(app.getHttpServer()).get(base(cup.id) + '/editor').expect(401);
    await request(app.getHttpServer()).post(base(cup.id) + '/reorganize/preview').send(good).expect(401);
    await editorRequest(cup.id, outsiderToken).expect(403); await previewRequest(cup.id, good, outsiderToken).expect(403);
    expect((await editor(cup.id, viewerToken)).canManage).toBe(false); await previewRequest(cup.id, good, viewerToken).expect(403);
    const duplicate = structuredClone(good); duplicate.groups[1].registrationIds[0] = duplicate.groups[0].registrationIds[0]; await previewRequest(cup.id, duplicate).expect(409);
    const foreignEntry = structuredClone(good); foreignEntry.groups[0].registrationIds[0] = other.groups[0].ids[0]; await previewRequest(cup.id, foreignEntry).expect(409);
    const foreignGroup = structuredClone(good); foreignGroup.groups[0].id = other.groups[0].id; await previewRequest(cup.id, foreignGroup).expect(400);
    const malformed = structuredClone(good); malformed.groups[0].registrationIds[0] = 'not-a-uuid'; await previewRequest(cup.id, malformed).expect(400);
    expect((await editor(cup.id)).revision).toBe(state.revision);
  });

  it('lets a participant-only delegate rename generated and completed groups while requiring fixture permission for membership changes', async () => {
    const cup = await seed([3, 3]); let state = await editor(cup.id, delegateToken), input = inputFrom(state);
    expect(state).toMatchObject({ canManage: true, canChangeMembership: false }); expect(state.membershipReason).toContain('Manage Fixtures');
    const a = input.groups[0].registrationIds[0], b = input.groups[1].registrationIds[0]; input.groups[0].registrationIds[0] = b; input.groups[1].registrationIds[0] = a;
    const denied = await previewRequest(cup.id, input, delegateToken).expect(409); expect(denied.body.error.code).toBe('GROUP_MEMBERSHIP_PROTECTED');
    input = inputFrom(state); input.groups[0].name = 'Generated group corrected'; await save(cup.id, input, delegateToken);
    await db.tournament.update({ where: { id: cup.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    state = await editor(cup.id, delegateToken); input = inputFrom(state); input.groups[0].name = 'Completed group corrected';
    const before = await loadFixtures(cup.id); await save(cup.id, input, delegateToken); const after = await loadFixtures(cup.id);
    expect(after.map(f => f.id)).toEqual(before.map(f => f.id)); expect(after.map(f => f.match)).toEqual(before.map(f => f.match));
    expect(after.filter(f => f.groupId === cup.groups[0].id).every(f => f.roundName.startsWith('Completed group corrected - '))).toBe(true);
  });

  it('atomically swaps names and positions, creates/deletes groups, and keeps all approved entries assigned exactly once', async () => {
    const cup = await seed([4, 4]); let state = await editor(cup.id), input = inputFrom(state);
    input.groups = [{ ...input.groups[1], name: 'Group A' }, { ...input.groups[0], name: 'Group B' }];
    await save(cup.id, input); state = await editor(cup.id);
    expect(state.groups.map(g => [g.id, g.name, g.position])).toEqual([[cup.groups[1].id, 'Group A', 1], [cup.groups[0].id, 'Group B', 2]]);
    input = inputFrom(state);
    input.groups = [...input.groups.map(g => ({ ...g, registrationIds: g.registrationIds.slice(0, 2) })), { id: randomUUID(), name: 'Group C', registrationIds: state.groups[0].entries.slice(2).map(e => e.id) }, { id: randomUUID(), name: 'Group D', registrationIds: state.groups[1].entries.slice(2).map(e => e.id) }];
    await save(cup.id, input); state = await editor(cup.id);
    expect(state.groups.map(g => g.entries.length)).toEqual([2, 2, 2, 2]); expect(await db.fixture.count({ where: { tournamentId: cup.id } })).toBe(4);
    expect((await db.tournament.findUniqueOrThrow({ where: { id: cup.id } })).playoffQualifiersTotal).toBe(8);
    input = { revision: state.revision, groups: [ { id: cup.groups[0].id, name: 'Group B', registrationIds: cup.groups[0].ids }, { id: cup.groups[1].id, name: 'Group A', registrationIds: cup.groups[1].ids } ] };
    const removedGroupIds = state.groups.slice(2).map(g => g.id); await save(cup.id, input); state = await editor(cup.id);
    expect(state.groups.map(g => g.entries.length)).toEqual([4, 4]); expect(new Set(state.groups.flatMap(g => g.entries.map(e => e.id))).size).toBe(8); expect(state.unassigned).toEqual([]);
    expect(await db.tournamentGroup.count({ where: { id: { in: removedGroupIds } } })).toBe(0); expect(await db.fixture.count({ where: { tournamentId: cup.id } })).toBe(12);
    expect((await db.tournament.findUniqueOrThrow({ where: { id: cup.id } })).playoffQualifiersTotal).toBe(4);
  });

  it('allows unavoidable 5/4 group sizes for nine teams but rejects a 6/3 imbalance', async () => {
    const cup = await seed([3, 3, 3], false), state = await editor(cup.id), all = state.groups.flatMap(g => g.entries.map(e => e.id));
    const input: GroupEditInput = { revision: state.revision, groups: [{ id: state.groups[0].id, name: 'Group A', registrationIds: all.slice(0, 5) }, { id: state.groups[1].id, name: 'Group B', registrationIds: all.slice(5) }] };
    const bad = structuredClone(input); bad.groups[0].registrationIds.push(bad.groups[1].registrationIds.pop()!); await previewRequest(cup.id, bad).expect(409);
    await save(cup.id, input); const result = await editor(cup.id); expect(result.groups.map(g => g.entries.length)).toEqual([5, 4]); expect(result.unassigned).toEqual([]);
    expect(await db.fixture.count({ where: { tournamentId: cup.id } })).toBe(0);
  });

  it('resets an unplayed 42-team draw atomically while retaining all approved teams', async () => {
    const cup = await seed([6, 6, 6, 6, 6, 6, 6]);
    const registrations = await db.tournamentRegistration.findMany({ where: { tournamentId: cup.id }, orderBy: { id: 'asc' } });
    const ready = await db.match.findMany({ where: { tournamentId: cup.id }, take: 13, select: { id: true } });
    await db.match.updateMany({ where: { id: { in: ready.map(m => m.id) } }, data: { homeReadyAt: new Date() } });
    const url = `/api/tournaments/${cup.id}/fixtures`;
    const preview = await request(app.getHttpServer()).get(url + '/full-reset-preview').set('Authorization', 'Bearer ' + token).expect(200);
    expect(preview.body.data).toMatchObject({ allowed: true, groupCount: 7, approvedTeams: 42, fixtureCount: 105, readinessCount: 13 });
    await request(app.getHttpServer()).post(url + '/full-reset').set('Authorization', 'Bearer ' + viewerToken).send({ confirmation: `Group editor test ${number}` }).expect(403);
    await request(app.getHttpServer()).post(url + '/full-reset').set('Authorization', 'Bearer ' + token).send({ confirmation: 'WRONG' }).expect(400);
    const name = (await db.tournament.findUniqueOrThrow({ where: { id: cup.id } })).name;
    await request(app.getHttpServer()).post(url + '/full-reset').set('Authorization', 'Bearer ' + token).send({ confirmation: name }).expect(201);
    expect(await db.fixture.count({ where: { tournamentId: cup.id } })).toBe(0);
    expect(await db.match.count({ where: { tournamentId: cup.id } })).toBe(0);
    expect(await db.tournamentGroup.count({ where: { tournamentId: cup.id } })).toBe(0);
    const after = await db.tournamentRegistration.findMany({ where: { tournamentId: cup.id }, orderBy: { id: 'asc' } });
    expect(after.map(e => ({ id: e.id, name: e.entryName, status: e.status }))).toEqual(registrations.map(e => ({ id: e.id, name: e.entryName, status: e.status })));
    expect(after.every(e => e.groupId === null)).toBe(true);
    expect(await db.tournament.findUniqueOrThrow({ where: { id: cup.id } })).toMatchObject({ status: 'REGISTRATION_CLOSED', wizardStep: 'GROUPS', fixturesGeneratedAt: null, fixturesPublishedAt: null });
  }, 60000);

  it('creates one balanced fresh draw on concurrent clicks and preserves original scores, members and fixture IDs', async () => {
    const cup = await seed([7, 6, 6, 5, 6, 6, 6]), fixture = (await loadFixtures(cup.id))[0];
    await db.tournamentRegistrationMember.create({ data: { tournamentId: cup.id, registrationId: cup.groups[0].ids[0], userId: owner } });
    await db.tournamentRegistration.create({ data: { tournamentId: cup.id, registeredByUserId: owner, entryName: 'Pending team must not transfer', status: 'PENDING' } });
    const result = await db.resultSubmission.create({ data: { matchId: fixture.match!.id, submittedByUserId: owner, homeScore: 3, awayScore: 1 } });
    await request(app.getHttpServer()).post(`/api/results/${result.id}/confirm`).set('Authorization', 'Bearer ' + token).expect(201);
    const original = await loadFixtures(cup.id), tournament = await db.tournament.findUniqueOrThrow({ where: { id: cup.id } });
    const url = `/api/tournaments/${cup.id}/fixtures`;
    const reset = await request(app.getHttpServer()).get(url + '/full-reset-preview').set('Authorization', 'Bearer ' + token).expect(200);
    expect(reset.body.data.allowed).toBe(false);
    await request(app.getHttpServer()).post(url + '/full-reset').set('Authorization', 'Bearer ' + token).send({ confirmation: tournament.name }).expect(409);
    await request(app.getHttpServer()).post(url + '/restart-with-teams').set('Authorization', 'Bearer ' + viewerToken).send({ confirmation: tournament.name }).expect(403);
    await request(app.getHttpServer()).post(url + '/restart-with-teams').set('Authorization', 'Bearer ' + token).send({ confirmation: 42 }).expect(400);
    const restart = () => request(app.getHttpServer()).post(url + '/restart-with-teams').set('Authorization', 'Bearer ' + token).send({ confirmation: tournament.name });
    const responses = await Promise.all([restart(), restart()]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    const freshId = responses[0].body.data.tournamentId;
    expect(responses[1].body.data.tournamentId).toBe(freshId);
    expect(freshId).not.toBe(cup.id);
    const fresh = await editor(freshId);
    expect(fresh.groups.map(g => g.entries.length)).toEqual([6, 6, 6, 6, 6, 6, 6]);
    expect(fresh.unassigned).toEqual([]);
    expect(await db.fixture.count({ where: { tournamentId: freshId } })).toBe(0);
    expect(await db.tournamentRegistrationMember.count({ where: { tournamentId: freshId, userId: owner } })).toBe(1);
    const wizard = `/api/tournaments/${freshId}/wizard/fixture-preview`;
    await request(app.getHttpServer()).post(wizard + '/generate').set('Authorization', 'Bearer ' + token).send({}).expect(201);
    const generated = await db.fixture.findMany({ where: { tournamentId: freshId } });
    expect(generated).toHaveLength(105);
    const groupsByEntry = new Map(fresh.groups.flatMap(g => g.entries.map(e => [e.id, g.id] as const)));
    expect(generated.every(f => groupsByEntry.get(f.homeRegistrationId!) === groupsByEntry.get(f.awayRegistrationId!))).toBe(true);
    expect(new Set(generated.map(f => [f.homeRegistrationId, f.awayRegistrationId].sort().join(':'))).size).toBe(105);
    await request(app.getHttpServer()).post(wizard + '/publish').set('Authorization', 'Bearer ' + token).send({}).expect(201);
    expect(await db.match.count({ where: { tournamentId: freshId } })).toBe(105);
    expect(await db.fixture.count({ where: { tournamentId: freshId, publishedAt: { not: null } } })).toBe(105);
    expect(await db.tournament.findUniqueOrThrow({ where: { id: cup.id } })).toEqual(tournament);
    expect(await loadFixtures(cup.id)).toEqual(original);
    expect(await db.auditLog.count({ where: { action: 'TOURNAMENT_DRAW_RESTART_WITH_TEAMS', targetId: cup.id } })).toBe(1);
  }, 60000);
});
