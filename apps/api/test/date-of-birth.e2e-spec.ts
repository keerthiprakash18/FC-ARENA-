import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { OtpMailService } from '../src/auth/mail.service.js';
import { DateOfBirthService } from '../src/auth/date-of-birth.service.js';
import { PublicController } from '../src/public/public.controller.js';
import { PublicService } from '../src/public/public.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';

describe('Birth dates: authenticated HTTP, registration, privacy and deletion', () => {
  let app: INestApplication, db: PrismaService, leagueId: string, code: string;
  const users: string[] = [],
    run = randomUUID().slice(0, 8),
    password = 'BirthTest123!';
  const token = (id: string) =>
    new JwtService().sign(
      { sub: id, email: 'dob@example.invalid', role: 'USER', type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 300 },
    );
  const read = (id: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + token(id));
  const update = (id: string, body: object) =>
    request(app.getHttpServer())
      .patch('/api/auth/me/date-of-birth')
      .set('Authorization', 'Bearer ' + token(id))
      .send(body);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Requires a disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET = 'dob-access-' + run;
    process.env.JWT_REFRESH_SECRET = 'dob-refresh-' + run;
    const module = await Test.createTestingModule({
      imports: [PrismaModule, SecurityModule, AuthModule],
      controllers: [PublicController],
      providers: [PublicService],
    })
      .overrideProvider(OtpMailService)
      .useValue({
        sendPasswordResetOtp: () => {
          throw new Error('This test must never send mail.');
        },
      })
      .compile();
    app = module.createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 4);
    for (let i = 0; i < 3; i++)
      users.push(
        (
          await db.user.create({
            data: {
              email: `dob-${run}-${i}@example.invalid`,
              fullName: `DOB Player ${i}`,
              passwordHash,
              status: 'ACTIVE',
              player: {
                create: {
                  playerCode: `DOB-${run}-${i}`,
                  identity: {
                    create: {
                      inGameName: `dob-${run}-${i}`,
                      inGameNameNormalized: `dob-${run}-${i}`,
                    },
                  },
                },
              },
            },
          })
        ).id,
      );
    leagueId = (
      await db.league.create({
        data: {
          name: 'Birth Privacy League',
          code: 'DB' + run,
          creatorUserId: users[0],
        },
      })
    ).id;
    code = 'DB' + run;
    const cup = await db.tournament.create({
      data: {
        leagueId,
        code,
        name: 'Public privacy cup',
        createdByUserId: users[0],
        mode: 'SOLO',
        format: 'ROUND_ROBIN',
        visibility: 'PUBLIC',
        maxEntries: 2,
        teamSize: 1,
      },
    });
    for (let i = 0; i < 2; i++)
      await db.tournamentRegistration.create({
        data: {
          tournamentId: cup.id,
          registeredByUserId: users[i],
          entryName: `Public Club ${i}`,
          status: 'APPROVED',
          sortOrder: i,
          members: { create: { tournamentId: cup.id, userId: users[i] } },
        },
      });
  }, 30000);
  afterAll(async () => {
    if (leagueId) await db.league.delete({ where: { id: leagueId } });
    for (const id of users) await db.user.delete({ where: { id } });
    await app?.close();
  });
  it('keeps legacy users unchanged until they enter a date, and rejects unauthorized writes', async () => {
    expect(
      (await read(users[0]).expect(200)).body.data.user.dateOfBirth,
    ).toBeNull();
    await request(app.getHttpServer())
      .patch('/api/auth/me/date-of-birth')
      .send({ dateOfBirth: '1996-07-18' })
      .expect(401);
    await update(users[0], {
      dateOfBirth: '1996-07-18',
      userId: users[1],
    }).expect(400);
    for (const value of [
      '2001-02-29',
      '2999-01-01',
      '1899-12-31',
      '2000-01-01T00:00:00Z',
      null,
      2000,
    ])
      await update(users[0], { dateOfBirth: value }).expect(400);
    expect(
      (await read(users[0]).expect(200)).body.data.user.dateOfBirth,
    ).toBeNull();
  });
  it('round-trips only the authenticated owner date and excludes it from public views and exports', async () => {
    const response = await update(users[0], {
      dateOfBirth: '1996-07-18',
    }).expect(200);
    expect(response.body.data.dateOfBirth).toBe('1996-07-18');
    expect((await read(users[0]).expect(200)).body.data.user.dateOfBirth).toBe(
      '1996-07-18',
    );
    expect(
      (await read(users[1]).expect(200)).body.data.user.dateOfBirth,
    ).toBeNull();
    const pub = await request(app.getHttpServer())
      .get('/api/public/tournaments/' + code)
      .expect(200);
    expect(JSON.stringify(pub.body)).not.toMatch(
      /dateOfBirth|date_of_birth|1996-07-18/,
    );
    const exported = await request(app.getHttpServer())
      .get('/api/public/tournaments/' + code + '/export?format=csv')
      .expect(200);
    expect(exported.text).not.toMatch(/dateOfBirth|date_of_birth|1996-07-18/);
  });
  it('accepts date of birth at registration and keeps old API clients compatible', async () => {
    for (const [label, dateOfBirth] of [
      ['new', '2000-02-29'],
      ['legacy', undefined],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: `Registered ${label}`,
          email: `dob-${run}-${label}@example.invalid`,
          inGameName: `dob-${run}-${label}`,
          password,
          confirmPassword: password,
          ...(dateOfBirth ? { dateOfBirth } : {}),
        })
        .expect(201);
      const id = response.body.data.user.id;
      users.push(id);
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: `dob-${run}-${label}@example.invalid`, password })
        .expect(200);
      expect(login.body.data.user.dateOfBirth).toBe(dateOfBirth ?? null);
    }
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        fullName: 'Invalid date',
        email: `dob-${run}-bad@example.invalid`,
        inGameName: `dob-${run}-bad`,
        password,
        confirmPassword: password,
        dateOfBirth: '2025-02-29',
      })
      .expect(400);
    expect(
      await db.user.count({
        where: { email: `dob-${run}-bad@example.invalid` },
      }),
    ).toBe(0);
  }, 30000);
  it('removes the private date when the owner deletes their account', async () => {
    await update(users[2], { dateOfBirth: '2000-02-29' }).expect(200);
    await request(app.getHttpServer())
      .delete('/api/auth/account')
      .set('Authorization', 'Bearer ' + token(users[2]))
      .send({ password, confirmation: 'DELETE' })
      .expect(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: users[2] } }))
        .dateOfBirth,
    ).toBeNull();
    await read(users[2]).expect(401);
    // Simulate a request that passed its HTTP guard immediately before deletion.
    await expect(
      app.get(DateOfBirthService).update(users[2], '2000-02-29'),
    ).rejects.toMatchObject({
      response: { error: { code: 'ACCOUNT_NOT_ACTIVE' } },
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: users[2] } }))
        .dateOfBirth,
    ).toBeNull();
  }, 30000);
});
