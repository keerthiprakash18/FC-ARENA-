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
  | 'MATCH_READY'
  | 'RESULT_SUBMITTED'
  | 'RESULT_REJECTED'
  | 'RESULT_CONFIRMED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
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
  private readonly pendingSyncs = new Map<string, Promise<void>>();
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getNotifications(
    userId: string,
    summaryOnly = false,
  ) {
    await this.syncForUser(
      userId,
    );

    // The shell badge needs only a count; do not load 100 full inbox rows.
    if (summaryOnly) {
      const unreadCount = await this.prisma.notification.count({
        where: { userId, readAt: null },
      });
      return { success: true, data: { unreadCount }, error: null };
    }

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

  syncForUser(userId: string): Promise<void> {
    const existing = this.pendingSyncs.get(userId);
    if (existing) return existing;
    const pending = this.synchronizeForUser(userId).finally(() => {
      if (this.pendingSyncs.get(userId) === pending) {
        this.pendingSyncs.delete(userId);
      }
    });
    this.pendingSyncs.set(userId, pending);
    return pending;
  }

  private async synchronizeForUser(
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
              homeReadyAt: true,
              awayReadyAt: true,
            },
          },

          homeRegistration: {
            select: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },

          awayRegistration: {
            select: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

    const now =
      new Date();

    const twoHourLimit =
      new Date(
        now.getTime() +
          2 * 60 * 60 * 1000,
      );

    const thirtyMinuteLimit =
      new Date(
        now.getTime() +
          30 * 60 * 1000,
      );

    const fiveMinuteLimit =
      new Date(
        now.getTime() +
          5 * 60 * 1000,
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
            now
        ) {
          if (
            fixture.scheduledAt <=
              twoHourLimit &&
            fixture.scheduledAt >
              thirtyMinuteLimit
          ) {
            await this.ensure(
              userId,
              {
                type:
                  'MATCH_REMINDER',

                title:
                  'Match in 2 Hours',

                message:
                  `${fixture.tournament.name}: ${fixture.roundName} is coming up. Open Match Room and get ready.`,

                href:
                  `/matches/${fixture.match.id}`,

                entityType:
                  'Match',

                entityId:
                  fixture.match.id,

                dedupeKey:
                  `match-reminder-2h:${fixture.match.id}:${fixture.scheduledAt.toISOString()}`,

                eventAt:
                  now,
              },
            );
          }

          if (
            fixture.scheduledAt <=
              thirtyMinuteLimit &&
            fixture.scheduledAt >
              fiveMinuteLimit
          ) {
            await this.ensure(
              userId,
              {
                type:
                  'MATCH_REMINDER',

                title:
                  'Match in 30 Minutes',

                message:
                  `${fixture.tournament.name}: open Match Room, check your opponent and mark Ready to Play.`,

                href:
                  `/matches/${fixture.match.id}`,

                entityType:
                  'Match',

                entityId:
                  fixture.match.id,

                dedupeKey:
                  `match-reminder-30m:${fixture.match.id}:${fixture.scheduledAt.toISOString()}`,

                eventAt:
                  now,
              },
            );
          }

          if (
            fixture.scheduledAt <=
            fiveMinuteLimit
          ) {
            await this.ensure(
              userId,
              {
                type:
                  'MATCH_REMINDER',

                title:
                  'Match Starting Now',

                message:
                  `${fixture.tournament.name}: your ${fixture.roundName} match is starting now.`,

                href:
                  `/matches/${fixture.match.id}`,

                entityType:
                  'Match',

                entityId:
                  fixture.match.id,

                dedupeKey:
                  `match-reminder-now:${fixture.match.id}:${fixture.scheduledAt.toISOString()}`,

                eventAt:
                  now,
              },
            );
          }
        }
      }

      if (
        fixture.match
      ) {
        const isHome =
          fixture.homeRegistration
            ?.members.some(
              (
                member,
              ) =>
                member.userId ===
                userId,
            ) ??
          false;

        const isAway =
          fixture.awayRegistration
            ?.members.some(
              (
                member,
              ) =>
                member.userId ===
                userId,
            ) ??
          false;

        if (
          isHome ||
          isAway
        ) {
          const myReadyAt =
            isHome
              ? fixture.match
                  .homeReadyAt
              : fixture.match
                  .awayReadyAt;

          const opponentReadyAt =
            isHome
              ? fixture.match
                  .awayReadyAt
              : fixture.match
                  .homeReadyAt;

          if (
            opponentReadyAt
          ) {
            await this.ensure(
              userId,
              {
                type:
                  'MATCH_READY',

                title:
                  'Opponent is Ready',

                message:
                  `${fixture.tournament.name}: your opponent marked Ready to Play.`,

                href:
                  `/matches/${fixture.match.id}`,

                entityType:
                  'Match',

                entityId:
                  fixture.match.id,

                dedupeKey:
                  `opponent-ready:${fixture.match.id}:${opponentReadyAt.toISOString()}`,

                eventAt:
                  opponentReadyAt,
              },
            );
          }

          if (
            myReadyAt &&
            opponentReadyAt
          ) {
            const bothReadyAt =
              myReadyAt >
              opponentReadyAt
                ? myReadyAt
                : opponentReadyAt;

            await this.ensure(
              userId,
              {
                type:
                  'MATCH_READY',

                title:
                  'Both Sides Ready',

                message:
                  `${fixture.tournament.name}: both sides are Ready to Play.`,

                href:
                  `/matches/${fixture.match.id}`,

                entityType:
                  'Match',

                entityId:
                  fixture.match.id,

                dedupeKey:
                  `both-ready:${fixture.match.id}:${bothReadyAt.toISOString()}`,

                eventAt:
                  bothReadyAt,
              },
            );
          }
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
     * 6b. Opponent result submissions
     */
    const participantPendingResults =
      await this.prisma.resultSubmission.findMany({
        where: {
          status:
            'PENDING_VERIFICATION',

          submittedByUserId: {
            not:
              userId,
          },

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
      of participantPendingResults
    ) {
      await this.ensure(
        userId,
        {
          type:
            'RESULT_SUBMITTED',

          title:
            'Opponent Submitted a Result',

          message:
            `${result.match.tournament.name}: ${result.homeScore}-${result.awayScore} is waiting for verification.`,

          href:
            `/matches/${result.matchId}#result-verification`,

          entityType:
            'ResultSubmission',

          entityId:
            result.id,

          dedupeKey:
            `opponent-result-submitted:${result.id}`,

          eventAt:
            result.createdAt,
        },
      );
    }

    /*
     * 6c. My rejected result submissions
     */
    const rejectedResults =
      await this.prisma.resultSubmission.findMany({
        where: {
          submittedByUserId:
            userId,

          status:
            'REJECTED',
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
      of rejectedResults
    ) {
      const eventAt =
        result.reviewedAt ??
        result.updatedAt;

      await this.ensure(
        userId,
        {
          type:
            'RESULT_REJECTED',

          title:
            'Result Needs Attention',

          message:
            result.rejectionReason
              ? `${result.match.tournament.name}: result rejected — ${result.rejectionReason}`
              : `${result.match.tournament.name}: your result submission was rejected.`,

          href:
            `/matches/${result.matchId}#result-entry`,

          entityType:
            'ResultSubmission',

          entityId:
            result.id,

          dedupeKey:
            `result-rejected:${result.id}`,

          eventAt,
        },
      );
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
     * 7b. Match disputes
     */
    if (
      adminLeagueIds.length >
      0
    ) {
      const openDisputes =
        await this.prisma.matchDispute.findMany({
          where: {
            status:
              'OPEN',

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
            match: {
              include: {
                tournament: {
                  select: {
                    name: true,
                  },
                },
              },
            },

            raisedBy: {
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
          },
        });

      for (
        const dispute
        of openDisputes
      ) {
        const raiser =
          dispute.raisedBy
            .player
            ?.identity
            ?.inGameName ??
          dispute.raisedBy
            .fullName;

        await this.ensure(
          userId,
          {
            type:
              'DISPUTE_OPENED',

            title:
              'Match Dispute Opened',

            message:
              `${raiser} raised a dispute in ${dispute.match.tournament.name}.`,

            href:
              `/matches/${dispute.matchId}/dispute`,

            entityType:
              'MatchDispute',

            entityId:
              dispute.id,

            dedupeKey:
              `dispute-opened:${dispute.id}`,

            eventAt:
              dispute.createdAt,
          },
        );
      }
    }

    const resolvedDisputes =
      await this.prisma.matchDispute.findMany({
        where: {
          raisedByUserId:
            userId,

          status: {
            in: [
              'RESOLVED',
              'REJECTED',
            ],
          },

          resolvedAt: {
            not:
              null,
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
      const dispute
      of resolvedDisputes
    ) {
      await this.ensure(
        userId,
        {
          type:
            'DISPUTE_RESOLVED',

          title:
            dispute.status ===
            'RESOLVED'
              ? 'Dispute Resolved'
              : 'Dispute Rejected',

          message:
            `${dispute.match.tournament.name}: your match dispute has been ${dispute.status.toLowerCase()}.`,

          href:
            `/matches/${dispute.matchId}/dispute`,

          entityType:
            'MatchDispute',

          entityId:
            dispute.id,

          dedupeKey:
            `dispute-closed:${dispute.id}:${dispute.status}`,

          eventAt:
            dispute.resolvedAt!,
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
    /*
     * 9. Seasonal FC Arena awards
     */
    const seasonalAwards =
      await this.prisma.seasonalAward.findMany({
        where: {
          userId,
        },

        orderBy: {
          awardedAt:
            'asc',
        },
      });

    const seasonIds =
      [
        ...new Set(
          seasonalAwards.map(
            (award) =>
              award.seasonId,
          ),
        ),
      ];

    const awardSeasons =
      seasonIds.length > 0
        ? await this.prisma.ballonSeason.findMany({
            where: {
              id: {
                in:
                  seasonIds,
              },
            },

            select: {
              id: true,
              name: true,
            },
          })
        : [];

    const awardSeasonNames =
      new Map(
        awardSeasons.map(
          (season) => [
            season.id,
            season.name,
          ],
        ),
      );

    for (
      const award
      of seasonalAwards
    ) {
      await this.ensure(
        userId,
        {
          type:
            'ACHIEVEMENT_RECEIVED',

          title:
            'Seasonal Award Received',

          message:
            `${award.title} — ${awardSeasonNames.get(award.seasonId) ?? 'FC Arena'}`,

          href:
            '/awards',

          entityType:
            'SeasonalAward',

          entityId:
            award.id,

          dedupeKey:
            `seasonal-award:${award.id}`,

          eventAt:
            award.awardedAt,
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
          `${userId}:${input.dedupeKey}`,
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
          `${userId}:${input.dedupeKey}`,

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