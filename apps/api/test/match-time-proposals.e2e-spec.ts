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
import { MatchesModule } from '../src/matches/matches.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { SecurityModule } from '../src/security/security.module.js';

describe('match scheduling with authenticated players and PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const originalFlag = process.env.MATCH_TIME_PROPOSALS_ENABLED;
  const scheduledAt = new Date(Date.now() + 3 * 3600_000);
  let app: INestApplication | undefined;
  let db: PrismaService;
  let leagueId: string;
  let fixtureId: string;
  let matchId: string;
  let home: string;
  const userIds: string[] = [];
  const tokens: string[] = [];

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !url.pathname.endsWith('_test')) {
      throw new Error('Requires a disposable loopback *_test database.');
    }
    process.env.JWT_ACCESS_SECRET ||= 'local-match-proposal-test-access-secret';
    process.env.JWT_REFRESH_SECRET ||= 'local-match-proposal-test-refresh-secret';
    app = (await Test.createTestingModule({
      imports: [PrismaModule, SecurityModule, AuthModule, MatchesModule],
    }).compile()).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    const jwt = new JwtService();
    for (const label of ['home', 'away', 'outsider']) {
      const email = `scheduling-${label}-${run}@example.invalid`;
      const user = await db.user.create({
        data: { email, fullName: label, passwordHash: 'not-a-login-hash', status: 'ACTIVE' },
      });
      userIds.push(user.id);
      tokens.push(jwt.sign({ sub: user.id, email, role: 'USER', type: 'access' }, {
        secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900,
      }));
    }
    const [homeId, away] = userIds;
    home = homeId;
    const league = await db.league.create({
      data: { name: 'Advisory Scheduling', code: `MS${run}`, creatorUserId: home },
    });
    leagueId = league.id;
    await db.leagueMember.createMany({
      data: [home, away].map(userId => ({ leagueId, userId, type: 'PRIMARY' })),
    });
    const tournament = await db.tournament.create({
      data: {
        leagueId, createdByUserId: home, code: `MS-${run}`, name: 'Scheduling Cup',
        mode: 'SOLO', format: 'ROUND_ROBIN', maxEntries: 2, teamSize: 1,
      },
    });
    const entries = await Promise.all([home, away].map(userId =>
      db.tournamentRegistration.create({
        data: {
          tournamentId: tournament.id, registeredByUserId: userId, entryName: userId === home ? 'Home' : 'Away',
          status: 'APPROVED', members: { create: { tournamentId: tournament.id, userId } },
        },
      }),
    ));
    const fixture = await db.fixture.create({
      data: {
        fixtureCode: `MS-F-${run}`, tournamentId: tournament.id, sequence: 1,
        roundNumber: 1, roundName: 'Group', bracketPosition: 1,
        homeRegistrationId: entries[0].id, awayRegistrationId: entries[1].id,
        status: 'SCHEDULED', scheduledAt,
      },
    });
    fixtureId = fixture.id;
    const match = await db.match.create({
      data: { tournamentId: tournament.id, fixtureId, status: 'SCHEDULED' },
    });
    matchId = match.id;
  }, 60_000);

  afterAll(async () => {
    if (originalFlag === undefined) delete process.env.MATCH_TIME_PROPOSALS_ENABLED;
    else process.env.MATCH_TIME_PROPOSALS_ENABLED = originalFlag;
    if (leagueId) await db.league.delete({ where: { id: leagueId } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await app?.close();
  });

  const api = () => request(app!.getHttpServer());
  const route = () => `/api/matches/${matchId}/scheduling`;

  it('enforces flag and membership, ignores expired slots, and accepts a proposal once without changing the fixture', async () => {
    const auth = (index: number) => `Bearer ${tokens[index]}`;
    const startsAt = new Date(Date.now() + 2 * 3600_000);
    delete process.env.MATCH_TIME_PROPOSALS_ENABLED;
    const disabled = await api().get(route()).set('Authorization', auth(0)).expect(200);
    expect(disabled.body.data).toEqual({ enabled: false, proposals: [] });
    await api().post(route()).set('Authorization', auth(0)).send({ startsAt }).expect(503);

    process.env.MATCH_TIME_PROPOSALS_ENABLED = 'true';
    await api().get(route()).set('Authorization', auth(2)).expect(403);
    await db.matchTimeProposal.createMany({
      data: [1, 2, 3].map(hours => ({
        matchId, proposedByUserId: home, proposedSide: 'HOME', startsAt: new Date(Date.now() - hours * 3600_000),
      })),
    });
    const created = await api().post(route()).set('Authorization', auth(0)).send({ startsAt }).expect(201);
    const list = await api().get(route()).set('Authorization', auth(1)).expect(200);
    expect(list.body.data.proposals.filter((proposal: { status: string }) => proposal.status === 'EXPIRED')).toHaveLength(3);
    const accept = `${route()}/${created.body.data.proposalId}/accept`;
    await api().post(accept).set('Authorization', auth(0)).expect(403);
    const results = await Promise.all([0, 1].map(() => api().post(accept).set('Authorization', auth(1))));
    expect(results.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await db.fixture.findUniqueOrThrow({ where: { id: fixtureId } })).toMatchObject({
      scheduledAt, status: 'SCHEDULED',
    });
    expect(await db.auditLog.count({ where: { action: 'MATCH_TIME_ACCEPTED', targetId: matchId } })).toBe(1);
  });
});
