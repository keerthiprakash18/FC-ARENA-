import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthRateLimitService } from '../src/auth/auth-rate-limit.service.js';

describe('PostgreSQL atomic rate limiting', () => {
  let prisma: PrismaService;
  let limiter: AuthRateLimitService;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Rate-limit integration tests require a local test database.');
    }
    prisma = new PrismaService();
    await prisma.$connect();
    limiter = new AuthRateLimitService(prisma);
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('admits exactly five of twenty simultaneous attempts', async () => {
    const key = `security-test-${randomUUID()}`;
    try {
      const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => limiter.consume('LOGIN_IP', key, 5, 60_000)));
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(5);
      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(rejected).toHaveLength(15);
      for (const outcome of rejected) expect(outcome.reason).toMatchObject({ status: 429 });
    } finally {
      await limiter.clear('LOGIN_IP', key);
    }
  });

  it('normalizes identifiers and admits a request after window expiry', async () => {
    const key = `Security-Test-${randomUUID()}`;
    try {
      await limiter.consume('LOGIN_IDENTIFIER', key, 1, 60_000);
      await expect(limiter.consume('LOGIN_IDENTIFIER', ` ${key.toLowerCase()} `, 1, 60_000)).rejects.toMatchObject({ status: 429 });
      const keyHash = createHash('sha256').update(key.toLowerCase()).digest('hex');
      await prisma.$executeRaw`UPDATE "auth_rate_limits" SET "windowStartedAt" = '2000-01-01'::timestamp WHERE "action" = 'LOGIN_IDENTIFIER' AND "keyHash" = ${keyHash}`;
      await expect(limiter.consume('LOGIN_IDENTIFIER', key, 1, 60_000)).resolves.toBeUndefined();
    } finally {
      await limiter.clear('LOGIN_IDENTIFIER', key);
    }
  });
});
