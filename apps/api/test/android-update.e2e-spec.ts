import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AdminOpsService } from '../src/admin-ops/admin-ops.service.js';
import { MobileVersionController } from '../src/admin-ops/admin-ops.controller.js';

describe('Android published update HTTP policy', () => {
  let module: TestingModule,
    app: INestApplication,
    db: PrismaService,
    releaseId: string;
  const read = (query: object = {}) =>
    request(app.getHttpServer())
      .get('/api/mobile/android/version')
      .query(query);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Requires disposable loopback *_test database.');
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      controllers: [MobileVersionController],
      providers: [AdminOpsService],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    db = module.get(PrismaService);
    // The fixture lives only in a restored, disposable database; no production releases are edited.
    await db.androidRelease.deleteMany();
    const user = await db.user.create({
      data: {
        email: `update-${randomUUID()}@example.invalid`,
        fullName: 'Update policy test',
        passwordHash: 'not-a-login-hash',
        status: 'ACTIVE',
      },
    });
    const base = {
      createdByUserId: user.id,
      versionName: '1.0.18',
      minimumSupportedVersionCode: 10,
    };
    releaseId = (
      await db.androidRelease.create({
        data: {
          ...base,
          versionCode: 20,
          channel: 'PRODUCTION',
          status: 'READY',
        },
      })
    ).id;
    await db.androidRelease.create({
      data: {
        ...base,
        versionCode: 21,
        versionName: '1.0.19',
        channel: 'CLOSED',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    await db.androidRelease.create({
      data: {
        ...base,
        versionCode: 22,
        versionName: '1.0.20',
        channel: 'PRODUCTION',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() + 86_400_000),
      },
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('excludes candidates, closed testing releases and future announcements', async () => {
    const response = await read({ versionName: '1.0.17' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data).toEqual({
      updateAvailable: false,
      forceUpdate: false,
      latest: null,
    });
  });
  it('notifies old installed names/codes once the production release is actually published', async () => {
    await db.androidRelease.update({
      where: { id: releaseId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    for (const query of [
      { versionName: '1.0.9' },
      { versionName: '1.0.17' },
      { versionCode: '19' },
    ]) {
      const response = await read(query);
      expect(response.status).toBe(200);
      expect(response.body.data.updateAvailable).toBe(true);
      expect(response.body.data.latest.versionCode).toBe(20);
      expect(response.body.data.latest.playStoreUrl).toBe(
        'https://play.google.com/store/apps/details?id=in.fcarena.app',
      );
    }
  });
  it('keeps current/newer clients and unrecognized versions quiet', async () => {
    for (const query of [
      { versionName: '1.0.18' },
      { versionName: '1.0.19' },
      { versionCode: '20' },
      { versionCode: '21' },
      { versionCode: '1e1' },
      { versionName: 'broken' },
      {},
    ]) {
      const response = await read(query);
      expect(response.status).toBe(200);
      expect(response.body.data.updateAvailable).toBe(false);
    }
  });
});
