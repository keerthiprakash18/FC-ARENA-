import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

type NotificationType =
  | 'LEAGUE_JOIN_REQUESTED'
  | 'LEAGUE_REQUEST_APPROVED'
  | 'LEAGUE_REQUEST_REJECTED'
  | 'TOURNAMENT_CREATED'
  | 'TOURNAMENT_REGISTRATION_OPENED'
  | 'TOURNAMENT_APPLICATION_APPROVED'
  | 'TOURNAMENT_APPLICATION_REJECTED'
  | 'FIXTURE_CREATED'
  | 'FIXTURE_CHANGED'
  | 'MATCH_REMINDER'
  | 'RESULT_SUBMITTED'
  | 'RESULT_CONFIRMED'
  | 'STATISTICS_UPDATED'
  | 'TOURNAMENT_COMPLETED'
  | 'ACHIEVEMENT_RECEIVED';

interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey: string;
  eventAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getNotifications(
    userId: string,
  ) {
    await this.syncForUser(
      userId,
    );

    const [
      notifications,
      unreadCount,
    ] =
      await this.prisma.$transaction([
        this.prisma.notification.findMany({
          where: {
            userId,
          },

          orderBy: {
            eventAt:
              'desc',
          },

          take: 100,
        }),

        this.prisma.notification.count({
          where: {
            userId,
            readAt: null,
          },
        }),
      ]);

    return {
      success: true,

      data: {
        unreadCount,
        notifications,
      },

      error: null,
    };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ) {
    const notification =
      await this.prisma.notification.findFirst({
        where: {
          id:
            notificationId,

          userId,
        },
      });

    if (!notification) {
      throw this.notificationNotFound();
    }

    const updated =
      await this.prisma.notification.update({
        where: {
          id:
            notification.id,
        },

        data: {
          readAt:
            notification.readAt ??
            new Date(),
        },
      });

    return {
      success: true,

      data: {
        notification:
          updated,
      },

      error: null,
    };
  }

  async markAllAsRead(
    userId: string,
  ) {
    const now =
      new Date();

    const result =
      await this.prisma.notification.updateMany({
        where: {
          userId,
          readAt: null,
        },

        data: {
          readAt:
            now,
        },
      });

    return {
      success: true,

      data: {
        updated:
          result.count,
      },

      error: null,
    };
  }

  private async syncForUser(
    userId: string,
  ) {
    const adminRoles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,

          league: {
            select: {
              name: true,
            },
          },
        },
      });

    const adminLeagueIds =
      adminRoles.map(
        (role) =>
          role.leagueId,
      );

    /*
     * 1. League join requests
     */
    if (
      adminLeagueIds.length >
      0
    ) {
      const applications =
        await this.prisma.leagueApplication.findMany({
          where: {
            leagueId: {
              in:
                adminLeagueIds,
            },

            status:
              'PENDING',
          },

          include: {
            league: true,

            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      for (
        const application
        of applications
      ) {
        const applicant =
          application.user
            .player
            ?.identity
            ?.inGameName ??
          application.user
            .fullName;

        await this.ensure(
          userId,
          {
            type:
              'LEAGUE_JOIN_REQUESTED',

            title:
              'New League Join Request',

            message:
              `${applicant} wants to join ${application.league.name}.`,

            href:
              `/leagues/${application.leagueId}`,

            entityType:
              'LeagueApplication',

            entityId:
              application.id,

            dedupeKey:
              `league-join-request:${application.id}`,

            eventAt:
              application.createdAt,
          },
        );
      }
    }

    /*
     * 2. My League application decisions
     */
    const myLeagueApplications =
      await this.prisma.leagueApplication.findMany({
        where: {
          userId,

          status: {
            in: [
              'APPROVED',
              'REJECTED',
            ],
          },
        },

        include: {
          league: true,
        },
      });

    for (
      const application
      of myLeagueApplications
    ) {
      const approved =
        application.status ===
        'APPROVED';

      await this.ensure(
        userId,
        {
          type:
            approved
              ? 'LEAGUE_REQUEST_APPROVED'
              : 'LEAGUE_REQUEST_REJECTED',

          title:
            approved
              ? 'League Request Approved'
              : 'League Request Rejected',

          message:
            approved
              ? `You are now a member of ${application.league.name}.`
              : `Your request to join ${application.league.name} was rejected.`,

          href:
            `/leagues/${application.leagueId}`,

          entityType:
            'LeagueApplication',

          entityId:
            application.id,

          dedupeKey:
            `league-application:${application.id}:${application.status}`,

          eventAt:
            application.reviewedAt ??
            application.updatedAt,
        },
      );
    }

    /*
     * 3. Membership-based events
     */
    const memberships =
      await this.prisma.leagueMember.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
          joinedAt: true,

          league: {
            select: {
              name: true,
            },
          },
        },
      });

    const membershipMap =
      new Map(
        memberships.map(
          (membership) => [
            membership.leagueId,
            membership,
          ],
        ),
      );

    const leagueIds =
      memberships.map(
        (membership) =>
          membership.leagueId,
      );

    if (
      leagueIds.length > 0
    ) {
      const tournaments =
        await this.prisma.tournament.findMany({
          where: {
            leagueId: {
              in:
                leagueIds,
            },
          },
        });

      for (
        const tournament
        of tournaments
      ) {
        const membership =
          membershipMap.get(
            tournament.leagueId,
          );

        if (!membership) {
          continue;
        }

        if (
          tournament.createdAt >=
          membership.joinedAt
        ) {
          await this.ensure(
            userId,
            {
              type:
                'TOURNAMENT_CREATED',

              title:
                'Tournament Created',

              message:
                `${tournament.name} has been created.`,

              href:
                `/tournaments/${tournament.id}`,

              entityType:
                'Tournament',

              entityId:
                tournament.id,

              dedupeKey:
                `tournament-created:${tournament.id}`,

              eventAt:
                tournament.createdAt,
            },
          );
        }

        if (
          tournament.registrationOpenedAt &&
          tournament.registrationOpenedAt >=
            membership.joinedAt
        ) {
          await this.ensure(
            userId,
            {
              type:
                'TOURNAMENT_REGISTRATION_OPENED',

              title:
                'Tournament Registration Open',

              message:
                `Registration is open for ${tournament.name}.`,

              href:
                `/tournaments/${tournament.id}`,

              entityType:
                'Tournament',

              entityId:
                tournament.id,

              dedupeKey:
                `tournament-registration-open:${tournament.id}:${tournament.registrationOpenedAt.toISOString()}`,

              eventAt:
                tournament.registrationOpenedAt,
            },
          );
        }

        if (
          tournament.status ===
            'COMPLETED' &&
          tournament.completedAt
        ) {
          await this.ensure(
            userId,
            {
              type:
                'TOURNAMENT_COMPLETED',

              title:
                'Tournament Completed',

              message:
                `${tournament.name} has officially completed.`,

              href:
                `/tournaments/${tournament.id}/achievements`,

              entityType:
                'Tournament',

              entityId:
                tournament.id,

              dedupeKey:
                `tournament-completed:${tournament.id}`,

              eventAt:
                tournament.completedAt,
            },
          );
        }
      }
    }

    /*
     * 4. My Tournament application decisions
     */
    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          registeredByUserId:
            userId,

          status: {
            in: [
              'APPROVED',
              'REJECTED',
            ],
          },
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    for (
      const registration
      of registrations
    ) {
      const approved =
        registration.status ===
        'APPROVED';

      await this.ensure(
        userId,
        {
          type:
            approved
              ? 'TOURNAMENT_APPLICATION_APPROVED'
              : 'TOURNAMENT_APPLICATION_REJECTED',

          title:
            approved
              ? 'Tournament Entry Approved'
              : 'Tournament Entry Rejected',

          message:
            approved
              ? `Your entry for ${registration.tournament.name} has been approved.`
              : `Your entry for ${registration.tournament.name} was rejected.`,

          href:
            `/tournaments/${registration.tournament.id}`,

          entityType:
            'TournamentRegistration',

          entityId:
            registration.id,

          dedupeKey:
            `tournament-registration:${registration.id}:${registration.status}`,

          eventAt:
            registration.reviewedAt ??
            registration.updatedAt,
        },
      );
    }

    /*
     * 5. My fixtures + reminders
     */
    const fixtures =
      await this.prisma.fixture.findMany({
        where: {
          OR: [
            {
              homeRegistration: {
                is: {
                  members: {
                    some: {
                      userId,
                    },
                  },
                },
              },
            },
            {
              awayRegistration: {
                is: {
                  members: {
                    some: {
                      userId,
                    },
                  },
                },
              },
            },
          ],
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },

          match: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

    const now =
      new Date();

    const reminderLimit =
      new Date(
        now.getTime() +
          60 * 60 * 1000,
      );

    for (
      const fixture
      of fixtures
    ) {
      await this.ensure(
        userId,
        {
          type:
            'FIXTURE_CREATED',

          title:
            'Fixture Created',

          message:
            `${fixture.roundName} fixture added in ${fixture.tournament.name}.`,

          href:
            fixture.match
              ? `/matches/${fixture.match.id}`
              : `/tournaments/${fixture.tournament.id}`,

          entityType:
            'Fixture',

          entityId:
            fixture.id,

          dedupeKey:
            `fixture-created:${fixture.id}`,

          eventAt:
            fixture.createdAt,
        },
      );

      if (
        fixture.scheduledAt
      ) {
        await this.ensure(
          userId,
          {
            type:
              'FIXTURE_CHANGED',

            title:
              'Match Schedule Updated',

            message:
              `${fixture.tournament.name}: ${fixture.roundName} is scheduled for ${fixture.scheduledAt.toLocaleString()}.`,

            href:
              fixture.match
                ? `/matches/${fixture.match.id}`
                : `/tournaments/${fixture.tournament.id}`,

            entityType:
              'Fixture',

            entityId:
              fixture.id,

            dedupeKey:
              `fixture-schedule:${fixture.id}:${fixture.scheduledAt.toISOString()}`,

            eventAt:
              fixture.updatedAt,
          },
        );

        if (
          fixture.match &&
          fixture.match.status ===
            'SCHEDULED' &&
          fixture.scheduledAt >=
            now &&
          fixture.scheduledAt <=
            reminderLimit
        ) {
          await this.ensure(
            userId,
            {
              type:
                'MATCH_REMINDER',

              title:
                'Match Reminder',

              message:
                `${fixture.tournament.name}: your ${fixture.roundName} match starts soon.`,

              href:
                `/matches/${fixture.match.id}`,

              entityType:
                'Match',

              entityId:
                fixture.match.id,

              dedupeKey:
                `match-reminder:${fixture.match.id}:${fixture.scheduledAt.toISOString()}`,

              eventAt:
                now,
            },
          );
        }
      }
    }

    /*
     * 6. Result waiting for Admin verification
     */
    if (
      adminLeagueIds.length >
      0
    ) {
      const pendingResults =
        await this.prisma.resultSubmission.findMany({
          where: {
            status:
              'PENDING_VERIFICATION',

            match: {
              tournament: {
                leagueId: {
                  in:
                    adminLeagueIds,
                },
              },
            },
          },

          include: {
            submittedBy: {
              select: {
                fullName: true,

                player: {
                  select: {
                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            match: {
              include: {
                tournament: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

      for (
        const result
        of pendingResults
      ) {
        const submitter =
          result.submittedBy
            .player
            ?.identity
            ?.inGameName ??
          result.submittedBy
            .fullName;

        await this.ensure(
          userId,
          {
            type:
              'RESULT_SUBMITTED',

            title:
              'Result Verification Ready',

            message:
              `${submitter} submitted ${result.homeScore}-${result.awayScore} in ${result.match.tournament.name}.`,

            href:
              `/matches/${result.matchId}`,

            entityType:
              'ResultSubmission',

            entityId:
              result.id,

            dedupeKey:
              `result-submitted:${result.id}`,

            eventAt:
              result.createdAt,
          },
        );
      }
    }

    /*
     * 7. Confirmed results + statistics
     */
    const confirmedResults =
      await this.prisma.resultSubmission.findMany({
        where: {
          status:
            'CONFIRMED',

          match: {
            OR: [
              {
                fixture: {
                  homeRegistration: {
                    is: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                },
              },
              {
                fixture: {
                  awayRegistration: {
                    is: {
                      members: {
                        some: {
                          userId,
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },

        include: {
          match: {
            include: {
              tournament: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

    for (
      const result
      of confirmedResults
    ) {
      const eventAt =
        result.reviewedAt ??
        result.updatedAt;

      await this.ensure(
        userId,
        {
          type:
            'RESULT_CONFIRMED',

          title:
            'Result Confirmed',

          message:
            `${result.match.tournament.name}: ${result.homeScore}-${result.awayScore} has been confirmed.`,

          href:
            `/matches/${result.matchId}`,

          entityType:
            'ResultSubmission',

          entityId:
            result.id,

          dedupeKey:
            `result-confirmed:${result.id}`,

          eventAt,
        },
      );

      await this.ensure(
        userId,
        {
          type:
            'STATISTICS_UPDATED',

          title:
            'Statistics Updated',

          message:
            `Your statistics and standings were updated after the confirmed result.`,

          href:
            `/tournaments/${result.match.tournamentId}/standings`,

          entityType:
            'Tournament',

          entityId:
            result.match.tournamentId,

          dedupeKey:
            `statistics-updated:${result.id}:${userId}`,

          eventAt,
        },
      );
    }

    /*
     * 8. Achievements
     */
    const achievements =
      await this.prisma.achievement.findMany({
        where: {
          userId,
        },

        include: {
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    for (
      const achievement
      of achievements
    ) {
      await this.ensure(
        userId,
        {
          type:
            'ACHIEVEMENT_RECEIVED',

          title:
            'Achievement Received',

          message:
            `${achievement.title} — ${achievement.tournament.name}`,

          href:
            `/tournaments/${achievement.tournament.id}/achievements`,

          entityType:
            'Achievement',

          entityId:
            achievement.id,

          dedupeKey:
            `achievement:${achievement.id}`,

          eventAt:
            achievement.awardedAt,
        },
      );
    }
  }

  private async ensure(
    userId: string,
    input:
      NotificationInput,
  ) {
    await this.prisma.notification.upsert({
      where: {
        dedupeKey:
          input.dedupeKey,
      },

      create: {
        userId,

        type:
          input.type,

        title:
          input.title,

        message:
          input.message,

        href:
          input.href ??
          null,

        entityType:
          input.entityType ??
          null,

        entityId:
          input.entityId ??
          null,

        dedupeKey:
          input.dedupeKey,

        eventAt:
          input.eventAt,
      },

      update: {
        title:
          input.title,

        message:
          input.message,

        href:
          input.href ??
          null,

        entityType:
          input.entityType ??
          null,

        entityId:
          input.entityId ??
          null,

        eventAt:
          input.eventAt,
      },
    });
  }

  private notificationNotFound() {
    return new NotFoundException({
      success: false,
      data: null,

      error: {
        code:
          'NOTIFICATION_NOT_FOUND',

        message:
          'Notification could not be found.',
      },
    });
  }
}