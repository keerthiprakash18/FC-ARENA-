import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateTournamentDto } from './dto/create-tournament.dto.js';
import type { RegisterTournamentDto } from './dto/register-tournament.dto.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTournament(
    userId: string,
    leagueId: string,
    dto: CreateTournamentDto,
  ) {
    await this.assertLeagueAdmin(userId, leagueId);

    const teamSize =
      dto.mode === 'SOLO'
        ? 1
        : dto.mode === 'DUO'
          ? 2
          : dto.teamSize ?? 4;

    if (dto.mode === 'TEAM' && !dto.teamSize) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'TEAM_SIZE_REQUIRED',
          message:
            'TEAM tournaments require a team size between 3 and 11.',
        },
      });
    }

    const code = await this.generateTournamentCode();

    const tournament = await this.prisma.tournament.create({
      data: {
        leagueId,
        createdByUserId: userId,
        name: dto.name.trim(),
        code,
        mode: dto.mode,
        format: dto.format,
        teamSize,
        maxEntries: dto.maxEntries,
        description: dto.description?.trim() || null,
        rules: dto.rules?.trim() || null,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
      },
    });

    return {
      success: true,
      data: {
        message: 'Tournament created successfully.',
        tournament,
      },
      error: null,
    };
  }

  async getLeagueTournaments(
    userId: string,
    leagueId: string,
  ) {
    await this.assertLeagueMember(userId, leagueId);

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        leagueId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            registrations: {
              where: {
                status: 'APPROVED',
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        tournaments: tournaments.map((tournament) => ({
          ...tournament,
          approvedEntries:
            tournament._count.registrations,
          _count: undefined,
        })),
      },
      error: null,
    };
  }

  async getTournament(userId: string, tournamentId: string) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        include: {
          league: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdBy: {
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
          _count: {
            select: {
              registrations: {
                where: {
                  status: 'APPROVED',
                },
              },
            },
          },
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId: tournament.leagueId,
            userId,
          },
        },
      });

    return {
      success: true,
      data: {
        tournament: {
          ...tournament,
          approvedEntries:
            tournament._count.registrations,
          isLeagueAdmin: Boolean(admin),
          _count: undefined,
        },
      },
      error: null,
    };
  }

  async openRegistration(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    if (
      tournament.status !== 'DRAFT' &&
      tournament.status !== 'REGISTRATION_CLOSED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_TOURNAMENT_STATE',
          message:
            'Registration cannot be opened from the current tournament state.',
        },
      });
    }

    const updated = await this.prisma.tournament.update({
      where: {
        id: tournament.id,
      },
      data: {
        status: 'REGISTRATION_OPEN',
        registrationOpenedAt: new Date(),
        registrationClosedAt: null,
      },
    });

    return {
      success: true,
      data: {
        message: 'Tournament registration opened.',
        tournament: updated,
      },
      error: null,
    };
  }

  async closeRegistration(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_NOT_OPEN',
          message:
            'Tournament registration is not currently open.',
        },
      });
    }

    const updated = await this.prisma.tournament.update({
      where: {
        id: tournament.id,
      },
      data: {
        status: 'REGISTRATION_CLOSED',
        registrationClosedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        message: 'Tournament registration closed.',
        tournament: updated,
      },
      error: null,
    };
  }

  async register(
    userId: string,
    tournamentId: string,
    dto: RegisterTournamentDto,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_CLOSED',
          message:
            'Tournament registration is not currently open.',
        },
      });
    }

    const playerCodes = [
      ...new Set(
        dto.playerCodes.map((code) =>
          code.trim().toUpperCase(),
        ),
      ),
    ];

    if (playerCodes.length !== tournament.teamSize) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_ENTRY_SIZE',
          message: `This tournament requires exactly ${tournament.teamSize} player(s) per entry.`,
        },
      });
    }

    const players = await this.prisma.player.findMany({
      where: {
        playerCode: {
          in: playerCodes,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        identity: {
          select: {
            inGameName: true,
          },
        },
      },
    });

    if (players.length !== playerCodes.length) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'PLAYER_NOT_FOUND',
          message:
            'One or more FC ARENA Player IDs could not be found.',
        },
      });
    }

    const userIds = players.map(
      (player) => player.userId,
    );

    if (!userIds.includes(userId)) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'CAPTAIN_MUST_PARTICIPATE',
          message:
            'The player submitting the registration must be part of the entry.',
        },
      });
    }

    const leagueMemberships =
      await this.prisma.leagueMember.count({
        where: {
          leagueId: tournament.leagueId,
          userId: {
            in: userIds,
          },
        },
      });

    if (leagueMemberships !== userIds.length) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'PLAYER_NOT_IN_LEAGUE',
          message:
            'Every tournament participant must be a member of this League.',
        },
      });
    }

    const existingMembers =
      await this.prisma.tournamentRegistrationMember.findMany({
        where: {
          tournamentId,
          userId: {
            in: userIds,
          },
        },
        select: {
          userId: true,
        },
      });

    if (existingMembers.length > 0) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'PLAYER_ALREADY_REGISTERED',
          message:
            'One or more players are already registered in this tournament.',
        },
      });
    }

    const registration = await this.prisma.$transaction(
      async (tx) => {
        const created =
          await tx.tournamentRegistration.create({
            data: {
              tournamentId,
              registeredByUserId: userId,
              entryName:
                dto.entryName?.trim() ||
                (tournament.mode === 'SOLO'
                  ? players[0]?.identity?.inGameName ??
                    players[0]?.user.fullName
                  : null),
              status: 'PENDING',
            },
          });

        await tx.tournamentRegistrationMember.createMany({
          data: userIds.map((memberUserId) => ({
            tournamentId,
            registrationId: created.id,
            userId: memberUserId,
          })),
        });

        return created;
      },
    );

    return {
      success: true,
      data: {
        message:
          'Tournament registration submitted for admin approval.',
        registration,
      },
      error: null,
    };
  }

  async getRegistrations(
    userId: string,
    tournamentId: string,
  ) {
    await this.getTournamentForAdmin(
      userId,
      tournamentId,
    );

    const registrations =
      await this.prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          registeredBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
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

    return {
      success: true,
      data: {
        registrations,
      },
      error: null,
    };
  }

  async approveRegistration(
    adminUserId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    await this.getTournamentForAdmin(
      adminUserId,
      tournamentId,
    );

    const result = await this.prisma.$transaction(
      async (tx) => {
        const registration =
          await tx.tournamentRegistration.findUnique({
            where: {
              id: registrationId,
            },
          });

        if (
          !registration ||
          registration.tournamentId !== tournamentId
        ) {
          throw new NotFoundException({
            success: false,
            data: null,
            error: {
              code: 'REGISTRATION_NOT_FOUND',
              message:
                'Tournament registration could not be found.',
            },
          });
        }

        if (registration.status !== 'PENDING') {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code: 'REGISTRATION_NOT_PENDING',
              message:
                'This registration is no longer pending.',
            },
          });
        }

        const tournament =
          await tx.tournament.findUniqueOrThrow({
            where: {
              id: tournamentId,
            },
          });

        const approvedCount =
          await tx.tournamentRegistration.count({
            where: {
              tournamentId,
              status: 'APPROVED',
            },
          });

        if (approvedCount >= tournament.maxEntries) {
          throw new ConflictException({
            success: false,
            data: null,
            error: {
              code: 'TOURNAMENT_FULL',
              message:
                'The tournament has reached its entry limit.',
            },
          });
        }

        return tx.tournamentRegistration.update({
          where: {
            id: registration.id,
          },
          data: {
            status: 'APPROVED',
            reviewedByUserId: adminUserId,
            reviewedAt: new Date(),
          },
        });
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    return {
      success: true,
      data: {
        message: 'Tournament registration approved.',
        registration: result,
      },
      error: null,
    };
  }

  async rejectRegistration(
    adminUserId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    await this.getTournamentForAdmin(
      adminUserId,
      tournamentId,
    );

    const registration =
      await this.prisma.tournamentRegistration.findUnique({
        where: {
          id: registrationId,
        },
      });

    if (
      !registration ||
      registration.tournamentId !== tournamentId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message:
            'Tournament registration could not be found.',
        },
      });
    }

    if (registration.status !== 'PENDING') {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'REGISTRATION_NOT_PENDING',
          message:
            'This registration is no longer pending.',
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.tournamentRegistrationMember.deleteMany({
        where: {
          registrationId,
        },
      }),
      this.prisma.tournamentRegistration.update({
        where: {
          id: registrationId,
        },
        data: {
          status: 'REJECTED',
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      data: {
        message: 'Tournament registration rejected.',
      },
      error: null,
    };
  }

  private async getTournamentForAdmin(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueAdmin(
      userId,
      tournament.leagueId,
    );

    return tournament;
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
          code: 'LEAGUE_MEMBERSHIP_REQUIRED',
          message:
            'You must be a League member to access this tournament.',
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
          code: 'LEAGUE_ADMIN_REQUIRED',
          message:
            'League admin permission is required.',
        },
      });
    }
  }

  private async generateTournamentCode() {
    for (let attempt = 0; attempt < 20; attempt++) {
      let suffix = '';

      for (let i = 0; i < 6; i++) {
        suffix +=
          CODE_ALPHABET[
            randomInt(0, CODE_ALPHABET.length)
          ];
      }

      const code = `FCA-T-${suffix}`;

      const exists =
        await this.prisma.tournament.findUnique({
          where: {
            code,
          },
          select: {
            id: true,
          },
        });

      if (!exists) {
        return code;
      }
    }

    throw new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'TOURNAMENT_CODE_FAILED',
        message:
          'Unable to generate a unique tournament code.',
      },
    });
  }

  private tournamentNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code: 'TOURNAMENT_NOT_FOUND',
        message: 'Tournament could not be found.',
      },
    });
  }
}