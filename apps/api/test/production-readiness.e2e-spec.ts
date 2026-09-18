import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';

import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import request from 'supertest';

import {
  AppModule,
} from '../src/app.module.js';

import {
  PrismaService,
} from '../src/database/prisma.service.js';

describe(
  'FC ARENA production readiness E2E',
  () => {
    let app:
      INestApplication;

    let moduleRef:
      TestingModule;

    let prisma:
      PrismaService;

    beforeAll(
      async () => {
        moduleRef =
          await Test.createTestingModule({
            imports: [
              AppModule,
            ],
          }).compile();

        app =
          moduleRef.createNestApplication();

        app.setGlobalPrefix(
          'api',
        );

        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted:
              true,
          }),
        );

        await app.init();

        prisma =
          app.get(
            PrismaService,
          );

        await prisma.$connect();
      },
      30_000,
    );

    afterAll(
      async () => {
        await prisma.$disconnect();

        await app.close();
      },
      30_000,
    );

    it(
      'boots the real Nest application',
      () => {
        expect(
          app,
        ).toBeDefined();

        expect(
          moduleRef,
        ).toBeDefined();
      },
    );

    it(
      'responds from the health endpoint',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .get(
              '/api/health',
            )
            .expect(
              200,
            );

        expect(
          response.body,
        ).toBeDefined();
      },
    );

    it(
      'rejects anonymous access to protected notifications',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/notifications',
          )
          .expect(
            401,
          );
      },
    );

    it(
      'connects to the real PostgreSQL database',
      async () => {
        const result =
          await prisma.$queryRaw<
            Array<{
              value: number;
            }>
          >`
            SELECT 1 AS value
          `;

        expect(
          Number(
            result[0]?.value,
          ),
        ).toBe(
          1,
        );
      },
    );

    it(
      'can read core account and league tables',
      async () => {
        const [
          users,
          players,
          leagues,
          memberships,
          applications,
        ] =
          await Promise.all([
            prisma.user.count(),
            prisma.player.count(),
            prisma.league.count(),
            prisma.leagueMember.count(),
            prisma.leagueApplication.count(),
          ]);

        for (
          const count
          of [
            users,
            players,
            leagues,
            memberships,
            applications,
          ]
        ) {
          expect(
            count,
          ).toBeGreaterThanOrEqual(
            0,
          );
        }
      },
    );

    it(
      'can read tournament lifecycle tables',
      async () => {
        const [
          tournaments,
          registrations,
          registrationMembers,
          fixtures,
          matches,
        ] =
          await Promise.all([
            prisma.tournament.count(),

            prisma.tournamentRegistration.count(),

            prisma.tournamentRegistrationMember.count(),

            prisma.fixture.count(),

            prisma.match.count(),
          ]);

        for (
          const count
          of [
            tournaments,
            registrations,
            registrationMembers,
            fixtures,
            matches,
          ]
        ) {
          expect(
            count,
          ).toBeGreaterThanOrEqual(
            0,
          );
        }
      },
    );

    it(
      'can read result and statistics tables',
      async () => {
        const [
          submissions,
          standings,
          playerStatistics,
          statEvents,
        ] =
          await Promise.all([
            prisma.resultSubmission.count(),

            prisma.tournamentStanding.count(),

            prisma.playerTournamentStatistic.count(),

            prisma.matchResultStatEvent.count(),
          ]);

        for (
          const count
          of [
            submissions,
            standings,
            playerStatistics,
            statEvents,
          ]
        ) {
          expect(
            count,
          ).toBeGreaterThanOrEqual(
            0,
          );
        }
      },
    );

    it(
      'can read OCR persistence',
      async () => {
        const count =
          await prisma.ocrExtraction.count();

        expect(
          count,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );

    it(
      'can read achievements and notifications',
      async () => {
        const [
          achievements,
          notifications,
        ] =
          await Promise.all([
            prisma.achievement.count(),

            prisma.notification.count(),
          ]);

        expect(
          achievements,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          notifications,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );

    it(
      'can read RBAC and audit tables',
      async () => {
        const [
          roleAssignments,
          auditLogs,
        ] =
          await Promise.all([
            prisma.roleAssignment.count(),

            prisma.auditLog.count(),
          ]);

        expect(
          roleAssignments,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          auditLogs,
        ).toBeGreaterThanOrEqual(
          0,
        );
      },
    );
  },
);