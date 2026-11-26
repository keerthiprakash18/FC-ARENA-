import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import {
  JwtService,
} from '@nestjs/jwt';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import {
  randomUUID,
} from 'node:crypto';
import request from 'supertest';
import { mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { vi } from 'vitest';
import { ArenaMediaService } from '../src/arena/arena-media.service.js';
import { ArenaService } from '../src/arena/arena.service.js';
import { AuthService } from '../src/auth/auth.service.js';

import {
  AppModule,
} from '../src/app.module.js';
import {
  PrismaService,
} from '../src/database/prisma.service.js';

describe(
  'Account deletion E2E',
  () => {
    let app:
      INestApplication;

    let prisma:
      PrismaService;

    let jwt:
      JwtService;

    let userId =
      '';

    let leagueId =
      '';

    let accessToken =
      '';
    let authoredPostId = '';
    let retainedPostId = '';
    let matchId = '';
    let mediaRoot = '';
    let ocrPath = '';
    let imageKey = '';
    let retainedImageKey = '';
    let recentImageKey = '';
    let observerId = '';
    let observerToken = '';
    let imageUrl = '';
    const authoredRequestId = randomUUID();
    const previousMediaRoot = process.env.ARENA_MEDIA_DIR;

    const originalEmail =
      `delete-${randomUUID()}@example.test`;

    const originalName =
      'Deletion Test User';

    const originalInGameName =
      `Delete${randomUUID()
        .replaceAll(
          '-',
          '',
        )
        .slice(
          0,
          10,
        )}`;

    const password =
      'Deletion-Test-Password-42!';

    beforeAll(
      async () => {
        const url =
          new URL(
            process.env
              .DATABASE_URL ??
              '',
          );

        if (
          process.env.NODE_ENV !==
            'test' ||
          ![
            'localhost',
            '127.0.0.1',
            '[::1]',
            '::1',
          ].includes(
            url.hostname,
          ) || !url.pathname.endsWith('_test')
        ) {
          throw new Error(
            'Account deletion E2E requires an isolated local test database.',
          );
        }

        mediaRoot = await mkdtemp(join(tmpdir(), 'fcarena-deletion-'));
        process.env.ARENA_MEDIA_DIR = mediaRoot;
        const moduleFixture:
          TestingModule =
          await Test.createTestingModule({
            imports: [
              AppModule,
            ],
          }).compile();

        app =
          moduleFixture.createNestApplication();

        app.setGlobalPrefix(
          'api',
        );

        app.useGlobalPipes(
          new ValidationPipe({
            whitelist:
              true,
            transform:
              true,
            forbidNonWhitelisted:
              true,
          }),
        );

        await app.init();

        prisma =
          app.get(
            PrismaService,
          );

        jwt =
          app.get(
            JwtService,
          );

        const user =
          await prisma.user.create({
            data: {
              fullName:
                originalName,
              email:
                originalEmail,
              phoneNumber:
                '+15550001111',
              dateOfBirth: new Date('1998-01-01T00:00:00Z'),
              notificationPreferences: { matchReminders: false },
              dashboardPreferences: { stats: false },
              passwordHash:
                await bcrypt.hash(
                  password,
                  12,
                ),
              status:
                'ACTIVE',
              role:
                'USER',
              emailVerifiedAt:
                new Date(),
            },
          });

        userId =
          user.id;

        const player =
          await prisma.player.create({
            data: {
              userId:
                user.id,
              whatsappNumber: '+15550002222',
              whatsappShareEnabled: true,
              playerCode:
                `DELTEST-${randomUUID()
                  .replaceAll(
                    '-',
                    '',
                  )
                  .slice(
                    0,
                    8,
                  )
                  .toUpperCase()}`,
            },
          });

        await prisma.playerIdentity.create({
          data: {
            playerId:
              player.id,
            inGameName:
              originalInGameName,
            inGameNameNormalized:
              originalInGameName
                .toLowerCase(),
            gameUid:
              `uid-${randomUUID()}`,
            isVerified:
              true,
            verifiedAt:
              new Date(),
          },
        });

        const league =
          await prisma.league.create({
            data: {
              name:
                'Deletion History League',
              code:
                `DH${randomUUID()
                  .replaceAll(
                    '-',
                    '',
                  )
                  .slice(
                    0,
                    10,
                  )
                  .toUpperCase()}`,
              creatorUserId:
                user.id,
            },
          });

        leagueId =
          league.id;

        await prisma.leagueMember.create({
          data: {
            leagueId:
              league.id,
            userId:
              user.id,
            type:
              'PRIMARY',
          },
        });

        observerId = (await prisma.user.create({ data: {
          fullName: 'Independent observer', email: `observer-${randomUUID()}@example.test`,
          passwordHash: 'not-a-login-hash', status: 'ACTIVE',
        } })).id;
        await prisma.leagueMember.create({ data: { leagueId, userId: observerId, type: 'PRIMARY' } });
        await prisma.arenaLeagueSubscription.create({ data: { leagueId, userId: observerId } });
        observerToken = await jwt.signAsync({ sub: observerId, type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, algorithm: 'HS256', expiresIn: '15m' });
        const tournament = await prisma.tournament.create({ data: {
          leagueId, createdByUserId: userId, code: `DEL${randomUUID().slice(0, 8)}`,
          name: 'Deletion history cup', mode: 'SOLO', format: 'ROUND_ROBIN', teamSize: 1, maxEntries: 4,
        } });
        const fixture = await prisma.fixture.create({ data: {
          tournamentId: tournament.id, fixtureCode: `DEL-${randomUUID().slice(0, 8)}`,
          sequence: 1, roundNumber: 1, roundName: 'Final', bracketPosition: 1,
        } });
        matchId = (await prisma.match.create({ data: { tournamentId: tournament.id, fixtureId: fixture.id, status: 'COMPLETED' } })).id;
        ocrPath = join(mediaRoot, 'private-result.png');
        await writeFile(ocrPath, 'synthetic personal screenshot');
        await prisma.ocrExtraction.create({ data: {
          matchId, submittedByUserId: userId, imagePath: ocrPath, mimeType: 'image/png', fileSize: 29,
          rawText: originalEmail, detectedHomeName: originalInGameName, homeMatchedUserId: userId,
        } });
        const media = app.get(ArenaMediaService);
        imageKey = await media.save(Buffer.from('synthetic authored image'));
        retainedImageKey = await media.save(Buffer.from('independent retained image'));
        recentImageKey = await media.save(Buffer.from('recent upload still in progress'));
        const yesterday = new Date(Date.now() - 25 * 60 * 60_000);
        await utimes(join(mediaRoot, imageKey), yesterday, yesterday);
        await utimes(join(mediaRoot, retainedImageKey), yesterday, yesterday);

        const authored = await prisma.arenaPost.create({ data: {
          leagueId, authorUserId: userId, kind: 'DISCUSSION',
          body: originalEmail, sourceUrl: 'https://example.test/private',
          imageKey,
          clientRequestId: authoredRequestId,
          requestHash: 'a'.repeat(64),
          pollOptions: { create: [{ label: originalInGameName, position: 0 }, { label: 'Other', position: 1 }] },
        }, include: { pollOptions: true } });
        authoredPostId = authored.id;
        const retained = await prisma.arenaPost.create({ data: {
          leagueId, sourceMatchId: matchId, kind: 'RESULT', body: 'Independent retained result fixture', imageKey: retainedImageKey,
        } });
        retainedPostId = retained.id;
        imageUrl = media.imageUrl(authoredPostId, { sub: observerId });
        await prisma.arenaComment.create({ data: {
          postId: retainedPostId, authorUserId: userId, body: originalEmail,
          clientRequestId: randomUUID(),
        } });
        await prisma.arenaReaction.create({ data: { postId: retainedPostId, userId } });
        await prisma.arenaPollVote.create({ data: { postId: authoredPostId, optionId: authored.pollOptions[0].id, userId } });
        await prisma.arenaLeagueSubscription.create({ data: { leagueId, userId } });
        await prisma.playerExperiencePreferences.create({ data: { userId, frame: 'CLASSIC' } });
        const sessionId =
          randomUUID();

        await prisma.refreshSession.create({
          data: {
            id:
              sessionId,
            userId:
              user.id,
            tokenHash:
              randomUUID()
                .replaceAll(
                  '-',
                  '',
                )
                .padEnd(
                  64,
                  '0',
                )
                .slice(
                  0,
                  64,
                ),
            expiresAt:
              new Date(
                Date.now() +
                  60 *
                    60 *
                    1000,
              ),
          },
        });

        await prisma.pushDevice.create({
          data: {
            userId:
              user.id,
            sessionId,
            token:
              `deletion-test-token-${randomUUID()
                .replaceAll(
                  '-',
                  '',
                )}`,
          },
        });

        await prisma.authOtp.create({
          data: {
            userId:
              user.id,
            purpose:
              'PASSWORD_RESET',
            codeHash:
              'not-a-real-otp-hash',
            expiresAt:
              new Date(
                Date.now() +
                  10 *
                    60 *
                    1000,
              ),
          },
        });

        await prisma.notification.create({
          data: {
            userId:
              user.id,
            type:
              'MATCH_READY',
            title:
              'Deletion test',
            message:
              'Personal notification should be removed.',
            dedupeKey:
              `deletion-test-${randomUUID()}`,
            eventAt:
              new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            actorUserId:
              user.id,
            action:
              'ACCOUNT_DELETION_REQUESTED',
            targetType:
              'ACCOUNT_DELETION_REQUEST',
            targetId:
              randomUUID(),
            scopeType:
              'GLOBAL',
            scopeId:
              'PRIVACY',
            metadata: {
              email:
                originalEmail,
              inGameName:
                originalInGameName,
            },
          },
        });

        accessToken =
          await jwt.signAsync(
            {
              sub:
                user.id,
              email:
                user.email,
              role:
                user.role,
              type:
                'access',
              sid:
                sessionId,
            },
            {
              secret:
                process.env
                  .JWT_ACCESS_SECRET,
              algorithm:
                'HS256',
              expiresIn:
                '15m',
            },
          );
      },
      30_000,
    );

    afterAll(
      async () => {
        if (
          leagueId
        ) {
          await prisma.league.deleteMany({
            where: {
              id:
                leagueId,
            },
          });
        }

        if (
          userId
        ) {
          await prisma.user.deleteMany({
            where: {
              id:
                userId,
            },
          });
        }

        if (observerId) await prisma.user.deleteMany({ where: { id: observerId } });

        await app.close();
        vi.restoreAllMocks();
        if (previousMediaRoot === undefined) delete process.env.ARENA_MEDIA_DIR;
        else process.env.ARENA_MEDIA_DIR = previousMediaRoot;
        if (mediaRoot) {
          const target = await realpath(mediaRoot);
          expect(dirname(target)).toBe(await realpath(tmpdir()));
          await rm(target, { recursive: true, force: true });
        }
      },
      30_000,
    );

    it(
      'rejects deletion when the password confirmation is wrong',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .delete(
            '/api/auth/account',
          )
          .set(
            'Authorization',
            `Bearer ${accessToken}`,
          )
          .send({
            password:
              'wrong-password',
            confirmation:
              'DELETE',
          })
          .expect(
            401,
          );

        const user =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                userId,
            },
          });

        expect(
          user.status,
        ).toBe(
          'ACTIVE',
        );
      },
    );

    it(
      'fails closed when the media provider does not confirm deletion',
      async () => {
        await prisma.player.update({ where: { userId }, data: { profileImageUrl: 'https://res.cloudinary.com/fixture/image/upload/profile.webp' } });
        const previous = Object.fromEntries(['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].map(key => [key, process.env[key]]));
        process.env.CLOUDINARY_URL = 'cloudinary://fixture-key:fixture-secret@fixture-cloud';
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
        try {
          await expect(app.get(AuthService).deleteAccount(userId, { password, confirmation: 'DELETE' }))
            .rejects.toMatchObject({ status: 503, response: { error: { code: 'ACCOUNT_DELETION_IMAGE_CLEANUP_FAILED' } } });
          expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).status).toBe('ACTIVE');
          expect((await prisma.arenaPost.findUniqueOrThrow({ where: { id: authoredPostId } })).body).toBe(originalEmail);
          expect(await readFile(ocrPath, 'utf8')).toBe('synthetic personal screenshot');
          expect(fetch).toHaveBeenCalledTimes(1);
        } finally {
          fetch.mockRestore();
          for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
          }
          await prisma.player.update({ where: { userId }, data: { profileImageUrl: null } });
        }
      },
      30_000,
    );

    it(
      'keeps the official-result and authored-request constraints enforced',
      async () => {
        await expect(prisma.arenaPost.create({ data: { leagueId, kind: 'RESULT', body: 'Invalid source-less result' } })).rejects.toThrow('arena_post_source_check');
        await expect(prisma.arenaPost.update({ where: { id: authoredPostId }, data: { clientRequestId: null } })).rejects.toThrow('arena_post_source_check');
      },
    );

    it(
      'deletes personal runtime data, anonymizes identity and keeps competition history',
      async () => {
        await request(app.getHttpServer()).get(`/api${imageUrl}`).expect(200);
        await prisma.player.update({ where: { userId }, data: { profileImageUrl: 'https://res.cloudinary.com/fixture/image/upload/profile.webp' } });
        const previousCloudUrl = process.env.CLOUDINARY_URL;
        process.env.CLOUDINARY_URL = 'cloudinary://fixture-key:fixture-secret@fixture-cloud';
        const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
          expect(String(input)).toBe('https://api.cloudinary.com/v1_1/fixture-cloud/image/destroy');
          expect((init?.body as FormData).get('public_id')).toBe(`fc-arena/players/${(await prisma.player.findUniqueOrThrow({ where: { userId } })).id}/profile`);
          return new Response('{"result":"ok"}', { status: 200 });
        });
        let responses;
        try {
          responses = await Promise.all([
          ...Array.from({ length: 2 }, () => request(app.getHttpServer()).delete('/api/auth/account')
            .set('Authorization', `Bearer ${accessToken}`).send({ password, confirmation: 'DELETE' })),
          ...Array.from({ length: 4 }, () => request(app.getHttpServer()).patch(`/api/arena-talk/posts/${authoredPostId}`)
            .set('Authorization', `Bearer ${accessToken}`).send({ body: originalEmail })),
          ]);
          expect(fetch).toHaveBeenCalledTimes(2);
        } finally {
          fetch.mockRestore();
          if (previousCloudUrl === undefined) delete process.env.CLOUDINARY_URL;
          else process.env.CLOUDINARY_URL = previousCloudUrl;
        }
        expect(responses.every(response => [200, 401, 404, 409].includes(response.status))).toBe(true);
        expect(responses.slice(0, 2).filter(response => response.status === 200)).toHaveLength(1);
        const response = responses.slice(0, 2).find(response => response.status === 200)!;

        expect(
          response.body
            .data
            .accountDeleted,
        ).toBe(
          true,
        );

        const user =
          await prisma.user.findUniqueOrThrow({
            where: {
              id:
                userId,
            },
            include: {
              player: {
                include: {
                  identity:
                    true,
                },
              },
            },
          });

        expect(
          user.status,
        ).toBe(
          'DISABLED',
        );

        expect(
          user.fullName,
        ).toBe(
          'Deleted Player',
        );

        expect(
          user.email,
        ).not.toBe(
          originalEmail,
        );

        expect(
          user.email.endsWith(
            '@deleted.fcarena.invalid',
          ),
        ).toBe(
          true,
        );

        expect(
          user.phoneNumber,
        ).toBeNull();

        expect(
          user.player
            ?.profileImageUrl,
        ).toBeNull();

        expect(
          user.player
            ?.playerCode
            .startsWith(
              'DEL-',
            ),
        ).toBe(
          true,
        );

        expect(
          user.player
            ?.identity
            ?.inGameName,
        ).not.toBe(
          originalInGameName,
        );

        expect(
          user.player
            ?.identity
            ?.gameUid,
        ).toBeNull();

        expect(user.dateOfBirth).toBeNull();
        expect(user.notificationPreferences).toBeNull();
        expect(user.dashboardPreferences).toBeNull();
        expect(user.player?.whatsappNumber).toBeNull();
        expect(user.player?.whatsappShareEnabled).toBe(false);
        const authored = await prisma.arenaPost.findUniqueOrThrow({ where: { id: authoredPostId }, include: { pollOptions: true } });
        expect(authored.hiddenAt).not.toBeNull();
        expect(authored.body).toBe('Removed account content.');
        expect(authored.sourceUrl).toBeNull();
        expect(authored.imageKey).toBeNull();
        expect(authored.requestHash).toBeNull();
        expect(authored.clientRequestId).toBe(authoredRequestId);
        expect(authored.pollOptions.every(option => option.label === 'Removed option')).toBe(true);
        const retained = await prisma.arenaPost.findUniqueOrThrow({ where: { id: retainedPostId } });
        expect(retained.hiddenAt).toBeNull();
        expect(retained.body).toBe('Independent retained result fixture');
        expect(retained.sourceMatchId).toBe(matchId);
        expect(await prisma.match.count({ where: { id: matchId } })).toBe(1);
        const extraction = await prisma.ocrExtraction.findFirstOrThrow({ where: { matchId } });
        expect(extraction.imagePath).toBe('redacted://account-deletion');
        expect(extraction.rawText).toBeNull();
        expect(extraction.homeMatchedUserId).toBeNull();
        await expect(readFile(ocrPath)).rejects.toMatchObject({ code: 'ENOENT' });
        // A grant issued before deletion must no longer expose hidden media.
        await request(app.getHttpServer()).get(`/api${imageUrl}`).expect(404);
        await request(app.getHttpServer()).get(`/api/arena-talk/posts/${authoredPostId}`)
          .set('Authorization', `Bearer ${observerToken}`).expect(404);
        expect(await app.get(ArenaMediaService).cleanup()).toBe(1);
        await expect(readFile(join(mediaRoot, imageKey))).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await readFile(join(mediaRoot, retainedImageKey), 'utf8')).toBe('independent retained image');
        expect(await readFile(join(mediaRoot, recentImageKey), 'utf8')).toBe('recent upload still in progress');
        // Services recheck status even if a request passed the JWT guard earlier.
        await expect(app.get(ArenaService).editPost({ sub: userId }, authoredPostId, { body: originalEmail })).rejects.toMatchObject({ status: 401 });
        const comments = await prisma.arenaComment.findMany({ where: { authorUserId: userId } });
        expect(comments).toHaveLength(1);
        expect(comments[0].body).toBe('Removed account content.');
        expect(comments[0].hiddenAt).not.toBeNull();
        expect(await prisma.arenaReaction.count({ where: { userId } })).toBe(0);
        expect(await prisma.arenaPollVote.count({ where: { userId } })).toBe(0);
        expect(await prisma.arenaLeagueSubscription.count({ where: { userId } })).toBe(0);
        expect(await prisma.playerExperiencePreferences.count({ where: { userId } })).toBe(0);
        const [
          sessions,
          devices,
          otps,
          notifications,
          memberships,
        ] =
          await Promise.all([
            prisma.refreshSession.count({
              where: {
                userId,
              },
            }),
            prisma.pushDevice.count({
              where: {
                userId,
              },
            }),
            prisma.authOtp.count({
              where: {
                userId,
              },
            }),
            prisma.notification.count({
              where: {
                userId,
              },
            }),
            prisma.leagueMember.count({
              where: {
                userId,
                leagueId,
              },
            }),
          ]);

        expect(
          sessions,
        ).toBe(
          0,
        );

        expect(
          devices,
        ).toBe(
          0,
        );

        expect(
          otps,
        ).toBe(
          0,
        );

        expect(
          notifications,
        ).toBe(
          0,
        );

        expect(
          memberships,
        ).toBe(
          1,
        );

        const logs =
          await prisma.auditLog.findMany({
            where: {
              OR: [
                {
                  action:
                    'ACCOUNT_DELETION_REQUESTED',
                },
                {
                  action:
                    'ACCOUNT_DELETION_COMPLETED',
                },
              ],
            },
            orderBy: {
              createdAt:
                'asc',
            },
          });

        const serialized =
          JSON.stringify(
            logs,
          );

        expect(
          serialized,
        ).not.toContain(
          originalEmail,
        );

        expect(
          serialized,
        ).not.toContain(
          originalInGameName,
        );

        expect(
          logs.some(
            (
              log,
            ) =>
              log.action ===
              'ACCOUNT_DELETION_COMPLETED',
          ),
        ).toBe(
          true,
        );

        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/auth/me',
          )
          .set(
            'Authorization',
            `Bearer ${accessToken}`,
          )
          .expect(
            401,
          );
      },
      30_000,
    );
  },
);
