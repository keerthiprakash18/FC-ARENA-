import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/database/prisma.module.js';
import { SecurityModule } from '../src/security/security.module.js';
import { NotificationsModule } from '../src/notifications/notifications.module.js';
import {
  FixtureDayRemindersService,
  FIXTURE_DAY_REMINDER,
} from '../src/notifications/fixture-day-reminders.service.js';

describe('Fixture day reminders with real PostgreSQL', () => {
  let module: TestingModule;
  let db: PrismaService,
    service: FixtureDayRemindersService,
    leagueId: string,
    tournamentId: string;
  let registrations: string[];
  const run = randomUUID().slice(0, 8),
    users = [randomUUID(), randomUUID(), randomUUID()];
  const morning = new Date('2026-11-07T04:30:00Z'),
    evening = new Date('2026-11-07T13:30:00Z');
  const publishedAt = new Date('2026-11-07T02:00:00Z');
  let sequence = 0;
  const inbox = () =>
    db.notification.findMany({
      where: { userId: { in: users }, entityType: FIXTURE_DAY_REMINDER },
      orderBy: { dedupeKey: 'asc' },
    });
  async function fixture(overrides: Record<string, unknown> = {}) {
    return db.fixture.create({
      data: {
        tournamentId,
        fixtureCode: `RM-${run}-${++sequence}`,
        sequence,
        matchday: 1,
        roundNumber: 1,
        roundName: 'Day 1',
        bracketPosition: sequence,
        publishedAt,
        homeRegistrationId: registrations[0],
        awayRegistrationId: registrations[1],
        match: { create: { tournamentId } },
        ...overrides,
      } as any,
      include: { match: true },
    });
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      process.env.NODE_ENV !== 'test' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    ) {
      throw new Error('Requires a disposable loopback *_test database.');
    }
    process.env.PUSH_ENABLED = 'false';
    module = await Test.createTestingModule({
      imports: [PrismaModule, SecurityModule, NotificationsModule],
    }).compile();
    await module.init();
    db = module.get(PrismaService);
    service = module.get(FixtureDayRemindersService);
    await db.user.createMany({
      data: users.map((id, index) => ({
        id,
        email: `reminder-${run}-${index}@example.invalid`,
        fullName: `Reminder ${index}`,
        passwordHash: 'not-a-login-hash',
        status: 'ACTIVE',
      })),
    });
    leagueId = (
      await db.league.create({
        data: {
          name: 'Reminder test league',
          code: `RM${run}`,
          creatorUserId: users[0],
        },
      })
    ).id;
    await db.leagueMember.createMany({
      data: users.map((userId) => ({ leagueId, userId, type: 'PRIMARY' })),
    });
  });
  beforeEach(async () => {
    await db.tournament.updateMany({
      where: { leagueId },
      data: { status: 'CANCELLED' },
    });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.user.updateMany({
      where: { id: { in: users } },
      data: { status: 'ACTIVE', notificationPreferences: {} },
    });
    await db.leagueMember.createMany({
      data: users.map((userId) => ({ leagueId, userId, type: 'PRIMARY' })),
      skipDuplicates: true,
    });
    tournamentId = (
      await db.tournament.create({
        data: {
          leagueId,
          createdByUserId: users[0],
          name: 'Day reminder cup',
          code: `RM${randomUUID().slice(0, 12)}`,
          mode: 'SOLO',
          format: 'ROUND_ROBIN',
          teamSize: 1,
          maxEntries: 3,
          status: 'ACTIVE',
          startAt: morning,
          publishedAt,
          fixturesPublishedAt: publishedAt,
        },
      })
    ).id;
    registrations = [];
    for (const userId of users)
      registrations.push(
        (
          await db.tournamentRegistration.create({
            data: {
              tournamentId,
              registeredByUserId: userId,
              status: 'APPROVED',
              members: { create: { tournamentId, userId } },
            },
          })
        ).id,
      );
  });
  afterAll(async () => {
    await module?.close();
  });

  it('creates exactly two daily slots, groups multiple matches and survives concurrent worker scans', async () => {
    await fixture();
    await fixture();
    await Promise.all([
      service.tick(morning),
      new FixtureDayRemindersService(db).tick(morning),
    ]);
    let rows = await inbox();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.userId).sort()).toEqual(
      users.slice(0, 2).sort(),
    );
    expect(rows.every((row) => row.href === '/fixtures')).toBe(true);
    await db.notification.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { readAt: morning },
    });
    await new FixtureDayRemindersService(db).tick(
      new Date('2026-11-07T04:35:00Z'),
    );
    expect(
      (await inbox()).every(
        (row) => row.readAt?.getTime() === morning.getTime(),
      ),
    ).toBe(true);
    await service.tick(evening);
    rows = await inbox();
    expect(rows).toHaveLength(4);
    await service.tick(new Date('2026-11-07T13:46:00Z'));
    expect(await inbox()).toHaveLength(4);
  });
  it('stops for both players as soon as either submits, including before admin verification', async () => {
    const f = await fixture();
    await service.tick(morning);
    expect(await inbox()).toHaveLength(2);
    await db.resultSubmission.create({
      data: {
        matchId: f.match!.id,
        submittedByUserId: users[0],
        homeScore: 1,
        awayScore: 0,
      },
    });
    await service.tick(evening);
    expect(await inbox()).toHaveLength(2);
    expect(
      await service.canDeliver(
        users[0],
        '2026-11-07:1000',
        `/matches/${f.match!.id}`,
        morning,
      ),
    ).toBe(false);
  });
  it('reminds rejected results again but excludes cancelled, postponed, unresolved and completed fixtures', async () => {
    const f = await fixture();
    await db.resultSubmission.create({
      data: {
        matchId: f.match!.id,
        submittedByUserId: users[0],
        homeScore: 1,
        awayScore: 0,
        status: 'REJECTED',
      },
    });
    await fixture({ status: 'CANCELLED' });
    await fixture({ status: 'POSTPONED' });
    await fixture({ homeRegistrationId: null });
    await fixture({ status: 'COMPLETED' });
    await service.tick(morning);
    expect(await inbox()).toHaveLength(2);
    expect(
      (await inbox()).every((row) => row.href === `/matches/${f.match!.id}`),
    ).toBe(true);
  });
  it('uses publication as Day 1 without match times, excludes future Day 2 and includes overdue days', async () => {
    await db.tournament.update({
      where: { id: tournamentId },
      data: { startAt: null },
    });
    const first = await fixture();
    await fixture({ matchday: 2 });
    await fixture({ scheduledAt: new Date('2026-11-07T18:30:00Z') });
    await service.tick(morning);
    expect(
      (await inbox()).every(
        (row) => row.href === `/matches/${first.match!.id}`,
      ),
    ).toBe(true);
    await service.tick(new Date('2026-11-08T04:30:00Z'));
    expect(await inbox()).toHaveLength(4);
    expect(
      (await inbox())
        .filter((row) => row.entityId === '2026-11-08:1000')
        .every((row) => row.href === '/fixtures'),
    ).toBe(true);
  });
  it('honors opt-out, removed league membership, inactive accounts and withdrawn entries', async () => {
    await fixture();
    await db.user.update({
      where: { id: users[0] },
      data: { notificationPreferences: { matchReminders: false } },
    });
    await db.leagueMember.deleteMany({ where: { leagueId, userId: users[1] } });
    await service.tick(morning);
    expect(await inbox()).toHaveLength(0);
    await db.user.update({
      where: { id: users[0] },
      data: { notificationPreferences: {}, status: 'DISABLED' },
    });
    await service.tick(evening);
    expect(await inbox()).toHaveLength(0);
    await db.user.update({
      where: { id: users[0] },
      data: { status: 'ACTIVE' },
    });
    await db.tournamentRegistration.update({
      where: { id: registrations[0] },
      data: { status: 'WITHDRAWN' },
    });
    await service.tick(evening);
    expect(await inbox()).toHaveLength(0);
  });
  it('does not remind unpublished or cancelled competitions and suppresses stale queued links', async () => {
    const f = await fixture();
    expect(
      await service.canDeliver(
        users[0],
        '2026-11-07:1000',
        `/matches/${f.match!.id}`,
        morning,
      ),
    ).toBe(true);
    await db.tournament.update({
      where: { id: tournamentId },
      data: { fixturesPublishedAt: null },
    });
    await service.tick(morning);
    expect(await inbox()).toHaveLength(0);
    await db.tournament.update({
      where: { id: tournamentId },
      data: { fixturesPublishedAt: publishedAt, status: 'CANCELLED' },
    });
    expect(
      await service.canDeliver(
        users[0],
        '2026-11-07:1000',
        `/matches/${f.match!.id}`,
        morning,
      ),
    ).toBe(false);
    await service.tick(evening);
    expect(await inbox()).toHaveLength(0);
  });

  it('supports published legacy playoffs without fixture timestamps while keeping the return leg locked until verified', async () => {
    const first = await fixture({
      phase: 'PLAYOFF',
      roundName: 'UCL Semi-final',
      publishedAt: null,
      createdAt: publishedAt,
    });
    const second = await fixture({
      phase: 'PLAYOFF',
      roundName: 'UCL Semi-final',
      matchday: 2,
      bracketPosition: first.bracketPosition,
      homeRegistrationId: registrations[1],
      awayRegistrationId: registrations[0],
      publishedAt: null,
      createdAt: publishedAt,
    });
    await service.tick(morning);
    expect(await inbox()).toHaveLength(2);
    expect(
      (await inbox()).every(
        (row) => row.href === `/matches/${first.match!.id}`,
      ),
    ).toBe(true);
    const result = await db.resultSubmission.create({
      data: {
        matchId: first.match!.id,
        submittedByUserId: users[0],
        homeScore: 1,
        awayScore: 0,
      },
    });
    expect(
      await service.canDeliver(
        users[0],
        '2026-11-07:1000',
        '/fixtures',
        morning,
      ),
    ).toBe(false);
    await db.resultSubmission.update({
      where: { id: result.id },
      data: { status: 'CONFIRMED' },
    });
    await db.match.update({
      where: { id: first.match!.id },
      data: { status: 'COMPLETED', confirmedResultSubmissionId: result.id },
    });
    await db.fixture.update({
      where: { id: first.id },
      data: { status: 'COMPLETED' },
    });
    await service.tick(evening);
    const followups = (await inbox()).filter(
      (row) => row.entityId === '2026-11-07:1900',
    );
    expect(followups).toHaveLength(2);
    expect(
      followups.every((row) => row.href === `/matches/${second.match!.id}`),
    ).toBe(true);
  });
});
