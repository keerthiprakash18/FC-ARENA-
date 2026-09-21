import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { CreateTournamentDto } from './dto/create-tournament.dto.js';
import type { DeleteTournamentDto } from './dto/delete-tournament.dto.js';
import type { UpdateTournamentSetupDto } from './dto/update-tournament-setup.dto.js';
import type { UpdateTournamentWizardStepDto } from './dto/update-tournament-wizard-step.dto.js';
import type { RegisterTournamentDto } from './dto/register-tournament.dto.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService:
      AuthorizationService,
  ) {}

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

        format:
          this.resolveLegacyFormat(
            dto.competitionFormat,
            dto.format,
          ),

        competitionFormat:
          dto.competitionFormat ??
          this.resolveCompetitionFormat(
            dto.format,
          ),

        groupMode:
          dto.groupMode ??
          (dto.competitionFormat ===
          'GROUP_STAGE_KNOCKOUT'
            ? 'MULTIPLE_GROUPS'
            : 'SINGLE_GROUP'),

        legType:
          dto.competitionFormat ===
          'DOUBLE_ROUND_ROBIN'
            ? 'HOME_AWAY'
            : dto.legType ??
              'SINGLE_LEG',

        fixtureMode:
          dto.competitionFormat ===
          'CUSTOM_MANUAL'
            ? 'MANUAL'
            : dto.fixtureMode ??
              'AUTOMATIC',

        visibility:
          dto.visibility ??
          'LEAGUE',

        registrationMode:
          dto.registrationMode ??
          'APPROVAL',

        wizardStep:
          'SETUP',

        teamSize,
        maxEntries: dto.maxEntries,

        description:
          dto.description?.trim() ||
          null,

        rules:
          dto.rules?.trim() ||
          null,

        logoUrl:
          dto.logoUrl?.trim() ||
          null,

        startAt:
          dto.startAt
            ? new Date(dto.startAt)
            : null,

        endAt:
          dto.endAt
            ? new Date(dto.endAt)
            : null,
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

  async deleteTournament(
    userId: string,
    tournamentId: string,
    dto: DeleteTournamentDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    if (
      dto.confirmName.trim().toLocaleLowerCase() !==
      tournament.name.trim().toLocaleLowerCase()
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_DELETE_CONFIRMATION_MISMATCH',
          message:
            'Tournament name confirmation does not match.',
        },
      });
    }

    const counts =
      await this.prisma.tournament.findUnique({
        where: {
          id: tournamentId,
        },
        select: {
          _count: {
            select: {
              registrations: true,
              fixtures: true,
              matches: true,
              groups: true,
            },
          },
        },
      });

    await this.prisma.tournament.delete({
      where: {
        id: tournamentId,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Tournament deleted successfully.',
        deletedTournament: {
          id:
            tournament.id,
          name:
            tournament.name,
          registrations:
            counts?._count.registrations ?? 0,
          fixtures:
            counts?._count.fixtures ?? 0,
          matches:
            counts?._count.matches ?? 0,
          groups:
            counts?._count.groups ?? 0,
        },
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

    const canManageTournament =
      await this.authorizationService.canManageTournament(
        userId,
        tournamentId,
      );

    return {
      success: true,
      data: {
        tournament: {
          ...tournament,
          approvedEntries:
            tournament._count.registrations,
          isLeagueAdmin:
            canManageTournament,
          canManageTournament,
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

    if (tournament.registrationMode === 'ADMIN_ONLY') {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'SELF_REGISTRATION_DISABLED',
          message:
            'This Tournament only allows admins to add entries.',
        },
      });
    }

    const currentPlayer =
      await this.prisma.player.findUnique({
        where: {
          userId,
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

    if (!currentPlayer) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'PLAYER_PROFILE_REQUIRED',
          message:
            'Create your FC ARENA Player profile before joining a Tournament.',
        },
      });
    }

    const isIndividualEntry =
      tournament.teamSize === 1;

    if (
      isIndividualEntry &&
      !currentPlayer.identity?.inGameName
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'IN_GAME_NAME_REQUIRED',
          message:
            'Add your Game Name to your FC ARENA profile before joining this Tournament.',
        },
      });
    }

    if (
      dto.inGameName &&
      currentPlayer.identity?.inGameName &&
      dto.inGameName
        .trim()
        .toLocaleLowerCase() !==
        currentPlayer.identity.inGameName
          .trim()
          .toLocaleLowerCase()
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'GAME_NAME_MISMATCH',
          message:
            'Game Name must match the Game Name saved in your FC ARENA profile.',
        },
      });
    }

    const playerCodes =
      isIndividualEntry
        ? [
            currentPlayer.playerCode,
          ]
        : [
            ...new Set(
              (
                dto.playerCodes ??
                []
              ).map(
                (code) =>
                  code
                    .trim()
                    .toUpperCase(),
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

    const players =
      await this.prisma.player.findMany({
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

    const userIds =
      players.map(
        (player) =>
          player.userId,
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
          leagueId:
            tournament.leagueId,

          userId: {
            in:
              userIds,
          },
        },
      });

    if (
      leagueMemberships !==
      userIds.length
    ) {
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
            in:
              userIds,
          },
        },

        select: {
          userId: true,
        },
      });

    if (
      existingMembers.length >
      0
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'PLAYER_ALREADY_REGISTERED',
          message:
            'One or more players already have an active registration in this Tournament.',
        },
      });
    }

    const autoApprove =
      tournament.registrationMode ===
      'OPEN';

    const registration =
      await this.prisma.$transaction(
        async (tx) => {
          if (autoApprove) {
            const approvedCount =
              await tx.tournamentRegistration.count({
                where: {
                  tournamentId,
                  status:
                    'APPROVED',
                },
              });

            if (
              approvedCount >=
              tournament.maxEntries
            ) {
              throw new ConflictException({
                success: false,
                data: null,
                error: {
                  code:
                    'TOURNAMENT_FULL',
                  message:
                    'The Tournament has reached its entry limit.',
                },
              });
            }
          }

          const created =
            await tx.tournamentRegistration.create({
              data: {
                tournamentId,

                registeredByUserId:
                  userId,

                entryName:
                  dto.entryName
                    ?.trim() ||
                  (
                    isIndividualEntry
                      ? currentPlayer
                          .identity
                          ?.inGameName ??
                        currentPlayer
                          .user
                          .fullName
                      : null
                  ),

                status:
                  autoApprove
                    ? 'APPROVED'
                    : 'PENDING',
              },
            });

          await tx.tournamentRegistrationMember.createMany({
            data:
              userIds.map(
                (
                  memberUserId,
                ) => ({
                  tournamentId,
                  registrationId:
                    created.id,
                  userId:
                    memberUserId,
                }),
              ),
          });

          return created;
        },
        {
          isolationLevel:
            'Serializable',
        },
      );

    return {
      success: true,
      data: {
        message:
          autoApprove
            ? 'Tournament registration approved automatically.'
            : 'Tournament registration submitted for admin approval.',
        registration,
      },
      error: null,
    };
  }


  async getMyRegistration(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.prisma.tournament.findUnique({
        where: {
          id:
            tournamentId,
        },

        select: {
          leagueId:
            true,
        },
      });

    if (!tournament) {
      throw this.tournamentNotFound();
    }

    await this.assertLeagueMember(
      userId,
      tournament.leagueId,
    );

    const registration =
      await this.prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId,

          OR: [
            {
              registeredByUserId:
                userId,
            },
            {
              members: {
                some: {
                  userId,
                },
              },
            },
          ],
        },

        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          registeredBy: {
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

          members: {
            include: {
              user: {
                select: {
                  id:
                    true,
                  fullName:
                    true,

                  player: {
                    select: {
                      playerCode:
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

    return {
      success: true,

      data: {
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


  async getTournamentWizard(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    return {
      success: true,

      data: {
        tournamentId:
          tournament.id,

        currentStep:
          tournament.wizardStep,

        steps:
          this.buildWizardSteps(
            tournament,
          ),

        configuration: {
          competitionFormat:
            tournament.competitionFormat,

          groupMode:
            tournament.groupMode,

          legType:
            tournament.legType,

          fixtureMode:
            tournament.fixtureMode,

          visibility:
            tournament.visibility,

          registrationMode:
            tournament.registrationMode,

          maxEntries:
            tournament.maxEntries,

          startAt:
            tournament.startAt,

          endAt:
            tournament.endAt,

          publishedAt:
            tournament.publishedAt,
        },
      },

      error: null,
    };
  }


  async updateTournamentSetup(
    userId: string,
    tournamentId: string,
    dto: UpdateTournamentSetupDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    if (
      tournament.status !==
      'DRAFT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_SETUP_LOCKED',

          message:
            'Tournament setup can only be edited while the Tournament is in Draft.',
        },
      });
    }

    const competitionFormat =
      dto.competitionFormat ??
      tournament.competitionFormat;

    const groupMode =
      dto.groupMode ??
      tournament.groupMode;

    if (
      competitionFormat ===
        'GROUP_STAGE_KNOCKOUT' &&
      groupMode !==
        'MULTIPLE_GROUPS'
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'GROUP_STAGE_REQUIRES_GROUPS',

          message:
            'Group Stage + Knockout requires Multiple Groups.',
        },
      });
    }

    const startAt =
      dto.startAt
        ? new Date(
            dto.startAt,
          )
        : tournament.startAt;

    const endAt =
      dto.endAt
        ? new Date(
            dto.endAt,
          )
        : tournament.endAt;

    if (
      startAt &&
      endAt &&
      endAt.getTime() <
        startAt.getTime()
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_TOURNAMENT_DATES',

          message:
            'Tournament end date cannot be earlier than the start date.',
        },
      });
    }

    const nextMode =
      dto.mode ??
      tournament.mode;

    const teamSize =
      nextMode ===
      'SOLO'
        ? 1
        : nextMode ===
            'DUO'
          ? 2
          : dto.teamSize ??
            tournament.teamSize;

    if (
      nextMode ===
        'TEAM' &&
      (
        teamSize < 3 ||
        teamSize > 11
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_TEAM_SIZE',

          message:
            'TEAM tournaments require a team size between 3 and 11.',
        },
      });
    }

    const updated =
      await this.prisma.tournament.update({
        where: {
          id: tournamentId,
        },

        data: {
          name:
            dto.name?.trim(),

          description:
            dto.description ===
            undefined
              ? undefined
              : dto.description.trim() ||
                null,

          rules:
            dto.rules ===
            undefined
              ? undefined
              : dto.rules.trim() ||
                null,

          logoUrl:
            dto.logoUrl ===
            undefined
              ? undefined
              : dto.logoUrl.trim() ||
                null,

          mode:
            dto.mode,

          competitionFormat,

          format:
            this.resolveLegacyFormat(
              competitionFormat,
              tournament.format,
            ),

          groupMode,

          legType:
            competitionFormat ===
            'DOUBLE_ROUND_ROBIN'
              ? 'HOME_AWAY'
              : dto.legType,

          fixtureMode:
            competitionFormat ===
            'CUSTOM_MANUAL'
              ? 'MANUAL'
              : dto.fixtureMode,

          visibility:
            dto.visibility,

          registrationMode:
            dto.registrationMode,

          maxEntries:
            dto.maxEntries,

          teamSize,

          startAt,

          endAt,

          wizardStep:
            'TEAMS',
        },
      });

    return {
      success: true,

      data: {
        message:
          'Tournament setup saved.',

        tournament:
          updated,

        nextStep:
          'TEAMS',
      },

      error: null,
    };
  }


  async updateWizardStep(
    userId: string,
    tournamentId: string,
    dto: UpdateTournamentWizardStepDto,
  ) {
    const tournament =
      await this.getTournamentForAdmin(
        userId,
        tournamentId,
      );

    if (
      ![
        'DRAFT',
        'REGISTRATION_CLOSED',
      ].includes(
        tournament.status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'TOURNAMENT_WIZARD_LOCKED',

          message:
            'Close Tournament registration before continuing setup.',
        },
      });
    }

    const allowedSteps =
      this.buildWizardSteps(
        tournament,
      );

    if (
      !allowedSteps.includes(
        dto.step,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,

        error: {
          code:
            'INVALID_WIZARD_STEP',

          message:
            'This wizard step does not apply to the current Tournament configuration.',
        },
      });
    }

    const updated =
      await this.prisma.tournament.update({
        where: {
          id:
            tournamentId,
        },

        data: {
          wizardStep:
            dto.step,
        },

        select: {
          id: true,
          wizardStep: true,
        },
      });

    return {
      success: true,

      data: {
        message:
          'Tournament wizard step updated.',

        currentStep:
          updated.wizardStep,

        steps:
          allowedSteps,
      },

      error: null,
    };
  }


  private buildWizardSteps(
    tournament: {
      groupMode: string;
      competitionFormat: string;
    },
  ) {
    const steps = [
      'SETUP',
      'TEAMS',
    ];

    if (
      tournament.groupMode ===
      'MULTIPLE_GROUPS'
    ) {
      steps.push(
        'GROUPS',
      );
    }

    steps.push(
      'FIXTURE_SETTINGS',
      'FIXTURE_PREVIEW',
    );

    if (
      tournament.competitionFormat ===
      'GROUP_STAGE_KNOCKOUT'
    ) {
      steps.push(
        'QUALIFICATION',
      );
    }

    steps.push(
      'REVIEW',
    );

    return steps;
  }


  private resolveCompetitionFormat(
    legacyFormat:
      | 'ROUND_ROBIN'
      | 'KNOCKOUT'
      | undefined,
  ) {
    return legacyFormat ===
      'KNOCKOUT'
      ? 'SINGLE_ELIMINATION'
      : 'LEAGUE_ROUND_ROBIN';
  }


  private resolveLegacyFormat(
    competitionFormat:
      | 'LEAGUE_ROUND_ROBIN'
      | 'DOUBLE_ROUND_ROBIN'
      | 'SINGLE_ELIMINATION'
      | 'GROUP_STAGE_KNOCKOUT'
      | 'CUSTOM_MANUAL'
      | undefined,

    legacyFormat:
      | 'ROUND_ROBIN'
      | 'KNOCKOUT'
      | undefined,
  ): 'ROUND_ROBIN' | 'KNOCKOUT' {
    if (
      competitionFormat ===
      'SINGLE_ELIMINATION'
    ) {
      return 'KNOCKOUT';
    }

    if (competitionFormat) {
      return 'ROUND_ROBIN';
    }

    return (
      legacyFormat ??
      'ROUND_ROBIN'
    );
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

    await this.authorizationService.assertCanManageTournament(
      userId,
      tournamentId,
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