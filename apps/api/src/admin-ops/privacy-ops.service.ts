import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import bcrypt from 'bcryptjs';

import {
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  unlink,
} from 'node:fs/promises';

import {
  resolve,
  sep,
} from 'node:path';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  PlayerProfileImageService,
} from '../player-career/player-profile-image.service.js';

import type {
  CompleteAccountDeletionDto,
} from './dto/complete-account-deletion.dto.js';

import type {
  VerifyAccountDeletionDto,
} from './dto/verify-account-deletion.dto.js';

interface CloudinaryDestroyResponse {
  result?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class PrivacyOpsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly profileImages:
      PlayerProfileImageService,
  ) {}

  async listDeletionRequests(
    adminUserId: string,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const requests =
      await this.prisma.auditLog.findMany({
        where: {
          action:
            'ACCOUNT_DELETION_REQUESTED',
        },

        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              status: true,

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

        take: 200,
      });

    const requestIds =
      requests.map(
        (
          request,
        ) =>
          request.targetId,
      );

    const statusEvents =
      requestIds.length >
      0
        ? await this.prisma.auditLog.findMany({
            where: {
              targetType:
                'ACCOUNT_DELETION_REQUEST',

              targetId: {
                in:
                  requestIds,
              },

              action: {
                in: [
                  'ACCOUNT_DELETION_VERIFIED',
                  'ACCOUNT_DELETION_COMPLETED',
                ],
              },
            },

            orderBy: {
              createdAt:
                'desc',
            },
          })
        : [];

    const latestStatus =
      new Map<
        string,
        {
          action: string;
          createdAt: Date;
          metadata: unknown;
        }
      >();

    for (
      const event
      of statusEvents
    ) {
      if (
        !latestStatus.has(
          event.targetId,
        )
      ) {
        latestStatus.set(
          event.targetId,
          event,
        );
      }
    }

    return {
      success: true,

      data: {
        requests:
          requests.map(
            (
              request,
            ) => {
              const metadata =
                this.objectMetadata(
                  request.metadata,
                );

              const status =
                latestStatus.get(
                  request.targetId,
                );

              return {
                id:
                  request.targetId,

                auditId:
                  request.id,

                requestedAt:
                  request.createdAt,

                status:
                  status?.action ===
                  'ACCOUNT_DELETION_COMPLETED'
                    ? 'COMPLETED'
                    : status?.action ===
                        'ACCOUNT_DELETION_VERIFIED'
                      ? 'VERIFIED'
                      : 'PENDING_VERIFICATION',

                statusUpdatedAt:
                  status?.createdAt ??
                  request.createdAt,

                request: {
                  email:
                    typeof metadata.email ===
                    'string'
                      ? metadata.email
                      : null,

                  inGameName:
                    typeof metadata.inGameName ===
                    'string'
                      ? metadata.inGameName
                      : null,

                  details:
                    typeof metadata.details ===
                    'string'
                      ? metadata.details
                      : null,
                },

                account:
                  request.actor
                    ? {
                        id:
                          request.actor.id,

                        fullName:
                          request.actor.fullName,

                        email:
                          request.actor.email,

                        status:
                          request.actor.status,

                        playerCode:
                          request.actor
                            .player
                            ?.playerCode ??
                          null,

                        inGameName:
                          request.actor
                            .player
                            ?.identity
                            ?.inGameName ??
                          null,
                      }
                    : null,
              };
            },
          ),
      },

      error: null,
    };
  }

  async verifyDeletionRequest(
    adminUserId: string,
    requestId: string,
    dto:
      VerifyAccountDeletionDto,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const request =
      await this.requireRequest(
        requestId,
      );

    const completed =
      await this.findStatusEvent(
        requestId,
        'ACCOUNT_DELETION_COMPLETED',
      );

    if (
      completed
    ) {
      return {
        success: true,

        data: {
          requestId,
          status:
            'COMPLETED',
          message:
            'This account deletion request is already completed.',
        },

        error: null,
      };
    }

    const targetUser =
      await this.resolveRequestUser(
        request,
      );

    if (
      !targetUser
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_ACCOUNT_NOT_FOUND',

          message:
            'No FC ARENA account matches this deletion request. Verify the supplied account email before continuing.',
        },
      });
    }

    const existing =
      await this.findStatusEvent(
        requestId,
        'ACCOUNT_DELETION_VERIFIED',
      );

    if (
      !existing
    ) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId:
            adminUserId,

          action:
            'ACCOUNT_DELETION_VERIFIED',

          targetType:
            'ACCOUNT_DELETION_REQUEST',

          targetId:
            requestId,

          scopeType:
            'PRIVACY',

          scopeId:
            'ACCOUNT_DELETION',

          metadata: {
            verifiedAt:
              new Date()
                .toISOString(),

            note:
              dto.note
                ?.trim() ||
              null,

            verification:
              'ACCOUNT_OWNERSHIP_CONFIRMED',
          },
        },
      });
    }

    return {
      success: true,

      data: {
        requestId,
        status:
          'VERIFIED',
        accountId:
          targetUser.id,

        message:
          'Account ownership marked as verified. The request can now be completed.',
      },

      error: null,
    };
  }

  async completeDeletionRequest(
    adminUserId: string,
    requestId: string,
    dto:
      CompleteAccountDeletionDto,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const request =
      await this.requireRequest(
        requestId,
      );

    const alreadyCompleted =
      await this.findStatusEvent(
        requestId,
        'ACCOUNT_DELETION_COMPLETED',
      );

    if (
      alreadyCompleted
    ) {
      return {
        success: true,

        data: {
          requestId,
          status:
            'COMPLETED',
          completedAt:
            alreadyCompleted.createdAt,

          message:
            'This account deletion request is already completed.',
        },

        error: null,
      };
    }

    const verified =
      await this.findStatusEvent(
        requestId,
        'ACCOUNT_DELETION_VERIFIED',
      );

    if (
      !verified
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_REQUEST_NOT_VERIFIED',

          message:
            'Verify account ownership before completing deletion.',
        },
      });
    }

    const targetUser =
      await this.resolveRequestUser(
        request,
      );

    if (
      !targetUser
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_ACCOUNT_NOT_FOUND',

          message:
            'The account associated with this deletion request could not be found.',
        },
      });
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            targetUser.id,
        },

        include: {
          player: {
            include: {
              identity: true,
            },
          },
        },
      });

    if (
      !user ||
      !user.player
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_ACCOUNT_NOT_FOUND',

          message:
            'The FC ARENA player account could not be found.',
        },
      });
    }

    const ocrRows =
      await this.prisma.ocrExtraction.findMany({
        where: {
          submittedByUserId:
            user.id,
        },

        select: {
          id: true,
          imagePath: true,
        },
      });

    const leagueWarProofs =
      await this.prisma.leagueWarMatch.findMany({
        where: {
          resultSubmittedByUserId:
            user.id,

          proofUrl: {
            not:
              null,
          },
        },

        select: {
          id: true,
          warId: true,
          proofUrl: true,
        },
      });

    if (
      user.player
        .profileImageUrl
    ) {
      await this.profileImages.removeAvatar(
        user.id,
      );
    }

    await this.removeOcrFiles(
      ocrRows,
    );

    for (
      const proof
      of leagueWarProofs
    ) {
      if (
        proof.proofUrl &&
        this.isManagedCloudinaryUrl(
          proof.proofUrl,
        )
      ) {
        await this.destroyCloudinaryImage(
          `fc-arena/league-wars/${proof.warId}/matches/${proof.id}/proof`,
        );
      }
    }

    const now =
      new Date();

    const serial =
      user.player
        .serialNumber;

    const deletedPlayerCode =
      `DEL-${String(
        serial,
      ).padStart(
        8,
        '0',
      )}`;

    const deletedInGameName =
      `Deleted Player ${serial}`;

    const deletedEmail =
      `deleted+${user.id.replaceAll(
        '-',
        '',
      )}@deleted.invalid`;

    const passwordHash =
      await bcrypt.hash(
        randomBytes(
          32,
        ).toString(
          'hex',
        ),
        12,
      );

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        await tx.pushDevice.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.refreshSession.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.authOtp.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.notification.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.leagueApplication.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.leagueMember.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.leagueAdmin.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.roleAssignment.deleteMany({
          where: {
            userId:
              user.id,
          },
        });

        await tx.roleAssignment.updateMany({
          where: {
            assignedByUserId:
              user.id,
          },

          data: {
            assignedByUserId:
              null,
          },
        });

        await tx.matchDispute.updateMany({
          where: {
            raisedByUserId:
              user.id,
          },

          data: {
            reason:
              'Content removed following account deletion.',

            evidenceUrl:
              null,
          },
        });

        await tx.matchDispute.updateMany({
          where: {
            resolvedByUserId:
              user.id,
          },

          data: {
            resolvedByUserId:
              null,
          },
        });

        await tx.resultSubmission.updateMany({
          where: {
            reviewedByUserId:
              user.id,
          },

          data: {
            reviewedByUserId:
              null,
          },
        });

        await tx.ocrExtraction.updateMany({
          where: {
            submittedByUserId:
              user.id,
          },

          data: {
            imagePath:
              'deleted://account-deletion',
            mimeType:
              'application/octet-stream',
            fileSize:
              0,
            width:
              null,
            height:
              null,
            rawText:
              null,
            detectedHomeName:
              null,
            detectedAwayName:
              null,
            homeNameConfidence:
              null,
            awayNameConfidence:
              null,
            scoreConfidence:
              null,
            failureReason:
              null,
          },
        });

        await tx.ocrExtraction.updateMany({
          where: {
            homeMatchedUserId:
              user.id,
          },

          data: {
            homeMatchedUserId:
              null,
          },
        });

        await tx.ocrExtraction.updateMany({
          where: {
            awayMatchedUserId:
              user.id,
          },

          data: {
            awayMatchedUserId:
              null,
          },
        });

        await tx.leagueWarMatch.updateMany({
          where: {
            resultSubmittedByUserId:
              user.id,
          },

          data: {
            resultSubmittedByUserId:
              null,
            proofUrl:
              null,
            disputeReason:
              null,
          },
        });

        await tx.leagueWarMatch.updateMany({
          where: {
            resultConfirmedByUserId:
              user.id,
          },

          data: {
            resultConfirmedByUserId:
              null,
          },
        });

        await tx.leagueWarMatch.updateMany({
          where: {
            resultUpdatedByUserId:
              user.id,
          },

          data: {
            resultUpdatedByUserId:
              null,
          },
        });

        await tx.auditLog.updateMany({
          where: {
            actorUserId:
              user.id,
          },

          data: {
            actorUserId:
              null,

            metadata: {
              redactedForAccountDeletion:
                true,
            },
          },
        });

        await tx.playerIdentity.update({
          where: {
            playerId:
              user.player!.id,
          },

          data: {
            inGameName:
              deletedInGameName,
            inGameNameNormalized:
              deletedInGameName
                .toLowerCase(),
            gameUid:
              null,
            isVerified:
              false,
            verifiedAt:
              null,
            lockedAt:
              now,
          },
        });

        await tx.player.update({
          where: {
            id:
              user.player!.id,
          },

          data: {
            playerCode:
              deletedPlayerCode,
            profileImageUrl:
              null,
          },
        });

        await tx.user.update({
          where: {
            id:
              user.id,
          },

          data: {
            fullName:
              'Deleted Player',
            email:
              deletedEmail,
            phoneNumber:
              null,
            passwordHash,
            role:
              'USER',
            status:
              'DISABLED',
            themePreference:
              'CLASSIC_BLUE',
            emailVerifiedAt:
              null,
          },
        });

        await tx.auditLog.update({
          where: {
            id:
              request.id,
          },

          data: {
            actorUserId:
              null,

            metadata: {
              status:
                'COMPLETED',
              completedAt:
                now.toISOString(),
              personalAccountData:
                'ANONYMIZED_OR_DELETED',
              competitionHistory:
                'RETAINED_DEIDENTIFIED',
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId:
              adminUserId ===
              user.id
                ? null
                : adminUserId,

            action:
              'ACCOUNT_DELETION_COMPLETED',

            targetType:
              'ACCOUNT_DELETION_REQUEST',

            targetId:
              requestId,

            scopeType:
              'PRIVACY',

            scopeId:
              'ACCOUNT_DELETION',

            metadata: {
              completedAt:
                now.toISOString(),

              note:
                dto.note
                  ?.trim() ||
                null,

              personalAccountData:
                'ANONYMIZED_OR_DELETED',

              competitionHistory:
                'RETAINED_DEIDENTIFIED',
            },
          },
        });
      },
    );

    return {
      success: true,

      data: {
        requestId,
        status:
          'COMPLETED',
        completedAt:
          now,

        message:
          'Account credentials and personal profile data were deleted or anonymized. De-identified competition records were retained for competition integrity.',
      },

      error: null,
    };
  }

  private async requireRequest(
    requestId: string,
  ) {
    const request =
      await this.prisma.auditLog.findFirst({
        where: {
          action:
            'ACCOUNT_DELETION_REQUESTED',

          targetType:
            'ACCOUNT_DELETION_REQUEST',

          targetId:
            requestId,
        },
      });

    if (
      !request
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_REQUEST_NOT_FOUND',

          message:
            'Account deletion request could not be found.',
        },
      });
    }

    return request;
  }

  private async resolveRequestUser(
    request: {
      actorUserId:
        string | null;
      metadata:
        unknown;
    },
  ) {
    if (
      request.actorUserId
    ) {
      const byId =
        await this.prisma.user.findUnique({
          where: {
            id:
              request.actorUserId,
          },

          select: {
            id: true,
            status: true,
          },
        });

      if (
        byId
      ) {
        return byId;
      }
    }

    const metadata =
      this.objectMetadata(
        request.metadata,
      );

    const email =
      typeof metadata.email ===
      'string'
        ? metadata.email
            .trim()
            .toLowerCase()
        : '';

    if (
      !email
    ) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
        status: true,
      },
    });
  }

  private async findStatusEvent(
    requestId: string,
    action: string,
  ) {
    return this.prisma.auditLog.findFirst({
      where: {
        action,

        targetType:
          'ACCOUNT_DELETION_REQUEST',

        targetId:
          requestId,
      },

      orderBy: {
        createdAt:
          'desc',
      },
    });
  }

  private async removeOcrFiles(
    rows:
      Array<{
        id: string;
        imagePath: string;
      }>,
  ) {
    const root =
      resolve(
        process.cwd(),
        process.env
          .OCR_UPLOAD_DIR ??
          'storage/match-results',
      );

    const rootPrefix =
      root.endsWith(
        sep,
      )
        ? root
        : root +
          sep;

    for (
      const row
      of rows
    ) {
      if (
        row.imagePath.startsWith(
          'deleted://',
        )
      ) {
        continue;
      }

      const candidate =
        resolve(
          row.imagePath,
        );

      if (
        !candidate.startsWith(
          rootPrefix,
        )
      ) {
        throw new InternalServerErrorException({
          success: false,
          data: null,

          error: {
            code:
              'DELETION_OCR_PATH_UNSAFE',

            message:
              'An OCR evidence file is outside the configured result-storage directory. Account deletion was stopped for manual review.',
          },
        });
      }

      try {
        await unlink(
          candidate,
        );
      } catch (
        error
      ) {
        if (
          (
            error as {
              code?: string;
            }
          ).code ===
          'ENOENT'
        ) {
          continue;
        }

        throw new InternalServerErrorException({
          success: false,
          data: null,

          error: {
            code:
              'DELETION_OCR_FILE_REMOVE_FAILED',

            message:
              'An OCR result image could not be deleted. Account deletion was stopped for manual review.',
          },
        });
      }
    }
  }

  private isManagedCloudinaryUrl(
    value: string,
  ) {
    try {
      const url =
        new URL(
          value,
        );

      return (
        url.protocol ===
          'https:' &&
        url.hostname ===
          'res.cloudinary.com'
      );
    } catch {
      return false;
    }
  }

  private async destroyCloudinaryImage(
    publicId: string,
  ) {
    const config =
      this.cloudinaryConfig();

    if (
      !config
    ) {
      throw new InternalServerErrorException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_IMAGE_STORAGE_NOT_CONFIGURED',

          message:
            'Cloudinary credentials are unavailable, so hosted account evidence cannot be deleted safely.',
        },
      });
    }

    const timestamp =
      Math.floor(
        Date.now() /
          1000,
      );

    const signature =
      this.sign(
        {
          invalidate:
            'true',
          public_id:
            publicId,
          timestamp:
            String(
              timestamp,
            ),
        },
        config.apiSecret,
      );

    const formData =
      new FormData();

    formData.append(
      'api_key',
      config.apiKey,
    );

    formData.append(
      'timestamp',
      String(
        timestamp,
      ),
    );

    formData.append(
      'public_id',
      publicId,
    );

    formData.append(
      'invalidate',
      'true',
    );

    formData.append(
      'signature',
      signature,
    );

    const response =
      await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
          config.cloudName,
        )}/image/destroy`,
        {
          method:
            'POST',
          body:
            formData,
        },
      );

    const payload =
      await response.json() as
        CloudinaryDestroyResponse;

    if (
      !response.ok ||
      payload.error
    ) {
      throw new InternalServerErrorException({
        success: false,
        data: null,

        error: {
          code:
            'DELETION_HOSTED_EVIDENCE_REMOVE_FAILED',

          message:
            payload.error
              ?.message ??
            'Hosted match evidence could not be deleted.',
        },
      });
    }
  }

  private cloudinaryConfig() {
    const cloudinaryUrl =
      process.env
        .CLOUDINARY_URL
        ?.trim();

    if (
      cloudinaryUrl
    ) {
      try {
        const parsed =
          new URL(
            cloudinaryUrl,
          );

        if (
          parsed.protocol ===
            'cloudinary:' &&
          parsed.hostname &&
          parsed.username &&
          parsed.password
        ) {
          return {
            cloudName:
              parsed.hostname,
            apiKey:
              decodeURIComponent(
                parsed.username,
              ),
            apiSecret:
              decodeURIComponent(
                parsed.password,
              ),
          };
        }
      } catch {
        // Fall through.
      }
    }

    const cloudName =
      process.env
        .CLOUDINARY_CLOUD_NAME
        ?.trim();

    const apiKey =
      process.env
        .CLOUDINARY_API_KEY
        ?.trim();

    const apiSecret =
      process.env
        .CLOUDINARY_API_SECRET
        ?.trim();

    if (
      cloudName &&
      apiKey &&
      apiSecret
    ) {
      return {
        cloudName,
        apiKey,
        apiSecret,
      };
    }

    return null;
  }

  private sign(
    values:
      Record<
        string,
        string
      >,
    apiSecret: string,
  ) {
    const unsigned =
      Object.entries(
        values,
      )
        .sort(
          (
            [left],
            [right],
          ) =>
            left.localeCompare(
              right,
            ),
        )
        .map(
          ([
            key,
            value,
          ]) =>
            `${key}=${value}`,
        )
        .join(
          '&',
        );

    return createHash(
      'sha1',
    )
      .update(
        `${unsigned}${apiSecret}`,
      )
      .digest(
        'hex',
      );
  }

  private objectMetadata(
    value: unknown,
  ):
    Record<
      string,
      unknown
    > {
    return (
      value &&
      typeof value ===
        'object' &&
      !Array.isArray(
        value,
      )
        ? value as
            Record<
              string,
              unknown
            >
        : {}
    );
  }

  private async assertSuperAdmin(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          role: true,
          status: true,
        },
      });

    if (
      !user ||
      user.role !==
        'SUPER_ADMIN' ||
      user.status !==
        'ACTIVE'
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'SUPER_ADMIN_REQUIRED',

          message:
            'Active FC Arena SUPER_ADMIN access is required.',
        },
      });
    }
  }
}
