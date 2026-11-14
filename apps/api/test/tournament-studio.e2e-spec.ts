import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthModule } from '../src/auth/auth.module.js';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { TournamentsModule } from '../src/tournaments/tournaments.module.js';

describe('Tournament Studio against PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  let app: INestApplication;
  let db: PrismaService;
  let leagueId: string;
  let owner: string;
  let outsider: string;
  let token: string;
  let visitor: string;
  const players: string[] = [];
  let cupIndex = 0;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    const disposable = url.pathname.endsWith('_test') || (process.env.GITHUB_ACTIONS === 'true' && url.pathname === '/fcarena');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !disposable) {
      throw Error('Tournament Studio tests require a disposable loopback database.');
    }
    process.env.JWT_ACCESS_SECRET ||= 'studio-e2e-access-' + tag;
    process.env.JWT_REFRESH_SECRET ||= 'studio-e2e-refresh-' + tag;
    for (const key of ['PUSH_ENABLED', 'FIXTURE_DAY_REMINDERS_ENABLED', 'REGISTRATION_NOTIFICATIONS_ENABLED', 'TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED', 'CARD_EXPORT_CLEANUP_ENABLED', 'ARENA_MEDIA_CLEANUP_ENABLED', 'OCR_RETENTION_CLEANUP_ENABLED']) process.env[key] = 'false';
    app = (await Test.createTestingModule({ imports: [PrismaModule, SecurityModule, AuthModule, TournamentsModule] }).compile()).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    const createUser = (index: number) => db.user.create({
      data: { fullName: 'Studio Player ' + index, email: 'studio-' + tag + '-' + index + '@example.invalid', passwordHash: 'not-a-login-hash', status: 'ACTIVE' },
    });
    owner = (await createUser(-1)).id;
    outsider = (await createUser(-2)).id;
    leagueId = (await db.league.create({ data: { name: 'Studio QA', code: 'ST' + tag, creatorUserId: owner } })).id;
    await db.leagueMember.create({ data: { userId: owner, leagueId, type: 'PRIMARY' } });
    await db.leagueAdmin.create({ data: { userId: owner, leagueId, role: 'OWNER' } });
    for (let index = 0; index < 43; index++) {
      const user = await createUser(index);
      players.push(user.id);
      await db.leagueMember.create({ data: { userId: user.id, leagueId, type: 'PRIMARY' } });
      await db.player.create({ data: {
        userId: user.id, playerCode: 'S' + tag + index,
        identity: { create: { inGameName: 'Studio Player ' + index, inGameNameNormalized: 'studio-' + tag + '-' + index } },
      } });
    }
    const sign = (sub: string) => new JwtService().sign({ sub, email: 'studio@example.invalid', role: 'USER', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 });
    token = sign(owner);
    visitor = sign(outsider);
  }, 60000);

  afterAll(async () => {
    if (db && leagueId) {
      const cups = await db.tournament.findMany({ where: { leagueId }, select: { id: true } });
      await db.auditLog.deleteMany({ where: { scopeId: { in: [leagueId, ...cups.map(cup => cup.id)] } } });
      await db.league.delete({ where: { id: leagueId } });
    }
    if (db && owner) await db.user.deleteMany({ where: { id: { in: [owner, outsider, ...players].filter(Boolean) } } });
    await app?.close();
  });

  function post(path: string, data: object, bearer = token) {
    return request(app.getHttpServer()).post('/api' + path).set('Authorization', 'Bearer ' + bearer).send(data);
  }

  function get(path: string) {
    return request(app.getHttpServer()).get('/api' + path).set('Authorization', 'Bearer ' + token);
  }

  const draftBody = (config = {}) => ({ name: 'Calendar Cup ' + ++cupIndex, mode: 'SOLO', maxEntries: 4, registrationMode: 'ADMIN_ONLY',
    competitionFormat: 'LEAGUE_ROUND_ROBIN', requestId: randomUUID(), ...config });
  const create = (body: object) => post('/leagues/' + leagueId + '/tournament-studio', body);
  const path = (id: string) => '/tournaments/' + id;
  const draw = (id: string, body: object, bearer = token) => post(path(id) + '/studio/draw', { requestId: randomUUID(), ...body }, bearer);
  const state = async (id: string) => (await get(path(id) + '/studio').expect(200)).body.data;

  it('validates limits, creates a draft exactly once and rejects a conflicting replay', async () => {
    await create(draftBody({ maxEntries: 129 })).expect(400);
    await create(draftBody({ maxEntries: 1 })).expect(400);
    await create(draftBody({ mode: 'TEAM', teamSize: 12 })).expect(400);
    await create(draftBody({ mode: 'TEAM', teamSize: 2 })).expect(400);
    const body = draftBody({ maxEntries: 128, mode: 'TEAM', teamSize: 11 });
    const created = await Promise.all([create(body).expect(201), create(body).expect(201)]);
    expect(created[0]!.body.data.tournament.id).toBe(created[1]!.body.data.tournament.id);
    await create({ ...body, name: 'Different Cup' }).expect(409);
  });

  it('allocates distinct Duo teams, handles odd players and reconnects to the persisted wheel outcome', async () => {
    const cup = (await create(draftBody({ mode: 'DUO', maxEntries: 128 })).expect(201)).body.data.tournament.id;
    const command = { kind: 'PLAYER', requestId: randomUUID() };
    await draw(cup, command, visitor).expect(403);
    await draw(cup, { kind: 'MANUAL', playerIds: [players[0], players[0]] }).expect(400);
    const pair = await Promise.all([draw(cup, command).expect(201), draw(cup, command).expect(201)]);
    expect(pair[0]!.body.data).toEqual(pair[1]!.body.data);
    const roster = (await draw(cup, { kind: 'AUTO' }).expect(201)).body.data;
    expect(roster.unassigned).toBe(1);
    const saved = await state(cup);
    expect(saved.entries).toHaveLength(21);
    const ids = saved.entries.flatMap((entry: { members: { id: string }[] }) => entry.members.map(player => player.id));
    expect(new Set(ids).size).toBe(42);
    await draw(cup, { kind: 'PLAYER' }).expect(400);
    const first = saved.entries[0];
    await draw(cup, { kind: 'CLUB', entryId: first.id, clubs: ['Club North', 'Club North'] }).expect(201);
    await draw(cup, { kind: 'CLUB', entryId: saved.entries[1].id, clubs: ['club north'] }).expect(400);
    await draw(cup, { kind: 'MANUAL', entryId: first.id, playerIds: first.members.map((member: { id: string }) => member.id), name: 'Updated Club' }).expect(400);
    await draw(cup, { kind: 'MANUAL', entryId: first.id, playerIds: first.members.map((member: { id: string }) => member.id), name: 'Updated Club', reason: 'Owner correction' }).expect(201);
    expect(await db.auditLog.count({ where: { scopeId: cup, targetId: command.requestId } })).toBe(1);
  }, 30000);

  it('enforces team sizes and captain eligibility while concurrent manual draws cannot reuse a player', async () => {
    const cup = (await create(draftBody({ mode: 'TEAM', teamSize: 3, maxEntries: 2 })).expect(201)).body.data.tournament.id;
    await draw(cup, { kind: 'MANUAL', playerIds: players.slice(0, 2) }).expect(400);
    await draw(cup, { kind: 'MANUAL', playerIds: players.slice(0, 3), captainId: players[5] }).expect(400);
    await draw(cup, { kind: 'MANUAL', playerIds: [players[0], players[1], outsider] }).expect(409);
    const race = await Promise.all([
      draw(cup, { kind: 'MANUAL', playerIds: players.slice(0, 3), captainId: players[1] }),
      draw(cup, { kind: 'MANUAL', playerIds: players.slice(0, 3), captainId: players[2] }),
    ]);
    expect(race.map(result => result.status).sort((left, right) => left - right)).toEqual([201, 409]);
    await draw(cup, { kind: 'PLAYER' }).expect(201);
    await draw(cup, { kind: 'AUTO' }).expect(409);
  });

  it('draws 42 Solo entries into seven groups of six and locks published fixtures', async () => {
    const cup = (await create(draftBody({ maxEntries: 42, competitionFormat: 'GROUP_STAGE_KNOCKOUT' })).expect(201)).body.data.tournament.id;
    await draw(cup, { kind: 'AUTO' }).expect(201);
    const placement = (await draw(cup, { kind: 'GROUP' }).expect(201)).body.data.groups;
    expect(placement.map((group: { entryIds: string[] }) => group.entryIds.length)).toEqual(Array(7).fill(6));
    await draw(cup, { kind: 'GROUP' }).expect(400);
    const qualification = { playoffFormat: 'GLOBAL_SEEDED', playoffSource: 'AUTO', playoffSeedingBasis: 'AUTO', qualifiersPerGroup: 2 };
    await request(app.getHttpServer()).patch('/api' + path(cup) + '/wizard/qualification').set('Authorization', 'Bearer ' + token).send(qualification).expect(200);
    await post(path(cup) + '/wizard/fixture-preview/generate', {}).expect(201);
    const preview = await state(cup);
    expect(preview.fixtures).toHaveLength(105);
    expect(preview.publishedFixtureCount).toBe(0);
    expect(await db.match.count({ where: { tournamentId: cup } })).toBe(0);
    await draw(cup, { kind: 'GROUP', reason: 'Test protected preview' }).expect(409);
    await post(path(cup) + '/studio/publish', { confirmed: false, revision: preview.revision }).expect(400);
    await post(path(cup) + '/studio/publish', { confirmed: true, revision: 'a'.repeat(64) }).expect(409);
    const publish = { confirmed: true, revision: preview.revision };
    const outputs = await Promise.all([post(path(cup) + '/studio/publish', publish).expect(201), post(path(cup) + '/studio/publish', publish).expect(201)]);
    expect(outputs[0]!.body.data).toEqual(outputs[1]!.body.data);
    expect(await db.match.count({ where: { tournamentId: cup } })).toBe(105);
    expect((await state(cup)).tournament.status).toBe('ACTIVE');
    await draw(cup, { kind: 'GROUP', reason: 'Test published tournament' }).expect(409);
  }, 60000);

  it('rolls back fixture publication and match creation if final tournament validation fails', async () => {
    const cup = (await create(draftBody({ maxEntries: 2, competitionFormat: 'GROUP_STAGE_KNOCKOUT' })).expect(201)).body.data.tournament.id;
    await draw(cup, { kind: 'AUTO' }).expect(201);
    // Move to a two-entry knockout with no qualification and seed a real preview.
    const snapshot = await state(cup);
    await db.tournament.update({ where: { id: cup }, data: { competitionFormat: 'SINGLE_ELIMINATION', groupMode: 'SINGLE_GROUP' } });
    await db.fixture.create({ data: {
      tournamentId: cup, fixtureCode: 'ST-F-' + tag, sequence: 1, roundNumber: 1, roundName: 'Final', bracketPosition: 1,
      homeRegistrationId: snapshot.entries[0].id, awayRegistrationId: snapshot.entries[1].id,
    } });
    await post(path(cup) + '/studio/publish', { confirmed: true, revision: (await state(cup)).revision }).expect(409);
    expect((await state(cup)).publishedFixtureCount).toBe(0);
    expect(await db.match.count({ where: { tournamentId: cup } })).toBe(0);
  });
});
