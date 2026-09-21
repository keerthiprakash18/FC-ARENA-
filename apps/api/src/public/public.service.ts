import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getTournament(
    code: string,
  ) {
    const tournament =
      await this.prisma.tournament.findFirst({
        where: {
          code:
            code.trim(),

          visibility:
            'PUBLIC',
        },

        include: {
          league: {
            select: {
              id: true,
              name: true,
              code: true,
              logoUrl: true,
              region: true,
            },
          },

          groups: {
            orderBy: {
              position:
                'asc',
            },

            include: {
              registrations: {
                where: {
                  status:
                    'APPROVED',
                },

                orderBy: {
                  sortOrder:
                    'asc',
                },

                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          fullName:
                            true,

                          player: {
                            select: {
                              playerCode:
                                true,

                              profileImageUrl:
                                true,

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
                  },
                },
              },
            },
          },

          fixtures: {
            orderBy: {
              sequence:
                'asc',
            },

            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },

              homeRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          fullName:
                            true,

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
                  },
                },
              },

              awayRegistration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          fullName:
                            true,

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
                  },
                },
              },

              match: {
                include: {
                  confirmedResult: {
                    select: {
                      homeScore:
                        true,

                      awayScore:
                        true,

                      reviewedAt:
                        true,

                      updatedAt:
                        true,
                    },
                  },
                },
              },
            },
          },

          standings: {
            orderBy: [
              {
                points:
                  'desc',
              },

              {
                goalDifference:
                  'desc',
              },

              {
                goalsFor:
                  'desc',
              },

              {
                wins:
                  'desc',
              },
            ],

            include: {
              registration: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: {
                          fullName:
                            true,

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
                  },
                },
              },
            },
          },

          playerStatistics: {
            orderBy: [
              {
                wins:
                  'desc',
              },

              {
                goalDifference:
                  'desc',
              },

              {
                goalsFor:
                  'desc',
              },
            ],

            take: 10,

            include: {
              user: {
                select: {
                  fullName:
                    true,

                  player: {
                    select: {
                      playerCode:
                        true,

                      profileImageUrl:
                        true,

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
          },
        },
      });

    if (!tournament) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'PUBLIC_TOURNAMENT_NOT_FOUND',

          message:
            'Public Tournament could not be found.',
        },
      });
    }

    const registrationName =
      (
        registration:
          any,
      ) =>
        registration
          ?.entryName ||
        registration
          ?.members
          ?.map(
            (
              member:
                any,
            ) =>
              member.user
                .player
                ?.identity
                ?.inGameName ||
              member.user
                .fullName,
          )
          .join(' + ') ||
        'TBD';

    return {
      success: true,

      data: {
        tournament: {
          id:
            tournament.id,

          code:
            tournament.code,

          name:
            tournament.name,

          logoUrl:
            tournament.logoUrl,

          description:
            tournament.description,

          rules:
            tournament.rules,

          mode:
            tournament.mode,

          format:
            tournament.format,

          competitionFormat:
            tournament.competitionFormat,

          status:
            tournament.status,

          startAt:
            tournament.startAt,

          endAt:
            tournament.endAt,

          qualifiersPerGroup:
            tournament.qualifiersPerGroup,

          league:
            tournament.league,
        },

        groups:
          tournament.groups.map(
            (
              group,
            ) => ({
              id:
                group.id,

              name:
                group.name,

              position:
                group.position,

              entries:
                group.registrations.map(
                  (
                    registration,
                  ) => ({
                    id:
                      registration.id,

                    name:
                      registrationName(
                        registration,
                      ),

                    logoUrl:
                      registration.entryLogoUrl,

                    members:
                      registration.members.map(
                        (
                          member,
                        ) => ({
                          name:
                            member.user
                              .player
                              ?.identity
                              ?.inGameName ||
                            member.user
                              .fullName,

                          playerCode:
                            member.user
                              .player
                              ?.playerCode ??
                            null,
                        }),
                      ),
                  }),
                ),
            }),
          ),

        fixtures:
          tournament.fixtures.map(
            (
              fixture,
            ) => ({
              id:
                fixture.id,

              fixtureCode:
                fixture.fixtureCode,

              roundName:
                fixture.roundName,

              roundNumber:
                fixture.roundNumber,

              matchday:
                fixture.matchday,

              scheduledAt:
                fixture.scheduledAt,

              venue:
                fixture.venue,

              status:
                fixture.match
                  ?.status ||
                fixture.status,

              group:
                fixture.group,

              home:
                registrationName(
                  fixture.homeRegistration,
                ),

              away:
                registrationName(
                  fixture.awayRegistration,
                ),

              result:
                fixture.match
                  ?.confirmedResult
                  ? {
                      homeScore:
                        fixture.match
                          .confirmedResult
                          .homeScore,

                      awayScore:
                        fixture.match
                          .confirmedResult
                          .awayScore,
                    }
                  : null,
            }),
          ),

        standings:
          tournament.standings.map(
            (
              standing,
              index,
            ) => ({
              position:
                index + 1,

              registrationId:
                standing.registrationId,

              name:
                registrationName(
                  standing.registration,
                ),

              played:
                standing.played,

              wins:
                standing.wins,

              draws:
                standing.draws,

              losses:
                standing.losses,

              goalsFor:
                standing.goalsFor,

              goalsAgainst:
                standing.goalsAgainst,

              goalDifference:
                standing.goalDifference,

              points:
                standing.points,

              form:
                standing.form,
            }),
          ),

        topPlayers:
          tournament.playerStatistics.map(
            (
              statistic,
              index,
            ) => ({
              position:
                index + 1,

              name:
                statistic.user
                  .player
                  ?.identity
                  ?.inGameName ||
                statistic.user
                  .fullName,

              playerCode:
                statistic.user
                  .player
                  ?.playerCode ??
                null,

              profileImageUrl:
                statistic.user
                  .player
                  ?.profileImageUrl ??
                null,

              matches:
                statistic.matches,

              wins:
                statistic.wins,

              goalsFor:
                statistic.goalsFor,

              goalDifference:
                statistic.goalDifference,
            }),
          ),
      },

      error: null,
    };
  }
}
