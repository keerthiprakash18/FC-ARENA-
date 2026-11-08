import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
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
import { AuthorizationService } from '../src/security/authorization.service.js';
import { ResultsController } from '../src/results/results.controller.js';
import { ResultsService } from '../src/results/results.service.js';
import { ResultCorrectionService } from '../src/results/result-correction.service.js';
import { ResultReviewService } from '../src/results/result-review.service.js';
import { MatchRealtimeService } from '../src/matches/match-realtime.service.js';

describe('Result review queue with authenticated HTTP and real PostgreSQL', () => {
  let app: INestApplication,
    db: PrismaService,
    permission: AuthorizationService,
    storage: string,
    outside: string;
  const users: string[] = [],
    leagues: string[] = [],
    cups: string[] = [],
    matches: string[] = [],
    results: string[] = [];
  const run = randomUUID().slice(0, 8);
  let screenshotResult: string, screenshot: string;
  const token = (id: string) =>
    new JwtService().sign(
      {
        sub: id,
        email: 'review@example.invalid',
        role: 'USER',
        type: 'access',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 300 },
    );
  const get = (id: string, query = '') =>
    request(app.getHttpServer())
      .get('/api/admin/results' + query)
      .set('Authorization', `Bearer ${token(id)}`);
  const post = (id: string, result: string, action: string) =>
    request(app.getHttpServer())
      .post(`/api/results/${result}/${action}`)
      .set('Authorization', `Bearer ${token(id)}`);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Requires a disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET = 'review-access-' + run;
    process.env.JWT_REFRESH_SECRET = 'review-refresh-' + run;
    storage = await mkdtemp(join(tmpdir(), 'review-evidence-'));
    outside = await mkdtemp(join(tmpdir(), 'review-outside-'));
    process.env.OCR_UPLOAD_DIR = storage;
    app = (
      await Test.createTestingModule({
        imports: [PrismaModule, SecurityModule, AuthModule],
        controllers: [ResultsController],
        providers: [
          ResultReviewService,
          ResultsService,
          ResultCorrectionService,
          MatchRealtimeService,
        ],
      }).compile()
    ).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    permission = app.get(AuthorizationService);
    for (let i = 0; i < 8; i++)
      users.push(
        (
          await db.user.create({
            data: {
              email: `review-${run}-${i}@example.invalid`,
              fullName: `Reviewer ${i}`,
              passwordHash: 'not-a-login-hash',
              status: 'ACTIVE',
              ...(i === 7 ? { role: 'SUPER_ADMIN' } : {}),
            },
          })
        ).id,
      );
    for (let i = 0; i < 2; i++) {
      const league = await db.league.create({
        data: {
          name: `Review League ${i}`,
          code: `RV${run}${i}`,
          creatorUserId: users[i],
        },
      });
      leagues.push(league.id);
      const cup = await db.tournament.create({
        data: {
          leagueId: league.id,
          createdByUserId: users[i],
          name: `Review Cup ${i}`,
          code: `RV${run}${i}`,
          mode: 'SOLO',
          format: 'ROUND_ROBIN',
          maxEntries: 4,
          teamSize: 1,
        },
      });
      cups.push(cup.id);
      const entries = await Promise.all(
        [2, 3].map((u, order) =>
          db.tournamentRegistration.create({
            data: {
              tournamentId: cup.id,
              registeredByUserId: users[u],
              entryName: `Club ${order}`,
              status: 'APPROVED',
              sortOrder: order,
              members: { create: { tournamentId: cup.id, userId: users[u] } },
            },
          }),
        ),
      );
      for (let sequence = 1; sequence <= (i ? 1 : 22); sequence++) {
        const fixture = await db.fixture.create({
          data: {
            tournamentId: cup.id,
            fixtureCode: `RV${run}${i}-${sequence}`,
            sequence,
            roundNumber: sequence,
            roundName: `Round ${sequence}`,
            bracketPosition: 1,
            homeRegistrationId: entries[0].id,
            awayRegistrationId: entries[1].id,
          },
        });
        const match = await db.match.create({
          data: { tournamentId: cup.id, fixtureId: fixture.id },
        });
        matches.push(match.id);
        results.push(
          (
            await db.resultSubmission.create({
              data: {
                matchId: match.id,
                submittedByUserId: users[2],
                homeScore: 2,
                awayScore: 1,
                createdAt: new Date(Date.now() + sequence * 1000),
              },
            })
          ).id,
        );
      }
    }
    await db.tournamentAdmin.create({
      data: {
        tournamentId: cups[0],
        userId: users[4],
        permissions: ['VERIFY_SCORES'],
      },
    });
    await db.tournamentAdmin.create({
      data: {
        tournamentId: cups[0],
        userId: users[5],
        permissions: ['VIEW_REPORTS'],
      },
    });
    await db.roleAssignment.create({
      data: {
        userId: users[6],
        role: 'MATCH_OFFICIAL',
        scopeType: 'LEAGUE',
        scopeId: leagues[0],
      },
    });
    screenshot = join(storage, 'evidence.png');
    await writeFile(
      screenshot,
      await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
      })
        .png()
        .toBuffer(),
    );
    const extraction = await db.ocrExtraction.create({
      data: {
        matchId: matches[1],
        submittedByUserId: users[2],
        imagePath: screenshot,
        mimeType: 'image/png',
        fileSize: 100,
        status: 'COMPLETED',
      },
    });
    screenshotResult = results[1];
    await db.resultSubmission.update({
      where: { id: screenshotResult },
      data: { ocrExtractionId: extraction.id, source: 'OCR' },
    });
  }, 60000);
  afterAll(async () => {
    for (const id of leagues) await db.league.delete({ where: { id } });
    for (const id of users) await db.user.delete({ where: { id } });
    await app?.close();
    await rm(storage, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  it('requires authentication and verifier authority, validates bounded filters', async () => {
    await request(app.getHttpServer()).get('/api/admin/results').expect(401);
    await get(users[2]).expect(403);
    await get(users[5]).expect(403);
    for (const query of [
      '?page=0',
      '?page=10001',
      '?status=ANY',
      '?leagueId=invalid',
      '?extra=true',
    ])
      await get(users[0], query).expect(400);
  });
  it('scopes counts, options and pages before reading submissions, matching per-match authorization', async () => {
    for (const user of [users[0], users[4], users[6]]) {
      const { body } = await get(user).expect(200);
      expect(body.data.total).toBe(22);
      expect(body.data.submissions).toHaveLength(20);
      expect(body.data.tournaments.map((t: any) => t.id)).toEqual([cups[0]]);
      const ids = body.data.submissions.map((s: any) => s.id);
      expect(ids).toEqual(results.slice(0, 20));
      const second = await get(user, '?page=2').expect(200);
      expect(second.body.data.submissions.map((s: any) => s.id)).toEqual(
        results.slice(20, 22),
      );
      expect(await permission.canVerifyResult(user, matches[0])).toBe(true);
      expect(await permission.canVerifyResult(user, matches.at(-1)!)).toBe(
        false,
      );
      const other = await get(user, '?tournamentId=' + cups[1]).expect(200);
      expect(other.body.data.total).toBe(0);
      expect(JSON.stringify(body.data)).not.toContain('imagePath');
      expect(JSON.stringify(body.data)).not.toContain('@example.invalid');
    }
    const global = await get(users[7]).expect(200);
    expect(global.body.data.total).toBeGreaterThanOrEqual(23);
  });
  it('keeps screenshot evidence private, validates storage containment including symlinks, handles retention', async () => {
    const path = `/api/results/${screenshotResult}/evidence`;
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token(users[1])}`)
      .expect(403);
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token(users[4])}`)
      .expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.data.mimeType).toBe('image/png');
    expect(
      Buffer.from(response.body.data.base64, 'base64').length,
    ).toBeGreaterThan(50);
    const external = join(outside, 'private.png');
    await writeFile(external, Buffer.from('private'));
    const link = join(storage, 'link.png');
    await symlink(external, link);
    const result = await db.resultSubmission.findUniqueOrThrow({
      where: { id: screenshotResult },
    });
    for (const imagePath of [external, link, join(storage, 'removed.png')]) {
      await db.ocrExtraction.update({
        where: { id: result.ocrExtractionId! },
        data: { imagePath },
      });
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token(users[4])}`)
        .expect(404);
    }
  });
  it('uses existing reject and confirm transactions, handles concurrent reviewers without duplicate statistics', async () => {
    await post(users[1], results[0], 'confirm').expect(403);
    await post(users[4], results[0], 'reject')
      .send({ reason: 'Scores do not match the screenshot.' })
      .expect(201);
    const rejected = await get(users[4], '?status=REJECTED').expect(200);
    expect(rejected.body.data.submissions[0]).toMatchObject({
      id: results[0],
      rejectionReason: 'Scores do not match the screenshot.',
    });
    await post(users[4], results[0], 'reject')
      .send({ reason: 'Again' })
      .expect(409);
    const attempts = await Promise.all([
      post(users[4], results[2], 'confirm'),
      post(users[6], results[2], 'confirm'),
    ]);
    expect(attempts.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await db.matchResultStatEvent.count({
        where: { matchId: matches[2], type: 'APPLY' },
      }),
    ).toBe(1);
    const verified = await get(users[4], '?status=CONFIRMED').expect(200);
    expect(verified.body.data.submissions[0].id).toBe(results[2]);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matches[2] } }))
        .confirmedResultSubmissionId,
    ).toBe(results[2]);
  }, 30000);
});
