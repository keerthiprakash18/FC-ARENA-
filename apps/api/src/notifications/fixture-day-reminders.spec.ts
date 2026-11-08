import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FixtureDayRemindersService,
  fixtureIsDue,
  fixtureReminderSlot,
} from './fixture-day-reminders.service.js';

const morning = new Date('2026-11-07T04:30:00Z');
const fixture = (overrides: object = {}) => ({
  id: 'f1',
  tournamentId: 't1',
  phase: 'STAGE',
  matchday: 1,
  roundNumber: 1,
  roundName: 'Day 1',
  bracketPosition: 1,
  scheduledAt: null,
  publishedAt: new Date('2026-11-07T02:00:00Z'),
  homeRegistrationId: 'r1',
  awayRegistrationId: 'r2',
  tournament: {
    name: 'Cup',
    leagueId: 'l1',
    startAt: morning,
    fixturesPublishedAt: morning,
    publishedAt: morning,
  },
  homeRegistration: { members: [{ userId: 'u1' }] },
  awayRegistration: { members: [{ userId: 'u2' }] },
  match: { id: 'm1' },
  ...overrides,
});
function setup(fixtures = [fixture()]) {
  const rows = new Map<string, any>();
  const prisma: any = {
    fixture: { findMany: vi.fn().mockResolvedValue(fixtures) },
    user: {
      findMany: vi.fn().mockResolvedValue(
        ['u1', 'u2'].map((id) => ({
          id,
          notificationPreferences: null,
          leagueMemberships: [{ leagueId: 'l1' }],
        })),
      ),
    },
    notification: {
      createMany: vi.fn().mockImplementation(({ data }) => {
        let count = 0;
        for (const row of data)
          if (!rows.has(row.dedupeKey)) {
            rows.set(row.dedupeKey, row);
            count++;
          }
        return { count };
      }),
    },
  };
  prisma.$transactionWithRetry = vi.fn((work) => work(prisma));
  return { service: new FixtureDayRemindersService(prisma), prisma, rows };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('India fixture reminder clock', () => {
  it.each([
    ['2026-11-07T04:29:59.999Z', null],
    ['2026-11-07T04:30:00Z', '2026-11-07:1000'],
    ['2026-11-07T04:44:59.999Z', '2026-11-07:1000'],
    ['2026-11-07T04:45:00Z', null],
    ['2026-11-07T13:29:59.999Z', null],
    ['2026-11-07T13:30:00Z', '2026-11-07:1900'],
    ['2026-11-07T13:44:59.999Z', '2026-11-07:1900'],
    ['2026-11-07T13:45:00Z', null],
    ['2026-11-07T18:30:00Z', null],
  ])('uses IST regardless of server timezone at %s', (time, id) => {
    expect(fixtureReminderSlot(new Date(time))?.id ?? null).toBe(id);
  });
  it('keeps Day 2 in the future while including overdue Day 1 without a match time', () => {
    expect(fixtureIsDue(fixture({ matchday: 2 }), morning)).toBe(false);
    expect(fixtureIsDue(fixture(), new Date('2026-11-08T04:30:00Z'))).toBe(
      true,
    );
  });
  it('uses the actual fixture date in India before the fallback calendar', () => {
    expect(
      fixtureIsDue(
        fixture({ scheduledAt: new Date('2026-11-07T18:30:00Z') }),
        morning,
      ),
    ).toBe(false);
    expect(
      fixtureIsDue(
        fixture({ matchday: 8, scheduledAt: new Date('2026-11-06T18:30:00Z') }),
        morning,
      ),
    ).toBe(true);
  });
  it('falls back to publication and treats playoff leg numbers separately', () => {
    const tournament = {
      startAt: null,
      fixturesPublishedAt: new Date('2026-11-06T18:30:00Z'),
      publishedAt: morning,
    };
    expect(fixtureIsDue(fixture({ tournament }), morning)).toBe(true);
    expect(fixtureIsDue(fixture({ tournament, matchday: 2 }), morning)).toBe(
      false,
    );
    expect(
      fixtureIsDue(
        fixture({ tournament, phase: 'PLAYOFF', matchday: 2 }),
        morning,
      ),
    ).toBe(true);
    expect(
      fixtureIsDue(
        fixture({ tournament: { startAt: new Date('2026-11-08T00:00:00Z') } }),
        morning,
      ),
    ).toBe(false);
  });
});

describe('Automatic fixture day reminders', () => {
  it('groups matches into one per player and preserves read state on repeated scans and restarts', async () => {
    const { service, prisma, rows } = setup([
      fixture(),
      fixture({ id: 'f2', match: { id: 'm2' } }),
    ]);
    expect(await service.tick(morning)).toBe(2);
    for (const row of rows.values()) row.readAt = morning;
    expect(
      await new FixtureDayRemindersService(prisma).tick(
        new Date('2026-11-07T04:35:00Z'),
      ),
    ).toBe(0);
    expect(
      [...rows.values()].every(
        (row) => row.readAt === morning && row.href === '/fixtures',
      ),
    ).toBe(true);
    expect(await service.tick(new Date('2026-11-07T13:30:00Z'))).toBe(2);
    expect(rows.size).toBe(4);
  });
  it('does no database work between slots', async () => {
    const { service, prisma } = setup();
    expect(await service.tick(new Date('2026-11-07T08:00:00Z'))).toBe(0);
    expect(prisma.$transactionWithRetry).not.toHaveBeenCalled();
  });
  it('respects per-player opt-out and current league membership', async () => {
    const { service, prisma, rows } = setup();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        notificationPreferences: { matchReminders: false },
        leagueMemberships: [{ leagueId: 'l1' }],
      },
      { id: 'u2', notificationPreferences: null, leagueMemberships: [] },
    ]);
    expect(await service.tick(morning)).toBe(0);
    expect(rows.size).toBe(0);
  });
  it('requires verified first legs before reminding return-leg participants', async () => {
    const { service, prisma } = setup([
      fixture({ phase: 'PLAYOFF', roundName: 'UCL Semi-final', matchday: 2 }),
    ]);
    prisma.fixture.findFirst = vi.fn().mockResolvedValue({
      status: 'COMPLETED',
      homeRegistrationId: 'r2',
      awayRegistrationId: 'r1',
      match: {
        status: 'COMPLETED',
        confirmedResult: { status: 'PENDING_VERIFICATION' },
      },
    });
    expect(await service.tick(morning)).toBe(0);
    prisma.fixture.findFirst.mockResolvedValue({
      status: 'COMPLETED',
      homeRegistrationId: 'r2',
      awayRegistrationId: 'r1',
      match: {
        status: 'COMPLETED',
        confirmedResult: { status: 'CONFIRMED', homeScore: 1, awayScore: 0 },
      },
    });
    expect(await service.tick(morning)).toBe(2);
  });
  it('discards queued pushes after completion, opt-out, expiry or a stale direct match link', async () => {
    const { service, prisma } = setup();
    expect(
      await service.canDeliver('u1', '2026-11-07:1000', '/matches/m1', morning),
    ).toBe(true);
    expect(
      await service.canDeliver(
        'u1',
        '2026-11-07:1000',
        '/matches/completed',
        morning,
      ),
    ).toBe(false);
    expect(
      await service.canDeliver('u1', '2026-11-06:1000', '/fixtures', morning),
    ).toBe(false);
    expect(
      await service.canDeliver(
        'u1',
        '2026-11-07:1000',
        '/fixtures',
        new Date('2026-11-07T04:45:00Z'),
      ),
    ).toBe(false);
    prisma.fixture.findMany.mockResolvedValue([]);
    expect(
      await service.canDeliver('u1', '2026-11-07:1000', '/fixtures', morning),
    ).toBe(false);
  });
  it('runs without push credentials or app visits and stops its timer during shutdown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(morning);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PUSH_ENABLED', 'false');
    vi.stubEnv('FIXTURE_DAY_REMINDERS_ENABLED', 'true');
    const { service } = setup();
    const tick = vi.spyOn(service, 'tick').mockResolvedValue(0);
    service.onModuleInit();
    expect(tick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
  it('retries a failed scan on the next cycle without poisoning the running flag', async () => {
    const { service, prisma } = setup();
    prisma.$transactionWithRetry.mockRejectedValueOnce(
      new Error('temporary database failure'),
    );
    expect(await service.tick(morning)).toBe(0);
    expect(await service.tick(morning)).toBe(2);
  });
});
