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
import { configureHttpSecurity } from '../src/security/http-security.js';
import { LeagueFixtureFeedController } from '../src/leagues/league-fixture-feed.controller.js';
import { LeagueFixtureFeedService } from '../src/leagues/league-fixture-feed.service.js';

describe('League schedule feed with real PostgreSQL and authenticated HTTP', () => {
  let app: INestApplication, db: PrismaService;
  let owner: string, outsider: string, leagueId: string, token: string, outsiderToken: string, entryId: string, fixtureId: string;
  const run = randomUUID().slice(0, 8);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Requires a disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET = 'feed-access-' + run;
    process.env.JWT_REFRESH_SECRET = 'feed-refresh-' + run;
    app = (await Test.createTestingModule({ imports: [PrismaModule, SecurityModule, AuthModule],
      controllers: [LeagueFixtureFeedController], providers: [LeagueFixtureFeedService] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.init(); db = app.get(PrismaService);
    const makeUser = (label: string) => db.user.create({ data: { email: `feed-${label}-${run}@example.invalid`,
      fullName: `Feed ${label}`, passwordHash: 'not-a-login-hash', status: 'ACTIVE' } });
    owner = (await makeUser('owner')).id; outsider = (await makeUser('outsider')).id;
    leagueId = (await db.league.create({ data: { name: 'Feed League', code: `FD${run}`, creatorUserId: owner } })).id;
    await db.leagueMember.create({ data: { leagueId, userId: owner, type: 'PRIMARY' } });
    for (let cup = 0; cup < 2; cup++) {
      const tournament = await db.tournament.create({ data: { leagueId, createdByUserId: owner,
        name: `Feed Cup ${cup}`, code: `FD${run}${cup}`, mode: 'SOLO', format: 'ROUND_ROBIN',
        competitionFormat: 'UCL_CUP', legType: 'HOME_AWAY', maxEntries: 36, teamSize: 1 } });
      const entries = await Promise.all([0, 1].map(i => db.tournamentRegistration.create({ data: {
        tournamentId: tournament.id, registeredByUserId: owner, entryName: `Club ${cup}-${i}`, status: 'APPROVED', sortOrder: i,
      } })));
      for (let leg = 0; leg < 2; leg++) {
        const fixture = await db.fixture.create({ data: { tournamentId: tournament.id,
          fixtureCode: `FD-${run}-${cup}-${leg}`, sequence: leg + 1, roundNumber: 1, roundName: `Playoff Leg ${leg + 1}`,
          bracketPosition: 1, matchday: leg + 1, phase: 'PLAYOFF', homeRegistrationId: entries[leg].id, awayRegistrationId: entries[1 - leg].id } });
        await db.match.create({ data: { tournamentId: tournament.id, fixtureId: fixture.id } });
        fixtureId = fixture.id;
      }
      entryId = entries[0].id;
    }
    const jwt = new JwtService();
    const sign = (id: string) => jwt.sign({ sub: id, email: 'feed@example.invalid', role: 'USER', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 120 });
    token = sign(owner); outsiderToken = sign(outsider);
  }, 30000);
  afterAll(async () => {
    if (leagueId) await db.league.delete({ where: { id: leagueId } });
    if (owner) await db.user.delete({ where: { id: owner } });
    if (outsider) await db.user.delete({ where: { id: outsider } });
    await app?.close();
  });
  const read = (bearer = token, version?: string) => request(app.getHttpServer())
    .get(`/api/leagues/${leagueId}/fixture-feed${version ? '?version=' + version : ''}`).set('Authorization', `Bearer ${bearer}`);
  it('returns a compact complete two-tournament schedule and retains both UCL playoff legs', async () => {
    await request(app.getHttpServer()).get(`/api/leagues/${leagueId}/fixture-feed`).expect(401);
    await read(outsiderToken).expect(403);
    const { body } = await read().expect(200);
    expect(body.data.tournaments).toHaveLength(2); expect(body.data.fixtures).toHaveLength(4);
    expect(Object.keys(body.data.entries)).toHaveLength(4);
    expect(body.data.fixtures.every((f: any) => f.match?.id && f.phase === 'PLAYOFF')).toBe(true);
    expect(JSON.stringify(body.data)).not.toContain('@example.invalid');
    const unchanged = await read(token, body.data.version).expect(200);
    expect(unchanged.body.data).toEqual({ unchanged: true, version: body.data.version });
    expect(JSON.stringify(unchanged.body).length).toBeLessThan(120);
  });
  it('changes the version for roster and fixture changes, without writing on reads', async () => {
    const before = (await read().expect(200)).body.data;
    const count = await db.match.count({ where: { tournament: { leagueId } } });
    await db.tournamentRegistration.update({ where: { id: entryId }, data: { entryName: 'Renamed Club' } });
    const renamed = (await read(token, before.version).expect(200)).body.data;
    expect(renamed.unchanged).toBe(false); expect(renamed.entries[entryId].entryName).toBe('Renamed Club');
    await db.fixture.update({ where: { id: fixtureId }, data: { status: 'COMPLETED' } });
    const completed = (await read(token, renamed.version).expect(200)).body.data;
    expect(completed.version).not.toBe(renamed.version);
    expect(completed.fixtures.find((f: any) => f.id === fixtureId).status).toBe('COMPLETED');
    expect(await db.match.count({ where: { tournament: { leagueId } } })).toBe(count);
  });
  it('rechecks membership even when a client presents the current version', async () => {
    const version = (await read().expect(200)).body.data.version;
    await read(outsiderToken, version).expect(403);
    await db.leagueMember.delete({ where: { leagueId_userId: { leagueId, userId: owner } } });
    await read(token, version).expect(403);
  });
});
