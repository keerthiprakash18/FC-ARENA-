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
          )
        ) {
          throw new Error(
            'Account deletion E2E requires an isolated local test database.',
          );
        }

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

        await app.close();
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
      'deletes personal runtime data, anonymizes identity and keeps competition history',
      async () => {
        const response =
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
              password,
              confirmation:
                'DELETE',
            })
            .expect(
              200,
            );

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
