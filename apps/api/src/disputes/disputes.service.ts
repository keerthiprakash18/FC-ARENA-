import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '../database/prisma.service.js';

import type {
  CreateDisputeDto,
} from './dto/create-dispute.dto.js';

import type {
  ResolveDisputeDto,
} from './dto/resolve-dispute.dto.js';

interface DisputeRow {
  id: string;
  matchId: string;
  raisedByUserId: string;
  reason: string;
  evidenceUrl: string | null;
  status: string;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  raisedByName?: string;
  raisedByPlayerCode?: string | null;
  raisedByInGameName?: string | null;
  resolvedByName?: string | null;
  tournamentName?: string;
  tournamentCode?: string;
  leagueName?: string;
  leagueId?: string;
  roundName?: string;
  fixtureCode?: string;
}

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getMatchDisputes(
    userId: string,
    matchId: string,
  ) {
    await this.assertMatchAccess(
      userId,
      matchId,
      false,
    );

    const disputes =
      await this.prisma.$queryRawUnsafe<
        DisputeRow[]
      >(
        'SELECT d.*, u."fullName" AS "raisedByName", p."playerCode" AS "raisedByPlayerCode", pi."inGameName" AS "raisedByInGameName", r."fullName" AS "resolvedByName" FROM "match_disputes" d JOIN "users" u ON u."id" = d."raisedByUserId" LEFT JOIN "players" p ON p."userId" = u."id" LEFT JOIN "player_identities" pi ON pi."playerId" = p."id" LEFT JOIN "users" r ON r."id" = d."resolvedByUserId" WHERE d."matchId" = $1::uuid ORDER BY d."createdAt" DESC',
        matchId,
      );

    return {
      success: true,

      data: {
        disputes,
      },

      error: null,
    };
  }

  async createDispute(
    userId: string,
    matchId: string,
    dto: CreateDisputeDto,
  ) {
    const access =
      await this.assertMatchAccess(
        userId,
        matchId,
        true,
      );

    if (
      !access.isParticipant &&
      !access.isAdmin
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'DISPUTE_FORBIDDEN',

          message:
            'Only match participants or a League Admin may raise a dispute.',
        },
      });
    }

    if (
      !access.match
        .confirmedResultSubmissionId
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'CONFIRMED_RESULT_REQUIRED',

          message:
            'A dispute can be raised only after a result has been confirmed.',
        },
      });
    }

    const existing =
      await this.prisma.$queryRawUnsafe<
        DisputeRow[]
      >(
        'SELECT * FROM "match_disputes" WHERE "matchId" = $1::uuid AND "raisedByUserId" = $2::uuid AND "status" = $3 LIMIT 1',
        matchId,
        userId,
        'OPEN',
      );

    if (
      existing.length > 0
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'OPEN_DISPUTE_EXISTS',

          message:
            'You already have an open dispute for this match.',
        },
      });
    }

    const id =
      randomUUID();

    const now =
      new Date();

    const reason =
      dto.reason.trim();

    const evidenceUrl =
      dto.evidenceUrl
        ?.trim() ||
      null;

    const inserted =
      await this.prisma.$queryRawUnsafe<
        DisputeRow[]
      >(
        'INSERT INTO "match_disputes" ("id","matchId","raisedByUserId","reason","evidenceUrl","status","createdAt","updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$7) RETURNING *',
        id,
        matchId,
        userId,
        reason,
        evidenceUrl,
        'OPEN',
        now,
      );

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          userId,

        action:
          'MATCH_DISPUTE_RAISED',

        targetType:
          'MatchDispute',

        targetId:
          id,

        scopeType:
          'LEAGUE',

        scopeId:
          access.match.tournament
            .leagueId,

        metadata: {
          matchId,
          evidenceUrl:
            Boolean(
              evidenceUrl,
            ),
        },
      },
    });

    return {
      success: true,

      data: {
        message:
          'Dispute raised successfully. A League Admin can now review it.',

        dispute:
          inserted[0],
      },

      error: null,
    };
  }

  async getAdminDisputes(
    userId: string,
  ) {
    const adminRoles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
        },
      });

    const leagueIds =
      adminRoles.map(
        (role) =>
          role.leagueId,
      );

    if (
      leagueIds.length ===
      0
    ) {
      return {
        success: true,

        data: {
          disputes: [],
        },

        error: null,
      };
    }

    const placeholders =
      leagueIds
        .map(
          (
            _,
            index,
          ) =>
            '$' +
            String(
              index + 1,
            ) +
            '::uuid',
        )
        .join(',');

    const query =
      'SELECT d.*, u."fullName" AS "raisedByName", p."playerCode" AS "raisedByPlayerCode", pi."inGameName" AS "raisedByInGameName", r."fullName" AS "resolvedByName", t."name" AS "tournamentName", t."code" AS "tournamentCode", l."name" AS "leagueName", l."id" AS "leagueId", f."roundName" AS "roundName", f."fixtureCode" AS "fixtureCode" FROM "match_disputes" d JOIN "matches" m ON m."id" = d."matchId" JOIN "fixtures" f ON f."id" = m."fixtureId" JOIN "tournaments" t ON t."id" = m."tournamentId" JOIN "leagues" l ON l."id" = t."leagueId" JOIN "users" u ON u."id" = d."raisedByUserId" LEFT JOIN "players" p ON p."userId" = u."id" LEFT JOIN "player_identities" pi ON pi."playerId" = p."id" LEFT JOIN "users" r ON r."id" = d."resolvedByUserId" WHERE t."leagueId" IN (' +
      placeholders +
      ') ORDER BY CASE WHEN d."status" = \'OPEN\' THEN 0 ELSE 1 END, d."createdAt" DESC';

    const disputes =
      await this.prisma.$queryRawUnsafe<
        DisputeRow[]
      >(
        query,
        ...leagueIds,
      );

    return {
      success: true,

      data: {
        disputes,
      },

      error: null,
    };
  }

  async resolveDispute(
    adminUserId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
  ) {
    const records =
      await this.prisma.$queryRawUnsafe<
        Array<
          DisputeRow & {
            leagueId: string;
          }
        >
      >(
        'SELECT d.*, t."leagueId" AS "leagueId" FROM "match_disputes" d JOIN "matches" m ON m."id" = d."matchId" JOIN "tournaments" t ON t."id" = m."tournamentId" WHERE d."id" = $1::uuid LIMIT 1',
        disputeId,
      );

    const dispute =
      records[0];

    if (!dispute) {
      throw this.disputeNotFound();
    }

    await this.assertLeagueAdmin(
      adminUserId,
      dispute.leagueId,
    );

    if (
      dispute.status !==
      'OPEN'
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'DISPUTE_ALREADY_CLOSED',

          message:
            'This dispute has already been resolved or rejected.',
        },
      });
    }

    const now =
      new Date();

    const updated =
      await this.prisma.$queryRawUnsafe<
        DisputeRow[]
      >(
        'UPDATE "match_disputes" SET "status" = $1, "resolutionNote" = $2, "resolvedByUserId" = $3::uuid, "resolvedAt" = $4, "updatedAt" = $4 WHERE "id" = $5::uuid RETURNING *',
        dto.status,
        dto.resolutionNote.trim(),
        adminUserId,
        now,
        disputeId,
      );

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          adminUserId,

        action:
          dto.status ===
          'RESOLVED'
            ? 'MATCH_DISPUTE_RESOLVED'
            : 'MATCH_DISPUTE_REJECTED',

        targetType:
          'MatchDispute',

        targetId:
          disputeId,

        scopeType:
          'LEAGUE',

        scopeId:
          dispute.leagueId,

        beforeData: {
          status:
            dispute.status,
        },

        afterData: {
          status:
            dto.status,
        },

        metadata: {
          matchId:
            dispute.matchId,
        },
      },
    });

    return {
      success: true,

      data: {
        message:
          dto.status ===
          'RESOLVED'
            ? 'Dispute resolved.'
            : 'Dispute rejected.',

        dispute:
          updated[0],
      },

      error: null,
    };
  }

  private async assertMatchAccess(
    userId: string,
    matchId: string,
    allowAdmin: boolean,
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
      throw new NotFoundException({
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

    const participantUserIds = [
      ...(
        match.fixture
          .homeRegistration
          ?.members.map(
            (member) =>
              member.userId,
          ) ??
        []
      ),

      ...(
        match.fixture
          .awayRegistration
          ?.members.map(
            (member) =>
              member.userId,
          ) ??
        []
      ),
    ];

    const isParticipant =
      participantUserIds.includes(
        userId,
      );

    const admin =
      allowAdmin
        ? await this.prisma.leagueAdmin.findUnique({
            where: {
              leagueId_userId: {
                leagueId:
                  match.tournament
                    .leagueId,

                userId,
              },
            },
          })
        : await this.prisma.leagueAdmin.findUnique({
            where: {
              leagueId_userId: {
                leagueId:
                  match.tournament
                    .leagueId,

                userId,
              },
            },
          });

    const isAdmin =
      Boolean(
        admin,
      );

    if (
      !isParticipant &&
      !isAdmin
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'MATCH_ACCESS_FORBIDDEN',

          message:
            'Only match participants or League Admins may access disputes for this match.',
        },
      });
    }

    return {
      match,
      isParticipant,
      isAdmin,
    };
  }

  private async assertLeagueAdmin(
    userId: string,
    leagueId: string,
  ) {
    const role =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId,
            userId,
          },
        },
      });

    if (!role) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'LEAGUE_ADMIN_REQUIRED',

          message:
            'League Admin access is required.',
        },
      });
    }
  }

  private disputeNotFound() {
    return new NotFoundException({
      success: false,
      data: null,

      error: {
        code:
          'DISPUTE_NOT_FOUND',

        message:
          'Dispute could not be found.',
      },
    });
  }
}
