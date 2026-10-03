import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../apps/api/dist/app.module.js';
import { PrismaService } from '../apps/api/dist/database/prisma.service.js';
import { resolvePlan, runLoadTest } from './load-test.mjs';

const profiles = ['baseline', '50', '100', '250', '500'];

function assertIsolatedEnvironment() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Step 10 acceptance requires NODE_ENV=test.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const hostname = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
    throw new Error(
      'Step 10 acceptance refuses a non-loopback database. Use isolated CI/local PostgreSQL only.',
    );
  }
}

async function seed(prisma) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const user = await prisma.user.create({
    data: {
      fullName: 'Load Acceptance Player',
      email: `load-${suffix}@example.test`,
      passwordHash: 'not-used-by-load-acceptance',
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const player = await prisma.player.create({
    data: {
      userId: user.id,
      playerCode: `LOAD${suffix.slice(0, 8).toUpperCase()}`,
    },
  });

  await prisma.playerIdentity.create({
    data: {
      playerId: player.id,
      inGameName: `Load${suffix.slice(0, 6)}`,
      inGameNameNormalized: `load${suffix.slice(0, 6)}`,
      gameUid: `load-uid-${suffix}`,
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  const league = await prisma.league.create({
    data: {
      name: 'Step 10 Isolated Load League',
      code: `L${suffix.slice(0, 10).toUpperCase()}`,
      creatorUserId: user.id,
      maxMembers: 100,
    },
  });

  await prisma.leagueMember.create({
    data: {
      leagueId: league.id,
      userId: user.id,
      type: 'PRIMARY',
    },
  });

  const tournament = await prisma.tournament.create({
    data: {
      leagueId: league.id,
      createdByUserId: user.id,
      name: 'Step 10 Isolated Load Tournament',
      code: `T${suffix.slice(0, 10).toUpperCase()}`,
      mode: 'SOLO',
      format: 'ROUND_ROBIN',
      competitionFormat: 'LEAGUE_ROUND_ROBIN',
      groupMode: 'SINGLE_GROUP',
      legType: 'SINGLE_LEG',
      fixtureMode: 'AUTOMATIC',
      visibility: 'LEAGUE',
      registrationMode: 'APPROVAL',
      status: 'ACTIVE',
      teamSize: 1,
      maxEntries: 20,
    },
  });

  return { user, league, tournament };
}

async function main() {
  assertIsolatedEnvironment();

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  let seeded;

  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not resolve isolated API port.');
    }

    seeded = await seed(prisma);
    const token = await jwt.signAsync(
      {
        sub: seeded.user.id,
        email: seeded.user.email,
        role: seeded.user.role,
        type: 'access',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: '15m',
      },
    );

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const results = [];

    for (const profile of profiles) {
      // The database is disposable and isolated. Reset only test rate-limit
      // buckets so each profile measures its own policy window.
      await prisma.authRateLimit.deleteMany();

      const plan = resolvePlan({
        LOAD_TEST_BASE_URL: baseUrl,
        LOAD_TEST_PROFILE: profile,
        LOAD_TEST_ACCESS_TOKEN: token,
        LOAD_TEST_LEAGUE_ID: seeded.league.id,
        LOAD_TEST_TOURNAMENT_ID: seeded.tournament.id,
        LOAD_TEST_TIMEOUT_MS: '5000',
        LOAD_TEST_P95_LIMIT_MS: '1500',
        LOAD_TEST_MAX_ERROR_RATE: '0.01',
      });

      const result = await runLoadTest(plan);
      results.push(result);

      console.log(
        `STEP10_PROFILE profile=${profile} vus=${plan.vus} rps=${result.overall.requestsPerSecond} requests=${result.overall.requests} errors=${result.overall.errors} p50=${result.overall.p50Ms} p95=${result.overall.p95Ms} p99=${result.overall.p99Ms} pass=${result.thresholds.pass}`,
      );

      if (!result.thresholds.pass) {
        throw new Error(`Step 10 acceptance failed for profile ${profile}.`);
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      environment: 'isolated GitHub Actions/local acceptance',
      database: 'isolated loopback PostgreSQL',
      redis: 'isolated loopback Redis',
      productionTrafficGenerated: false,
      writeTrafficDuringLoad: false,
      profiles: results,
      pass: results.every((result) => result.thresholds.pass),
    };

    const output =
      process.env.LOAD_ACCEPTANCE_OUTPUT ??
      '/tmp/fcarena-step10-load-acceptance.json';
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });

    console.log(`STEP10_ACCEPTANCE_OK output=${output}`);
  } finally {
    if (seeded?.league?.id) {
      await prisma.league.deleteMany({ where: { id: seeded.league.id } });
    }
    if (seeded?.user?.id) {
      await prisma.user.deleteMany({ where: { id: seeded.user.id } });
    }
    await prisma.authRateLimit.deleteMany();
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
