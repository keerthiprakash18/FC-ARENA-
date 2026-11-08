import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { getUclReturnLegAccess } from '../results/ucl-ties.js';

export const FIXTURE_DAY_REMINDER = 'FixtureDayReminder';
const DAY = 86_400_000;
const IST = 330 * 60_000;
const WINDOW = 15 * 60_000;
const PENDING = ['UNSCHEDULED', 'SCHEDULED', 'LIVE'] as const;

export function indiaDay(date: Date) {
  return Math.floor((date.getTime() + IST) / DAY);
}

/** A short recovery window tolerates worker restarts without sending old slots late. */
export function fixtureReminderSlot(now: Date) {
  const day = indiaDay(now);
  const midnight = day * DAY - IST;
  for (const hour of [10, 19]) {
    const eventAt = new Date(midnight + hour * 3_600_000);
    if (
      now.getTime() >= eventAt.getTime() &&
      now.getTime() < eventAt.getTime() + WINDOW
    ) {
      const date = new Date(day * DAY).toISOString().slice(0, 10);
      return { id: `${date}:${hour}00`, eventAt };
    }
  }
  return null;
}

export function fixtureIsDue(
  fixture: {
    scheduledAt: Date | null;
    publishedAt: Date | null;
    createdAt?: Date;
    phase: string;
    matchday: number | null;
    tournament: {
      startAt: Date | null;
      fixturesPublishedAt: Date | null;
      publishedAt: Date | null;
    };
  },
  now: Date,
) {
  const today = indiaDay(now);
  if (
    fixture.tournament.startAt &&
    indiaDay(fixture.tournament.startAt) > today
  )
    return false;
  if (fixture.scheduledAt) return indiaDay(fixture.scheduledAt) <= today;
  // Playoff matchday 1/2 means leg number, not a calendar offset.
  const anchor =
    fixture.phase === 'PLAYOFF'
      ? (fixture.publishedAt ?? fixture.createdAt)
      : (fixture.tournament.startAt ??
        fixture.tournament.fixturesPublishedAt ??
        fixture.tournament.publishedAt);
  if (!anchor) return false;
  const offset =
    fixture.phase === 'STAGE' ? Math.max(0, (fixture.matchday ?? 1) - 1) : 0;
  return indiaDay(anchor) + offset <= today;
}

const select = {
  id: true,
  tournamentId: true,
  roundNumber: true,
  roundName: true,
  bracketPosition: true,
  phase: true,
  matchday: true,
  homeRegistrationId: true,
  awayRegistrationId: true,
  scheduledAt: true,
  publishedAt: true,
  createdAt: true,
  tournament: {
    select: {
      name: true,
      leagueId: true,
      startAt: true,
      fixturesPublishedAt: true,
      publishedAt: true,
    },
  },
  match: { select: { id: true } },
  homeRegistration: { select: { members: { select: { userId: true } } } },
  awayRegistration: { select: { members: { select: { userId: true } } } },
} satisfies Prisma.FixtureSelect;

@Injectable()
export class FixtureDayRemindersService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(FixtureDayRemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // This scheduler also works when phone push is unavailable; it never depends on app visits.
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.FIXTURE_DAY_REMINDERS_ENABLED === 'false'
    )
      return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async pending(
    tx: Prisma.TransactionClient,
    now: Date,
    userId?: string,
  ) {
    const endOfToday = new Date((indiaDay(now) + 1) * DAY - IST);
    const fixtures = await tx.fixture.findMany({
      where: {
        status: { in: [...PENDING] },
        // Older playoff generation publishes through the tournament, leaving this field null.
        OR: [
          { publishedAt: { lte: now } },
          { phase: 'PLAYOFF', publishedAt: null, createdAt: { lte: now } },
        ],
        tournament: {
          status: 'ACTIVE',
          publishedAt: { lte: now },
          fixturesPublishedAt: { lte: now },
        },
        homeRegistration: { status: 'APPROVED' },
        awayRegistration: { status: 'APPROVED' },
        match: {
          status: { in: [...PENDING] },
          confirmedResultSubmissionId: null,
          resultSubmissions: {
            none: { status: { in: ['PENDING_VERIFICATION', 'CONFIRMED'] } },
          },
        },
        AND: [
          { OR: [{ scheduledAt: null }, { scheduledAt: { lt: endOfToday } }] },
          ...(userId
            ? [
                {
                  OR: [
                    { homeRegistration: { members: { some: { userId } } } },
                    { awayRegistration: { members: { some: { userId } } } },
                  ],
                },
              ]
            : []),
        ],
      },
      select,
      orderBy: { id: 'asc' },
    });
    const ready: typeof fixtures = [];
    for (const fixture of fixtures) {
      if (!fixtureIsDue(fixture, now)) continue;
      const access = await getUclReturnLegAccess(tx, fixture);
      if (!access || access.canUpload) ready.push(fixture);
    }
    return ready;
  }

  private async recipients(
    tx: Prisma.TransactionClient,
    now: Date,
    userId?: string,
  ) {
    const fixtures = await this.pending(tx, now, userId);
    const ids = [
      ...new Set(
        fixtures.flatMap((f) =>
          [...f.homeRegistration!.members, ...f.awayRegistration!.members].map(
            (m) => m.userId,
          ),
        ),
      ),
    ];
    const users = ids.length
      ? await tx.user.findMany({
          where: {
            id: { in: userId ? ids.filter((id) => id === userId) : ids },
            status: 'ACTIVE',
          },
          select: {
            id: true,
            notificationPreferences: true,
            leagueMemberships: { select: { leagueId: true } },
          },
          orderBy: { id: 'asc' },
        })
      : [];
    return users.flatMap((user) => {
      const prefs = user.notificationPreferences;
      if (
        prefs &&
        typeof prefs === 'object' &&
        !Array.isArray(prefs) &&
        prefs.matchReminders === false
      )
        return [];
      const mine = fixtures.filter(
        (f) =>
          user.leagueMemberships.some(
            (m) => m.leagueId === f.tournament.leagueId,
          ) &&
          [...f.homeRegistration!.members, ...f.awayRegistration!.members].some(
            (m) => m.userId === user.id,
          ),
      );
      return mine.length ? [{ userId: user.id, fixtures: mine }] : [];
    });
  }

  /** Revalidate queued push against current results, roster, membership and opt-out. */
  async canDeliver(
    userId: string,
    entityId: string | null,
    href: string | null,
    now = new Date(),
  ) {
    const slot = fixtureReminderSlot(now);
    if (!slot || slot.id !== entityId) return false;
    const recipients = await this.recipients(this.prisma, now, userId);
    return recipients.some(
      (recipient) =>
        href === '/fixtures' ||
        recipient.fixtures.some((f) => href === `/matches/${f.match!.id}`),
    );
  }

  async tick(now = new Date()) {
    const slot = fixtureReminderSlot(now);
    if (this.running || !slot) return 0;
    this.running = true;
    try {
      const count = await this.prisma.$transactionWithRetry(
        async (tx) => {
          const recipients = await this.recipients(tx, now);
          if (!recipients.length) return 0;
          const result = await tx.notification.createMany({
            skipDuplicates: true,
            data: recipients.map(({ userId, fixtures }) => {
              const fixture = fixtures[0];
              const label =
                fixture.phase === 'STAGE' && fixture.matchday
                  ? `Day ${fixture.matchday} · `
                  : '';
              return {
                userId,
                type: 'MATCH_REMINDER',
                title: 'Complete your pending fixtures',
                message:
                  fixtures.length === 1
                    ? `${label}${fixture.tournament.name}: your match is still pending. Please play and submit the result.`
                    : 'You still have unfinished fixtures due today or earlier. Please play and submit your results.',
                href:
                  fixtures.length === 1
                    ? `/matches/${fixture.match!.id}`
                    : '/fixtures',
                entityType: FIXTURE_DAY_REMINDER,
                entityId: slot.id,
                dedupeKey: `${userId}:fixture-day-reminder:v1:${slot.id}`,
                eventAt: slot.eventAt,
              };
            }),
          });
          return result.count;
        },
        { isolationLevel: 'Serializable', timeout: 20_000 },
      );
      if (count)
        this.logger.log(
          `Created ${count} fixture reminders for ${slot.id} IST.`,
        );
      return count;
    } catch {
      this.logger.warn(
        'Fixture reminder scan failed; the next cycle will retry.',
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
