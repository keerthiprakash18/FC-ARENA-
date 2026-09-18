import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getMatch(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },

        include: {
          tournament: {
            include: {
              league: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },

          fixture: {
            include: {
              homeRegistration: {
                include: {
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
              },

              awayRegistration: {
                include: {
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
              },

              previousFixtures: {
                select: {
                  fixtureCode: true,
                  nextSlot: true,
                },
              },
            },
          },
        },
      });

    if (!match) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'MATCH_NOT_FOUND',
          message:
            'Match could not be found.',
        },
      });
    }

    const membership =
      await this.prisma.leagueMember.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              match.tournament.leagueId,
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
            'You must be a League member to access this Match Center.',
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

    const homeSource =
      match.fixture.previousFixtures.find(
        (fixture) =>
          fixture.nextSlot ===
          'HOME',
      );

    const awaySource =
      match.fixture.previousFixtures.find(
        (fixture) =>
          fixture.nextSlot ===
          'AWAY',
      );

    return {
      success: true,

      data: {
        match: {
          id: match.id,
          matchCode:
            match.matchCode,
          status:
            match.status,

          tournament: {
            id:
              match.tournament.id,

            name:
              match.tournament.name,

            mode:
              match.tournament.mode,

            format:
              match.tournament.format,
          },

          league:
            match.tournament.league,

          fixture: {
            id:
              match.fixture.id,

            fixtureCode:
              match.fixture.fixtureCode,

            roundName:
              match.fixture.roundName,

            roundNumber:
              match.fixture.roundNumber,

            matchday:
              match.fixture.matchday,

            scheduledAt:
              match.fixture.scheduledAt,

            venue:
              match.fixture.venue,

            status:
              match.fixture.status,

            home:
              this.mapEntry(
                match.fixture
                  .homeRegistration,
              ),

            away:
              this.mapEntry(
                match.fixture
                  .awayRegistration,
              ),

            homeSource:
              homeSource
                ? homeSource.fixtureCode
                : null,

            awaySource:
              awaySource
                ? awaySource.fixtureCode
                : null,
          },

          isLeagueAdmin:
            Boolean(admin),
        },
      },

      error: null,
    };
  }

  private mapEntry(
    registration: any,
  ) {
    if (!registration) {
      return null;
    }

    return {
      id:
        registration.id,

      entryName:
        registration.entryName,

      members:
        registration.members.map(
          (member: any) => ({
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
    };
  }
}