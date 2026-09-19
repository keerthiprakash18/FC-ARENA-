import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { RejectResultDto } from './dto/reject-result.dto.js';
import type { SubmitResultDto } from './dto/submit-result.dto.js';

type Outcome = 'W' | 'D' | 'L';

interface SideDelta extends Record<string, string | number> {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  outcome: Outcome;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async submitResult(
    userId: string,
    matchId: string,
    dto: SubmitResultDto,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },
        include: {
          tournament: true,
          fixture: {
            include: {
              homeRegistration: {
                include: {
                  members: true,
                },
              },
              awayRegistration: {
                include: {
                  members: true,
                },
              },
            },
          },
        },
      });

    if (!match) {
      throw this.matchNotFound();
    }

    if (
      match.confirmedResultSubmissionId
    ) {
      throw this.resultAlreadyRecorded();
    }

    if (
      match.status !== 'UNSCHEDULED' &&
      match.status !== 'SCHEDULED' &&
      match.status !== 'LIVE'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'MATCH_NOT_OPEN_FOR_RESULT',
          message:
            'Only unscheduled, scheduled or live matches can accept a result submission.',
        },
      });
    }

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament.leagueId,
            userId,
          },
        },
      });

    const participantUserIds = [
      ...(match.fixture.homeRegistration
        ?.members.map(
          (member) => member.userId,
        ) ?? []),

      ...(match.fixture.awayRegistration
        ?.members.map(
          (member) => member.userId,
        ) ?? []),
    ];

    if (
      !admin &&
      !participantUserIds.includes(
        userId,
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'RESULT_SUBMISSION_FORBIDDEN',

          message:
            'Only match participants or a League Admin may submit this result.',
        },
      });
    }

    const existingPending =
      await this.prisma.resultSubmission.findFirst({
        where: {
          matchId,
          submittedByUserId:
            userId,
          status:
            'PENDING_VERIFICATION',
        },
      });

    if (existingPending) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESULT_ALREADY_PENDING',

          message:
            'You already have a result waiting for verification for this match.',
        },
      });
    }

    const submission =
      await this.prisma.resultSubmission.create({
        data: {
          matchId,
          submittedByUserId:
            userId,
          homeScore:
            dto.homeScore,
          awayScore:
            dto.awayScore,
        },
      });

    return {
      success: true,
      data: {
        message:
          'Result submitted and is waiting for verification.',
        submission,
      },
      error: null,
    };
  }

  async getMatchResults(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },
        include: {
          tournament: true,
        },
      });

    if (!match) {
      throw this.matchNotFound();
    }

    await this.assertLeagueMember(
      userId,
      match.tournament.leagueId,
    );

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament.leagueId,
            userId,
          },
        },
      });

    const submissions =
      await this.prisma.resultSubmission.findMany({
        where: {
          matchId,

          ...(admin
            ? {}
            : {
                OR: [
                  {
                    status:
                      'CONFIRMED',
                  },
                  {
                    submittedByUserId:
                      userId,
                  },
                ],
              }),
        },

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          submittedBy: {
            select: {
              id: true,
              fullName: true,

              player: {
                select: {
                  playerCode: true,

                  identity: {
                    select: {
                      inGameName: true,
                    },
                  },
                },
              },
            },
          },

          reviewedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

    return {
      success: true,
      data: {
        isLeagueAdmin:
          Boolean(admin),

        confirmedResultSubmissionId:
          match.confirmedResultSubmissionId,

        submissions,
      },
      error: null,
    };
  }

  async confirmResult(
    adminUserId: string,
    resultSubmissionId: string,
  ) {
    const initial =
      await this.prisma.resultSubmission.findUnique({
        where: {
          id: resultSubmissionId,
        },
        include: {
          match: {
            include: {
              tournament: true,
            },
          },
        },
      });

    if (!initial) {
      throw this.resultNotFound();
    }

    await this.assertLeagueAdmin(
      adminUserId,
      initial.match.tournament.leagueId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const submission =
          await tx.resultSubmission.findUnique({
            where: {
              id: resultSubmissionId,
            },

            include: {
              match: {
                include: {
                  tournament: {
                    include: {
                      _count: {
                        select: {
                          groups: true,
                        },
                      },
                    },
                  },

                  fixture: {
                    include: {
                      homeRegistration: {
                        include: {
                          members: true,
                        },
                      },

                      awayRegistration: {
                        include: {
                          members: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

        if (!submission) {
          throw this.resultNotFound();
        }

        if (
          submission.match
            .confirmedResultSubmissionId
        ) {
          throw this.resultAlreadyRecorded();
        }

        if (
          submission.status !==
          'PENDING_VERIFICATION'
        ) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code:
                'RESULT_NOT_PENDING',

              message:
                'Only a pending result may be confirmed.',
            },
          });
        }

        const fixture =
          submission.match.fixture;

        const home =
          fixture.homeRegistration;

        const away =
          fixture.awayRegistration;

        if (!home || !away) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code:
                'MATCH_PARTICIPANTS_NOT_READY',

              message:
                'Both match participants must be resolved before confirming a result.',
            },
          });
        }

        if (
          this.isKnockoutFixture(
            submission.match.tournament.format,
            fixture.groupId,
            submission.match.tournament._count.groups,
          ) &&
          submission.homeScore ===
            submission.awayScore
        ) {
          throw new BadRequestException({
            success: false,
            data: null,
            error: {
              code:
                'KNOCKOUT_DRAW_NOT_ALLOWED',

              message:
                'A Knockout result must have a winner.',
            },
          });
        }

        const homeDelta =
          this.calculateDelta(
            submission.homeScore,
            submission.awayScore,
          );

        const awayDelta =
          this.calculateDelta(
            submission.awayScore,
            submission.homeScore,
          );

        if (
          !this.isKnockoutFixture(
            submission.match.tournament.format,
            fixture.groupId,
            submission.match.tournament._count.groups,
          )
        ) {
          await this.applyStanding(
            tx,
            submission.match.tournamentId,
            home.id,
            homeDelta,
          );

          await this.applyStanding(
            tx,
            submission.match.tournamentId,
            away.id,
            awayDelta,
          );
        }

        for (
          const member of
          home.members
        ) {
          await this.applyPlayerStatistic(
            tx,
            submission.match.tournamentId,
            member.userId,
            homeDelta,
          );
        }

        for (
          const member of
          away.members
        ) {
          await this.applyPlayerStatistic(
            tx,
            submission.match.tournamentId,
            member.userId,
            awayDelta,
          );
        }

        await tx.resultSubmission.update({
          where: {
            id:
              submission.id,
          },

          data: {
            status:
              'CONFIRMED',

            reviewedByUserId:
              adminUserId,

            reviewedAt:
              new Date(),
          },
        });

        await tx.match.update({
          where: {
            id:
              submission.matchId,
          },

          data: {
            status:
              'COMPLETED',

            confirmedResultSubmissionId:
              submission.id,
          },
        });

        await tx.fixture.update({
          where: {
            id:
              fixture.id,
          },

          data: {
            status:
              'COMPLETED',
          },
        });

        await tx.matchResultStatEvent.create({
          data: {
            tournamentId:
              submission.match.tournamentId,

            matchId:
              submission.matchId,

            resultSubmissionId:
              submission.id,

            type:
              'APPLY',

            payload: {
              home: {
                registrationId:
                  home.id,

                score:
                  submission.homeScore,

                delta:
                  homeDelta,

                userIds:
                  home.members.map(
                    (member) =>
                      member.userId,
                  ),
              },

              away: {
                registrationId:
                  away.id,

                score:
                  submission.awayScore,

                delta:
                  awayDelta,

                userIds:
                  away.members.map(
                    (member) =>
                      member.userId,
                  ),
              },
            },
          },
        });

        if (
          submission.match.tournament
            .status ===
          'REGISTRATION_CLOSED'
        ) {
          await tx.tournament.update({
            where: {
              id:
                submission.match.tournamentId,
            },

            data: {
              status:
                'ACTIVE',
            },
          });
        }

        if (
          this.isKnockoutFixture(
            submission.match.tournament.format,
            fixture.groupId,
            submission.match.tournament._count.groups,
          ) &&
          fixture.nextFixtureId &&
          fixture.nextSlot
        ) {
          const winnerRegistrationId =
            submission.homeScore >
            submission.awayScore
              ? home.id
              : away.id;

          const nextFixture =
            await tx.fixture.findUnique({
              where: {
                id:
                  fixture.nextFixtureId,
              },
            });

          if (!nextFixture) {
            throw new ConflictException({
              success: false,
              data: null,
              error: {
                code:
                  'NEXT_FIXTURE_NOT_FOUND',

                message:
                  'Knockout progression fixture could not be found.',
              },
            });
          }

          if (
            fixture.nextSlot ===
            'HOME'
          ) {
            if (
              nextFixture.homeRegistrationId &&
              nextFixture.homeRegistrationId !==
                winnerRegistrationId
            ) {
              throw new ConflictException({
                success: false,
                data: null,
                error: {
                  code:
                    'KNOCKOUT_SLOT_ALREADY_FILLED',

                  message:
                    'The next Knockout fixture already contains another participant.',
                },
              });
            }

            await tx.fixture.update({
              where: {
                id:
                  nextFixture.id,
              },

              data: {
                homeRegistrationId:
                  winnerRegistrationId,
              },
            });
          } else {
            if (
              nextFixture.awayRegistrationId &&
              nextFixture.awayRegistrationId !==
                winnerRegistrationId
            ) {
              throw new ConflictException({
                success: false,
                data: null,
                error: {
                  code:
                    'KNOCKOUT_SLOT_ALREADY_FILLED',

                  message:
                    'The next Knockout fixture already contains another participant.',
                },
              });
            }

            await tx.fixture.update({
              where: {
                id:
                  nextFixture.id,
              },

              data: {
                awayRegistrationId:
                  winnerRegistrationId,
              },
            });
          }
        }

        return {
          success: true,
          data: {
            message:
              'Result confirmed. Statistics and standings have been updated.',
          },
          error: null,
        };
      },
      {
        isolationLevel:
          'Serializable',
      },
    );
  }

  async rejectResult(
    adminUserId: string,
    resultSubmissionId: string,
    dto: RejectResultDto,
  ) {
    const submission =
      await this.prisma.resultSubmission.findUnique({
        where: {
          id:
            resultSubmissionId,
        },

        include: {
          match: {
            include: {
              tournament: true,
            },
          },
        },
      });

    if (!submission) {
      throw this.resultNotFound();
    }

    await this.assertLeagueAdmin(
      adminUserId,
      submission.match.tournament.leagueId,
    );

    if (
      submission.status !==
      'PENDING_VERIFICATION'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESULT_NOT_PENDING',

          message:
            'Only a pending result may be rejected.',
        },
      });
    }

    await this.prisma.resultSubmission.update({
      where: {
        id:
          submission.id,
      },

      data: {
        status:
          'REJECTED',

        reviewedByUserId:
          adminUserId,

        reviewedAt:
          new Date(),

        rejectionReason:
          dto.reason?.trim() ||
          null,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Result submission rejected.',
      },
      error: null,
    };
  }

  async getStandings(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },
      });

    if (!tournament) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_NOT_FOUND',

          message:
            'Tournament could not be found.',
        },
      });
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status:
            'APPROVED',
        },

        include: {
          standing: true,

          members: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,

                  player: {
                    select: {
                      playerCode: true,

                      identity: {
                        select: {
                          inGameName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    const rows =
      registrations.map(
        (registration) => ({
          registrationId:
            registration.id,

          entryName:
            registration.entryName ||
            registration.members
              .map(
                (member) =>
                  member.user.player
                    ?.identity
                    ?.inGameName ||
                  member.user.fullName,
              )
              .join(' + '),

          members:
            registration.members.map(
              (member) => ({
                id:
                  member.user.id,

                fullName:
                  member.user.fullName,

                playerCode:
                  member.user.player
                    ?.playerCode ??
                  null,

                inGameName:
                  member.user.player
                    ?.identity
                    ?.inGameName ??
                  null,
              }),
            ),

          played:
            registration.standing
              ?.played ?? 0,

          wins:
            registration.standing
              ?.wins ?? 0,

          draws:
            registration.standing
              ?.draws ?? 0,

          losses:
            registration.standing
              ?.losses ?? 0,

          goalsFor:
            registration.standing
              ?.goalsFor ?? 0,

          goalsAgainst:
            registration.standing
              ?.goalsAgainst ?? 0,

          goalDifference:
            registration.standing
              ?.goalDifference ?? 0,

          points:
            registration.standing
              ?.points ?? 0,

          form:
            registration.standing
              ?.form ?? '',
        }),
      );

    rows.sort(
      (a, b) =>
        b.points -
          a.points ||
        b.goalDifference -
          a.goalDifference ||
        b.goalsFor -
          a.goalsFor ||
        b.wins -
          a.wins ||
        a.entryName.localeCompare(
          b.entryName,
        ),
    );

    return {
      success: true,
      data: {
        tournament: {
          id:
            tournament.id,
          name:
            tournament.name,
          format:
            tournament.format,
          mode:
            tournament.mode,
        },

        standings:
          rows.map(
            (row, index) => ({
              position:
                index + 1,
              ...row,
            }),
          ),
      },
      error: null,
    };
  }

  async getMyStatistics(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },
      });

    if (!tournament) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_NOT_FOUND',

          message:
            'Tournament could not be found.',
        },
      });
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    const statistic =
      await this.prisma.playerTournamentStatistic.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId,
          },
        },
      });

    return {
      success: true,
      data: {
        statistic,
      },
      error: null,
    };
  }

  private isKnockoutFixture(
    tournamentFormat: string,
    fixtureGroupId: string | null,
    tournamentGroupCount: number,
  ) {
    if (
      tournamentFormat ===
      'KNOCKOUT'
    ) {
      return true;
    }

    return (
      tournamentGroupCount > 0 &&
      fixtureGroupId === null
    );
  }
  private calculateDelta(
    goalsFor: number,
    goalsAgainst: number,
  ): SideDelta {
    if (
      goalsFor >
      goalsAgainst
    ) {
      return {
        wins: 1,
        draws: 0,
        losses: 0,
        goalsFor,
        goalsAgainst,
        goalDifference:
          goalsFor -
          goalsAgainst,
        points: 3,
        outcome: 'W',
      };
    }

    if (
      goalsFor ===
      goalsAgainst
    ) {
      return {
        wins: 0,
        draws: 1,
        losses: 0,
        goalsFor,
        goalsAgainst,
        goalDifference: 0,
        points: 1,
        outcome: 'D',
      };
    }

    return {
      wins: 0,
      draws: 0,
      losses: 1,
      goalsFor,
      goalsAgainst,
      goalDifference:
        goalsFor -
        goalsAgainst,
      points: 0,
      outcome: 'L',
    };
  }

  private async applyStanding(
    tx: any,
    tournamentId: string,
    registrationId: string,
    delta: SideDelta,
  ) {
    const current =
      await tx.tournamentStanding.findUnique({
        where: {
          tournamentId_registrationId: {
            tournamentId,
            registrationId,
          },
        },
      });

    await tx.tournamentStanding.upsert({
      where: {
        tournamentId_registrationId: {
          tournamentId,
          registrationId,
        },
      },

      create: {
        tournamentId,
        registrationId,
        played: 1,
        wins:
          delta.wins,
        draws:
          delta.draws,
        losses:
          delta.losses,
        goalsFor:
          delta.goalsFor,
        goalsAgainst:
          delta.goalsAgainst,
        goalDifference:
          delta.goalDifference,
        points:
          delta.points,
        form:
          delta.outcome,
      },

      update: {
        played: {
          increment: 1,
        },

        wins: {
          increment:
            delta.wins,
        },

        draws: {
          increment:
            delta.draws,
        },

        losses: {
          increment:
            delta.losses,
        },

        goalsFor: {
          increment:
            delta.goalsFor,
        },

        goalsAgainst: {
          increment:
            delta.goalsAgainst,
        },

        goalDifference: {
          increment:
            delta.goalDifference,
        },

        points: {
          increment:
            delta.points,
        },

        form:
          this.nextForm(
            current?.form ?? '',
            delta.outcome,
          ),
      },
    });
  }

  private async applyPlayerStatistic(
    tx: any,
    tournamentId: string,
    userId: string,
    delta: SideDelta,
  ) {
    const current =
      await tx.playerTournamentStatistic.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId,
          },
        },
      });

    await tx.playerTournamentStatistic.upsert({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId,
        },
      },

      create: {
        tournamentId,
        userId,
        matches: 1,
        wins:
          delta.wins,
        draws:
          delta.draws,
        losses:
          delta.losses,
        goalsFor:
          delta.goalsFor,
        goalsAgainst:
          delta.goalsAgainst,
        goalDifference:
          delta.goalDifference,
        form:
          delta.outcome,
      },

      update: {
        matches: {
          increment: 1,
        },

        wins: {
          increment:
            delta.wins,
        },

        draws: {
          increment:
            delta.draws,
        },

        losses: {
          increment:
            delta.losses,
        },

        goalsFor: {
          increment:
            delta.goalsFor,
        },

        goalsAgainst: {
          increment:
            delta.goalsAgainst,
        },

        goalDifference: {
          increment:
            delta.goalDifference,
        },

        form:
          this.nextForm(
            current?.form ?? '',
            delta.outcome,
          ),
      },
    });
  }

  private nextForm(
    current: string,
    outcome: Outcome,
  ) {
    return `${current}${outcome}`
      .slice(-5);
  }

  private async assertLeagueMember(
    userId: string,
    leagueId: string,
  ) {
    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_MEMBERSHIP_REQUIRED',

          message:
            'You must be a member of this League.',
        },
      });
    }
  }

  private async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!admin) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_ADMIN_REQUIRED',

          message:
            'League Admin permission is required.',
        },
      });
    }
  }

  private matchNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'MATCH_NOT_FOUND',

        message:
          'Match could not be found.',
      },
    });
  }

  private resultNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'RESULT_NOT_FOUND',

        message:
          'Result submission could not be found.',
      },
    });
  }

  private resultAlreadyRecorded() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'RESULT_ALREADY_RECORDED',

        message:
          'This match result has already been confirmed.',
      },
    });
  }
}