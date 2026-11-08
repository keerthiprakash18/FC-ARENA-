import 'reflect-metadata';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile, utimes } from 'node:fs/promises';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { PlayerCardExportService } from '../src/player-career/player-card-export.service.js';
import { PlayerCardExportController } from '../src/player-career/player-card-export.controller.js';
import { PlayerProfileImageService } from '../src/player-career/player-profile-image.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';

describe('Profile photo and card exports with real PostgreSQL and HTTP', () => {
  let app: INestApplication, db: PrismaService, cards: PlayerCardExportService;
  let userId: string, token: string, png: Buffer;
  const run = randomUUID().slice(0, 8);
  const directory = resolve(
    process.cwd(),
    '../../.cache/profile-fix/exports-' + run,
  );
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Requires a disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET = 'profile-test-access-' + run;
    process.env.JWT_REFRESH_SECRET = 'profile-test-refresh-' + run;
    process.env.CARD_EXPORT_DIR = directory;
    process.env.CARD_EXPORT_CLEANUP_ENABLED = 'false';
    app = (
      await Test.createTestingModule({
        imports: [PrismaModule, SecurityModule, AuthModule],
        controllers: [PlayerCardExportController],
        providers: [PlayerCardExportService],
      }).compile()
    ).createNestApplication();
    configureHttpSecurity(app);
    await app.init();
    db = app.get(PrismaService);
    cards = app.get(PlayerCardExportService);
    userId = (
      await db.user.create({
        data: {
          email: `profile-${run}@example.invalid`,
          fullName: 'Profile Test',
          passwordHash: 'not-a-login-hash',
          status: 'ACTIVE',
          player: { create: { playerCode: `PF${run}` } },
        },
      })
    ).id;
    token = new JwtService().sign(
      {
        sub: userId,
        email: `profile-${run}@example.invalid`,
        role: 'USER',
        type: 'access',
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 60 },
    );
    png = await sharp({
      create: { width: 1080, height: 1350, channels: 3, background: '#e52b2b' },
    })
      .png()
      .toBuffer();
  }, 30000);
  beforeEach(async () => {
    await db.authRateLimit.deleteMany({
      where: {
        action: 'PLAYER_CARD_EXPORT',
        keyHash: createHash('sha256')
          .update('card-export:' + userId)
          .digest('hex'),
      },
    });
  });
  afterAll(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (userId) await db.user.delete({ where: { id: userId } });
    await app?.close();
  });
  const create = () =>
    request(app.getHttpServer())
      .post('/api/players/me/card-export')
      .set('Authorization', `Bearer ${token}`)
      .field('filename', 'FC-ARENA-profile.png')
      .attach('image', png, { filename: 'card.png', contentType: 'image/png' });
  it('creates an actual HTTPS-downloadable PNG attachment without browser blob URLs or cookies', async () => {
    await request(app.getHttpServer())
      .post('/api/players/me/card-export')
      .expect(401);
    const response = await create().expect(201);
    const path = response.body.data.path;
    const download = await request(app.getHttpServer())
      .get('/api' + path)
      .expect(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['content-disposition']).toBe(
      'attachment; filename="FC-ARENA-profile.png"',
    );
    expect(download.headers['cache-control']).toBe('private, no-store');
    const image = await sharp(download.body).metadata();
    expect(image.width).toBe(1080);
    expect(image.height).toBe(1350);
    expect((await sharp(download.body).raw().toBuffer())[0]).toBe(229);
  });
  it('rejects missing, changed and mismatched grants and revoked accounts', async () => {
    const path = (await create().expect(201)).body.data.path;
    const url = new URL(path, 'https://example.invalid');
    const id = url.pathname.split('/').at(-1)!;
    await request(app.getHttpServer())
      .get('/api/players/card-exports/' + id)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api' + path + 'x')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api' + path.replace(id, randomUUID()))
      .expect(403);
    await db.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get('/api' + path)
      .expect(403);
    await db.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  });
  it('expires signed links and removes old temporary files', async () => {
    const path = (await create().expect(201)).body.data.path;
    const url = new URL(path, 'https://example.invalid');
    const id = url.pathname.split('/').at(-1)!;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 6 * 60_000);
    await expect(
      cards.download(id, url.searchParams.get('grant')!),
    ).rejects.toMatchObject({ status: 403 });
    vi.useRealTimers();
    const file = resolve(directory, id + '.png');
    await utimes(file, new Date(0), new Date(0));
    await cards.cleanup();
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects executable/oversized input and unsafe filenames before serving a card', async () => {
    await request(app.getHttpServer())
      .post('/api/players/me/card-export')
      .set('Authorization', `Bearer ${token}`)
      .field('filename', '../bad.png')
      .attach('image', png, 'card.png')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/players/me/card-export')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('<svg/>'), {
        filename: 'bad.png',
        contentType: 'image/png',
      })
      .expect(400);
    const wide = await sharp({
      create: { width: 3000, height: 10, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await request(app.getHttpServer())
      .post('/api/players/me/card-export')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', wide, 'wide.png')
      .expect(400);
  });
  it('caps card preparation per account across requests', async () => {
    await db.authRateLimit.create({
      data: {
        action: 'PLAYER_CARD_EXPORT',
        keyHash: createHash('sha256')
          .update('card-export:' + userId)
          .digest('hex'),
        attemptCount: 10,
        windowStartedAt: new Date(),
      },
    });
    await create().expect(429);
  });
  it('preserves the chosen square crop and changes the stored avatar URL after each save', async () => {
    const oldUrl = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = 'cloudinary://test-key:test-secret@fc-test';
    const captured: Buffer[] = [];
    const mock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, options) => {
        expect(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).toBe(
          'https://api.cloudinary.com/v1_1/fc-test/image/upload',
        );
        const form = options?.body;
        if (!(form instanceof FormData)) throw new Error('Expected the processed photo upload.');
        const blob = form.get('file') as Blob;
        captured.push(Buffer.from(await blob.arrayBuffer()));
        return new Response(
          JSON.stringify({
            secure_url:
              'https://res.cloudinary.com/fc-test/image/upload/v1/profile.webp',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });
    try {
      const service = new PlayerProfileImageService(db);
      const crop = await sharp({
        create: { width: 512, height: 512, channels: 3, background: '#ff0000' },
      })
        .jpeg()
        .toBuffer();
      const file = {
        buffer: crop,
        size: crop.length,
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const first = await service.uploadAvatar(userId, file);
      const second = await service.uploadAvatar(userId, file);
      expect(first.data.profileImageUrl).not.toBe(second.data.profileImageUrl);
      const output = sharp(captured[0]);
      expect(await output.metadata()).toMatchObject({
        width: 512,
        height: 512,
        format: 'webp',
      });
      const pixels = await output.raw().toBuffer();
      expect(pixels[0]).toBeGreaterThan(245);
      expect(pixels[1]).toBeLessThan(10);
    } finally {
      mock.mockRestore();
      if (oldUrl === undefined) delete process.env.CLOUDINARY_URL;
      else process.env.CLOUDINARY_URL = oldUrl;
    }
  });
});
