import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class RegistrationNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(RegistrationNotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.REGISTRATION_NOTIFICATIONS_ENABLED === 'false'
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

  async notify(
    registrationId: string,
    reviewedMemberIds: readonly string[] = [],
  ) {
    const entry = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        members: { select: { userId: true } },
        tournament: {
          select: {
            id: true,
            leagueId: true,
            name: true,
            createdByUserId: true,
            status: true,
          },
        },
      },
    });
    if (
      !entry ||
      !['PENDING', 'APPROVED', 'REJECTED'].includes(entry.status) ||
      ['COMPLETED', 'CANCELLED'].includes(entry.tournament.status)
    )
      return;
    const cup = entry.tournament;
    const [leagueOwners, admins, legacy] = await Promise.all([
      this.prisma.leagueAdmin.findMany({
        where: { leagueId: cup.leagueId, OR: [{ role: 'OWNER' }, { permissions: { has: 'MANAGE_TOURNAMENTS' } }] },
        select: { userId: true },
      }),
      this.prisma.tournamentAdmin.findMany({
        where: {
          tournamentId: cup.id,
          OR: [
            { role: 'OWNER' },
            { permissions: { has: 'MANAGE_PARTICIPANTS' } },
          ],
        },
        select: { userId: true },
      }),
      this.prisma.roleAssignment.findMany({
        where: {
          role: 'TOURNAMENT_ADMIN',
          OR: [
            { scopeType: 'LEAGUE', scopeId: cup.leagueId },
            { scopeType: 'TOURNAMENT', scopeId: cup.id },
          ],
        },
        select: { userId: true },
      }),
    ]);
    const managers = new Set([
      cup.createdByUserId,
      ...leagueOwners.map((x) => x.userId),
      ...admins.map((x) => x.userId),
      ...legacy.map((x) => x.userId),
    ]);
    // Rejected rosters are removed to release the per-tournament player slots.
    // The review transaction passes the original roster so every teammate gets the decision.
    const participants = new Set([
      entry.registeredByUserId,
      ...entry.members.map((x) => x.userId),
      ...(entry.status === 'REJECTED' ? [...entry.notificationMemberIds, ...reviewedMemberIds] : []),
    ]);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [...new Set([...managers, ...participants])] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    for (const user of users) {
      if (managers.has(user.id) && entry.status !== 'REJECTED')
        await this.notifications.createForUser(user.id, {
          type: 'TOURNAMENT_REGISTRATION_RECEIVED',
          title: 'New Tournament Registration',
          message: `${entry.entryName || 'A player entry'} registered for ${cup.name}${entry.status === 'PENDING' ? ' and is awaiting approval' : ''}.`,
          href: `/tournaments/${cup.id}/registration`,
          entityType: 'TournamentRegistration',
          entityId: entry.id,
          dedupeKey: `tournament-registration-received:${entry.id}`,
          eventAt: entry.createdAt,
        });
      if (participants.has(user.id))
        await this.notifications.createForUser(user.id, {
          type:
            entry.status === 'PENDING'
              ? 'TOURNAMENT_APPLICATION_SUBMITTED'
              : entry.status === 'APPROVED'
                ? 'TOURNAMENT_APPLICATION_APPROVED'
                : 'TOURNAMENT_APPLICATION_REJECTED',
          title:
            entry.status === 'PENDING'
              ? 'Registration Submitted'
              : entry.status === 'APPROVED'
                ? 'Tournament Entry Approved'
                : 'Tournament Entry Rejected',
          message:
            entry.status === 'PENDING'
              ? `Your entry for ${cup.name} is waiting for admin approval.`
              : entry.status === 'APPROVED'
                ? `Your entry for ${cup.name} has been approved.`
                : `Your entry for ${cup.name} was rejected.`,
          href: `/tournaments/${cup.id}/registration`,
          entityType: 'TournamentRegistration',
          entityId: entry.id,
          dedupeKey: `tournament-registration:${entry.id}:${entry.status}`,
          eventAt: entry.reviewedAt ?? entry.updatedAt,
        });
    }
    if (entry.status !== 'PENDING')
      await this.prisma.notification.updateMany({
        where: {
          entityType: 'TournamentRegistration',
          entityId: entry.id,
          readAt: null,
          type: {
            in:
              entry.status === 'REJECTED'
                ? [
                    'TOURNAMENT_APPLICATION_SUBMITTED',
                    'TOURNAMENT_REGISTRATION_RECEIVED',
                  ]
                : ['TOURNAMENT_APPLICATION_SUBMITTED'],
          },
        },
        data: { readAt: new Date() },
      });
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.prisma.tournamentRegistration.findMany({
        where: {
          OR: [
            { status: 'PENDING' },
            { status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ],
          tournament: {
            status: { notIn: ['COMPLETED', 'CANCELLED', 'DRAFT'] },
          },
        },
        select: { id: true },
      });
      for (const entry of pending) {
        try {
          await this.notify(entry.id);
        } catch {
          this.logger.warn('Registration notification will retry.');
        }
      }
    } catch {
      this.logger.warn('Registration notification scan will retry.');
    } finally {
      this.running = false;
    }
  }
}
