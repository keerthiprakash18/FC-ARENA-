import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import {
  deduplicateFixtureRecords,
  isCanonicalCompletedFixture,
} from '../tournaments/fixture-deduplication.js';
import {
  canonicalizeRoundRobinStandingsFixtures,
} from './standings-integrity.js';
import type { CorrectResultDto } from './dto/correct-result.dto.js';
import type { ReverseResultDto } from './dto/reverse-result.dto.js';

type Outcome = 'W' | 'D' | 'L';

interface SideDelta {
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
export class ResultCorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization:
      AuthorizationService,
  ) {}

  async correctResult(
    adminUserId: string,
    matchId: string,
    dto: CorrectResultDto,
  ) {
    const initialMatch =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },
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
        },
      });

    if (!initialMatch) {
      throw this.matchNotFound();
    }

    await this.authorization.assertCanVerifyResult(
      adminUserId,
      matchId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const match =
          await tx.match.findUnique({
            where: {
              id: matchId,
            },

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

              confirmedResult: true,

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

                  nextFixture: {
                    include: {
                      match: true,
                    },
                  },
                },
              },
            },
          });

        if (!match) {
          throw this.matchNotFound();
        }

        if (!match.confirmedResult) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code: 'NO_CONFIRMED_RESULT',
              message:
                'This match does not have a confirmed result to correct.',
            },
          });
        }

        const fixture = match.fixture;

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
                'Both participants must be resolved before correcting the result.',
            },
          });
        }

        if (
          this.isKnockoutFixture(
            match.tournament.format,
            match.fixture.groupId,
            match.tournament._count.groups,
          ) &&
          dto.homeScore ===
            dto.awayScore
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

        const oldResult =
          match.confirmedResult;

        const oldWinner =
          this.getWinnerRegistrationId(
            home.id,
            away.id,
            oldResult.homeScore,
            oldResult.awayScore,
          );

        const newWinner =
          this.getWinnerRegistrationId(
            home.id,
            away.id,
            dto.homeScore,
            dto.awayScore,
          );

        if (
          this.isKnockoutFixture(
            match.tournament.format,
            match.fixture.groupId,
            match.tournament._count.groups,
          ) &&
          oldWinner !== newWinner
        ) {
          await this.updateKnockoutProgression(
            tx,
            fixture,
            oldWinner,
            newWinner,
          );
        }

        const existingReverse =
          await tx.matchResultStatEvent.findUnique({
            where: {
              resultSubmissionId_type: {
                resultSubmissionId:
                  oldResult.id,
                type: 'REVERSE',
              },
            },
          });

        if (!existingReverse) {
          await tx.matchResultStatEvent.create({
            data: {
              tournamentId:
                match.tournamentId,

              matchId:
                match.id,

              resultSubmissionId:
                oldResult.id,

              type: 'REVERSE',

              payload: {
                reason:
                  dto.reason,

                previousResult: {
                  homeScore:
                    oldResult.homeScore,

                  awayScore:
                    oldResult.awayScore,
                },

                correctedByUserId:
                  adminUserId,
              },
            },
          });
        }

        await tx.resultSubmission.update({
          where: {
            id:
              oldResult.id,
          },

          data: {
            status:
              'REJECTED',

            rejectionReason:
              `Corrected by admin: ${dto.reason}`,

            reviewedByUserId:
              adminUserId,

            reviewedAt:
              new Date(),
          },
        });

        const correctedResult =
          await tx.resultSubmission.create({
            data: {
              matchId:
                match.id,

              submittedByUserId:
                adminUserId,

              homeScore:
                dto.homeScore,

              awayScore:
                dto.awayScore,

              status:
                'CONFIRMED',

              reviewedByUserId:
                adminUserId,

              reviewedAt:
                new Date(),
            },
          });

        const homeDelta =
          this.calculateDelta(
            dto.homeScore,
            dto.awayScore,
          );

        const awayDelta =
          this.calculateDelta(
            dto.awayScore,
            dto.homeScore,
          );

        await tx.matchResultStatEvent.create({
          data: {
            tournamentId:
              match.tournamentId,

            matchId:
              match.id,

            resultSubmissionId:
              correctedResult.id,

            type: 'APPLY',

            payload: {
              correctionReason:
                dto.reason,

              home: {
                registrationId:
                  home.id,

                score:
                  dto.homeScore,

                delta: {
                  wins:
                    homeDelta.wins,

                  draws:
                    homeDelta.draws,

                  losses:
                    homeDelta.losses,

                  goalsFor:
                    homeDelta.goalsFor,

                  goalsAgainst:
                    homeDelta.goalsAgainst,

                  goalDifference:
                    homeDelta.goalDifference,

                  points:
                    homeDelta.points,

                  outcome:
                    homeDelta.outcome,
                },

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
                  dto.awayScore,

                delta: {
                  wins:
                    awayDelta.wins,

                  draws:
                    awayDelta.draws,

                  losses:
                    awayDelta.losses,

                  goalsFor:
                    awayDelta.goalsFor,

                  goalsAgainst:
                    awayDelta.goalsAgainst,

                  goalDifference:
                    awayDelta.goalDifference,

                  points:
                    awayDelta.points,

                  outcome:
                    awayDelta.outcome,
                },

                userIds:
                  away.members.map(
                    (member) =>
                      member.userId,
                  ),
              },
            },
          },
        });

        await tx.match.update({
          where: {
            id:
              match.id,
          },

          data: {
            confirmedResultSubmissionId:
              correctedResult.id,

            status:
              'COMPLETED',
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

        await this.rebuildTournamentStatistics(
          tx,
          match.tournamentId,
        );

        return {
          success: true,

          data: {
            message:
              'Result corrected successfully. Old statistics were reversed and standings were recalculated.',

            result: {
              id:
                correctedResult.id,

              homeScore:
                correctedResult.homeScore,

              awayScore:
                correctedResult.awayScore,
            },
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

  async reverseResult(
    adminUserId: string,
    matchId: string,
    dto: ReverseResultDto,
  ) {
    const initialMatch =
      await this.prisma.match.findUnique({
        where: {
          id:
            matchId,
        },

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
        },
      });

    if (!initialMatch) {
      throw this.matchNotFound();
    }

    await this.authorization.assertCanVerifyResult(
      adminUserId,
      matchId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const match =
          await tx.match.findUnique({
            where: {
              id:
                matchId,
            },

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

              confirmedResult: true,

              fixture: {
                include: {
                  homeRegistration: true,
                  awayRegistration: true,

                  nextFixture: {
                    include: {
                      match: true,
                    },
                  },
                },
              },
            },
          });

        if (!match) {
          throw this.matchNotFound();
        }

        if (!match.confirmedResult) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code:
                'NO_CONFIRMED_RESULT',

              message:
                'There is no confirmed result to reverse.',
            },
          });
        }

        const home =
          match.fixture
            .homeRegistration;

        const away =
          match.fixture
            .awayRegistration;

        if (!home || !away) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code:
                'MATCH_PARTICIPANTS_NOT_READY',

              message:
                'Match participants are not available.',
            },
          });
        }

        const oldResult =
          match.confirmedResult;

        const oldWinner =
          this.getWinnerRegistrationId(
            home.id,
            away.id,
            oldResult.homeScore,
            oldResult.awayScore,
          );

        if (
          this.isKnockoutFixture(
            match.tournament.format,
            match.fixture.groupId,
            match.tournament._count.groups,
          ) &&
          oldWinner
        ) {
          await this.updateKnockoutProgression(
            tx,
            match.fixture,
            oldWinner,
            null,
          );
        }

        const existingReverse =
          await tx.matchResultStatEvent.findUnique({
            where: {
              resultSubmissionId_type: {
                resultSubmissionId:
                  oldResult.id,

                type:
                  'REVERSE',
              },
            },
          });

        if (!existingReverse) {
          await tx.matchResultStatEvent.create({
            data: {
              tournamentId:
                match.tournamentId,

              matchId:
                match.id,

              resultSubmissionId:
                oldResult.id,

              type:
                'REVERSE',

              payload: {
                reason:
                  dto.reason,

                removedResult: {
                  homeScore:
                    oldResult.homeScore,

                  awayScore:
                    oldResult.awayScore,
                },

                reversedByUserId:
                  adminUserId,
              },
            },
          });
        }

        await tx.resultSubmission.update({
          where: {
            id:
              oldResult.id,
          },

          data: {
            status:
              'REJECTED',

            rejectionReason:
              `Result reversed by admin: ${dto.reason}`,

            reviewedByUserId:
              adminUserId,

            reviewedAt:
              new Date(),
          },
        });

        const restoredMatchStatus =
          match.fixture.scheduledAt
            ? 'SCHEDULED'
            : 'UNSCHEDULED';

        const restoredFixtureStatus =
          match.fixture.scheduledAt
            ? 'SCHEDULED'
            : 'UNSCHEDULED';

        await tx.match.update({
          where: {
            id:
              match.id,
          },

          data: {
            confirmedResultSubmissionId:
              null,

            status:
              restoredMatchStatus,
          },
        });

        await tx.fixture.update({
          where: {
            id:
              match.fixture.id,
          },

          data: {
            status:
              restoredFixtureStatus,
          },
        });

        const activeResultCount =
          await this.rebuildTournamentStatistics(
            tx,
            match.tournamentId,
          );

        if (
          activeResultCount === 0 &&
          match.tournament.status ===
            'ACTIVE'
        ) {
          await tx.tournament.update({
            where: {
              id:
                match.tournamentId,
            },

            data: {
              status:
                'REGISTRATION_CLOSED',
            },
          });
        }

        return {
          success: true,

          data: {
            message:
              'Confirmed result reversed successfully. Statistics and standings were rebuilt.',
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

  private async rebuildTournamentStatistics(
    tx: any,
    tournamentId: string,
  ) {
    const tournament =
      await tx.tournament.findUnique({
        where: {
          id: tournamentId,
        },

        select: {
          format: true,
          competitionFormat:
            true,
          legType:
            true,

          _count: {
            select: {
              groups: true,
            },
          },
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

    const registrations =
      await tx.tournamentRegistration.findMany({
        where: {
          tournamentId,
          status:
            'APPROVED',
        },

        select: {
          id: true,
          groupId: true,
        },
      });

    const activeMatches =
      await tx.match.findMany({
        where: {
          tournamentId,

          confirmedResultSubmissionId: {
            not: null,
          },
        },

        orderBy: {
          updatedAt:
            'asc',
        },

        include: {
          confirmedResult:
            true,

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

    const canonicalMatches =
      deduplicateFixtureRecords(
        activeMatches
          .map(
            (match: any) => ({
              ...match.fixture,

              match: {
                status:
                  match.status,

                confirmedResultSubmissionId:
                  match.confirmedResultSubmissionId,

                confirmedResult:
                  match.confirmedResult
                    ? {
                        id:
                          match.confirmedResult.id,

                        status:
                          match.confirmedResult.status,
                      }
                    : null,
              },

              sourceMatch:
                match,
            }),
          )
          .filter(
            isCanonicalCompletedFixture,
          ),
        tournament.competitionFormat,
        tournament.legType,
      ).map(
        (fixture: any) =>
          fixture.sourceMatch,
      );

    const standingFixtureIds =
      new Set(
        canonicalizeRoundRobinStandingsFixtures(
          canonicalMatches.map(
            (match: any) =>
              match.fixture,
          ),
          registrations,
          {
            competitionFormat:
              tournament.competitionFormat,
            legType:
              tournament.legType,
            tournamentFormat:
              tournament.format,
            hasGroups:
              tournament._count.groups >
              0,
          },
        ).map(
          (fixture) =>
            fixture.id,
        ),
      );

    await tx.tournamentStanding.deleteMany({
      where: {
        tournamentId,
      },
    });

    await tx.playerTournamentStatistic.deleteMany({
      where: {
        tournamentId,
      },
    });

    for (
      const match of canonicalMatches
    ) {
      const result =
        match.confirmedResult;

      const home =
        match.fixture
          .homeRegistration;

      const away =
        match.fixture
          .awayRegistration;

      if (
        !result ||
        !home ||
        !away
      ) {
        continue;
      }

      const homeDelta =
        this.calculateDelta(
          result.homeScore,
          result.awayScore,
        );

      const awayDelta =
        this.calculateDelta(
          result.awayScore,
          result.homeScore,
        );

      const countsForStandings =
        standingFixtureIds.has(
          match.fixture.id,
        );

      if (
        countsForStandings
      ) {
        await this.applyStanding(
          tx,
          tournamentId,
          home.id,
          homeDelta,
        );

        await this.applyStanding(
          tx,
          tournamentId,
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
          tournamentId,
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
          tournamentId,
          member.userId,
          awayDelta,
        );
      }
    }

    return canonicalMatches.length;
  }

  private async updateKnockoutProgression(
    tx: any,
    fixture: any,
    oldWinnerRegistrationId:
      string | null,
    newWinnerRegistrationId:
      string | null,
  ) {
    if (
      !fixture.nextFixtureId ||
      !fixture.nextSlot
    ) {
      return;
    }

    const nextFixture =
      fixture.nextFixture;

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
      nextFixture.status ===
        'LIVE' ||
      nextFixture.status ===
        'COMPLETED' ||
      nextFixture.match
        ?.confirmedResultSubmissionId
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'DOWNSTREAM_MATCH_LOCKED',

          message:
            'This result cannot be changed because the next Knockout match has already started or been completed.',
        },
      });
    }

    if (
      fixture.nextSlot ===
      'HOME'
    ) {
      if (
        oldWinnerRegistrationId &&
        nextFixture.homeRegistrationId &&
        nextFixture.homeRegistrationId !==
          oldWinnerRegistrationId
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code:
              'KNOCKOUT_SLOT_MISMATCH',

            message:
              'The next Knockout HOME slot no longer matches the previous winner.',
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
            newWinnerRegistrationId,
        },
      });

      return;
    }

    if (
      oldWinnerRegistrationId &&
      nextFixture.awayRegistrationId &&
      nextFixture.awayRegistrationId !==
        oldWinnerRegistrationId
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'KNOCKOUT_SLOT_MISMATCH',

        message:
            'The next Knockout AWAY slot no longer matches the previous winner.',
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
          newWinnerRegistrationId,
      },
    });
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
  private getWinnerRegistrationId(
    homeRegistrationId: string,
    awayRegistrationId: string,
    homeScore: number,
    awayScore: number,
  ) {
    if (
      homeScore ===
      awayScore
    ) {
      return null;
    }

    return homeScore >
      awayScore
      ? homeRegistrationId
      : awayRegistrationId;
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
}