import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export interface AuditRecordInput {
  actorUserId?:
    string | null;

  action:
    string;

  targetType:
    string;

  targetId:
    string;

  scopeType?:
    string | null;

  scopeId?:
    string | null;

  beforeData?:
    unknown;

  afterData?:
    unknown;

  metadata?:
    unknown;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async record(
    input:
      AuditRecordInput,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId:
          input.actorUserId ??
          null,

        action:
          input.action,

        targetType:
          input.targetType,

        targetId:
          input.targetId,

        scopeType:
          input.scopeType ??
          null,

        scopeId:
          input.scopeId ??
          null,

        beforeData:
          input.beforeData ===
          undefined
            ? undefined
            : input.beforeData as any,

        afterData:
          input.afterData ===
          undefined
            ? undefined
            : input.afterData as any,

        metadata:
          input.metadata ===
          undefined
            ? undefined
            : input.metadata as any,
      },
    });
  }

  async listForScope(
    scopeType: string,
    scopeId: string,
    take = 100,
  ) {
    const safeTake =
      Math.min(
        Math.max(
          take,
          1,
        ),
        200,
      );

    return this.prisma.auditLog.findMany({
      where: {
        scopeType,
        scopeId,
      },

      include: {
        actor: {
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

      orderBy: {
        createdAt:
          'desc',
      },

      take:
        safeTake,
    });
  }

  async listForTarget(
    targetType: string,
    targetId: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        targetType,
        targetId,
      },

      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },

      orderBy: {
        createdAt:
          'desc',
      },

      take: 100,
    });
  }
}