import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  unlink,
} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './auth.types.js';
import { OtpMailService } from './mail.service.js';
import { normalizeLoginIdentifier } from './login-identifier.js';
import type { AccountDeletionRequestDto } from './dto/account-deletion-request.dto.js';
import type { DeleteAccountDto } from './dto/delete-account.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { ResendVerificationDto } from './dto/resend-verification.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { ThemePreferenceValue } from './dto/update-theme-preference.dto.js';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_HOURLY_LIMIT = 5;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: OtpMailService,
  ) {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured.',
      );
    }

    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'PASSWORDS_DO_NOT_MATCH',
          message: 'Password and confirm password do not match.',
        },
      });
    }

    const email = dto.email.trim().toLowerCase();
    const inGameName = dto.inGameName.trim();
    const inGameNameNormalized = inGameName.toLowerCase();
    const phoneNumber = dto.phoneNumber?.trim() || null;
    const gameUid = dto.gameUid?.trim() || null;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw this.registrationConflict();
    }

    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (existingPhone) {
        throw this.registrationConflict();
      }
    }

    const existingIdentity = await this.prisma.playerIdentity.findUnique({
      where: { inGameNameNormalized },
    });

    if (existingIdentity) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'INGAME_NAME_TAKEN',
          message: 'This in-game name is already registered.',
        },
      });
    }

    if (gameUid) {
      const existingUid = await this.prisma.playerIdentity.findUnique({
        where: { gameUid },
      });

      if (existingUid) {
        throw this.registrationConflict();
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName.trim(),
            email,
            phoneNumber,
            passwordHash,
            status: 'ACTIVE',
          },
        });

        const temporaryPlayerCode = `TMP-${randomBytes(6).toString('hex')}`;

        const player = await tx.player.create({
          data: {
            userId: user.id,
            playerCode: temporaryPlayerCode,
          },
        });

        const playerCode = this.formatPlayerCode(player.serialNumber);

        const updatedPlayer = await tx.player.update({
          where: { id: player.id },
          data: { playerCode },
        });

        await tx.playerIdentity.create({
          data: {
            playerId: player.id,
            inGameName,
            inGameNameNormalized,
            gameUid,
          },
        });

        return {
          user,
          player: updatedPlayer,
        };
      });

      return {
        success: true,
        data: {
          message:
            'Registration successful. Your account is ready to sign in.',
          user: {
            id: result.user.id,
            fullName: result.user.fullName,
            email: result.user.email,
            status: result.user.status,
          },
          player: {
            playerCode: result.player.playerCode,
          },
        },
        error: null,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'REGISTRATION_CONFLICT',
            message:
              'One of the supplied account or player values is already registered.',
          },
        });
      }

      throw error;
    }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_VERIFICATION_REQUEST',
          message: 'Unable to verify this account.',
        },
      });
    }

    if (user.status === 'ACTIVE') {
      return {
        success: true,
        data: {
          message: 'Account is already verified.',
        },
        error: null,
      };
    }

    if (user.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException({ success: false, data: null, error: {
        code: 'INVALID_VERIFICATION_REQUEST', message: 'Unable to verify this account.',
      } });
    }

    const otpRecord = await this.getLatestOtp(
      user.id,
      'EMAIL_VERIFICATION',
    );

    await this.validateOtpRecord(otpRecord, dto.otp);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.consumeValidatedOtp(tx, otpRecord!.id, user.id, 'EMAIL_VERIFICATION', now);
      const activated = await tx.user.updateMany({
        where: { id: user.id, status: 'PENDING_VERIFICATION' },
        data: { status: 'ACTIVE', emailVerifiedAt: now },
      });
      if (activated.count !== 1) {
        throw new BadRequestException({ success: false, data: null, error: {
          code: 'INVALID_VERIFICATION_REQUEST', message: 'Unable to verify this account.',
        } });
      }
    });

    return {
      success: true,
      data: {
        message: 'Account verified successfully.',
      },
      error: null,
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return this.genericVerificationResponse();
    }

    if (user.status === 'ACTIVE') {
      return {
        success: true,
        data: {
          message: 'Account is already verified.',
        },
        error: null,
      };
    }

    if (user.status !== 'PENDING_VERIFICATION') {
      return this.genericVerificationResponse();
    }
    await this.enforceOtpRateLimit(user.id, 'EMAIL_VERIFICATION');

    const otpRecord =
      await this.createOtp(
        user.id,
        'EMAIL_VERIFICATION',
      );

    try {
      await this.mail.sendVerificationOtp(
        user.email,
        otpRecord.otp,
      );

      await this.consumeOlderOtps(
        user.id,
        'EMAIL_VERIFICATION',
        otpRecord.id,
      );
    } catch (error) {
      await this.prisma.authOtp
        .delete({
          where: {
            id: otpRecord.id,
          },
        })
        .catch(
          () =>
            undefined,
        );

      throw error;
    }

    return {
      success: true,
      data: {
        message:
          'A new verification OTP has been sent to your email.',
        ...(process.env.NODE_ENV ===
        'development'
          ? {
              developmentOtp:
                otpRecord.otp,
            }
          : {}),
      },
      error: null,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.status !== 'ACTIVE') {
      return this.genericPasswordResetResponse();
    }

    await this.enforceOtpRateLimit(user.id, 'PASSWORD_RESET');

    const otpRecord =
      await this.createOtp(
        user.id,
        'PASSWORD_RESET',
      );

    try {
      await this.mail.sendPasswordResetOtp(
        user.email,
        otpRecord.otp,
      );

      await this.consumeOlderOtps(
        user.id,
        'PASSWORD_RESET',
        otpRecord.id,
      );
    } catch (error) {
      await this.prisma.authOtp
        .delete({
          where: {
            id: otpRecord.id,
          },
        })
        .catch(
          () =>
            undefined,
        );

      throw error;
    }

    return {
      success: true,
      data: {
        message:
          'If the account exists, a password reset OTP has been generated.',
        ...(process.env.NODE_ENV ===
        'development'
          ? {
              developmentOtp:
                otpRecord.otp,
            }
          : {}),
      },
      error: null,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'PASSWORDS_DO_NOT_MATCH',
          message: 'New password and confirm password do not match.',
        },
      });
    }

    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw this.invalidPasswordReset();
    }

    const otpRecord = await this.getLatestOtp(
      user.id,
      'PASSWORD_RESET',
    );

    try {
      await this.validateOtpRecord(
        otpRecord,
        dto.otp,
      );
    } catch {
      throw this.invalidPasswordReset();
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.consumeValidatedOtp(tx, otpRecord!.id, user.id, 'PASSWORD_RESET', now);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null }, data: { revokedAt: now },
      });
    });

    return {
      success: true,
      data: {
        message:
          'Password reset successfully. Sign in using the new password.',
      },
      error: null,
    };
  }

  async requestAccountDeletion(
    dto:
      AccountDeletionRequestDto,
  ) {
    const email =
      dto.email
        .normalize('NFKC')
        .trim()
        .toLowerCase();

    const inGameName =
      dto.inGameName
        ?.normalize('NFKC')
        .trim()
        .slice(
          0,
          80,
        ) ||
      null;

    const details =
      dto.details
        ?.normalize('NFKC')
        .trim()
        .slice(
          0,
          1000,
        ) ||
      null;

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

    const requestId =
      randomUUID();

    await this.prisma.auditLog.create({
      data: {
        actorUserId:
          existingUser?.id ??
          null,
        action:
          'ACCOUNT_DELETION_REQUESTED',
        targetType:
          'ACCOUNT_DELETION_REQUEST',
        targetId:
          requestId,
        scopeType:
          'GLOBAL',
        scopeId:
          'PRIVACY',
        metadata: {
          email,
          inGameName,
          details,
          requestedAt:
            new Date()
              .toISOString(),
          source:
            'PUBLIC_WEB_OR_IN_APP',
          status:
            'PENDING_VERIFICATION',
        },
      },
    });

    return {
      success: true,
      data: {
        requestId,
        message:
          'Your account and data deletion request has been recorded. We may contact you to verify account ownership before deletion is completed.',
      },
      error: null,
    };
  }

  async deleteAccount(
    userId: string,
    dto:
      DeleteAccountDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },
        include: {
          player: {
            include: {
              identity:
                true,
            },
          },
        },
      });

    if (
      !user ||
      user.status !==
        'ACTIVE'
    ) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code:
            'ACCOUNT_NOT_ACTIVE',
          message:
            'This account is not active.',
        },
      });
    }

    const passwordValid =
      await this.passwordMatches(
        dto.password,
        user.passwordHash,
      );

    if (
      !passwordValid
    ) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code:
            'ACCOUNT_DELETE_PASSWORD_INVALID',
          message:
            'Password confirmation is incorrect.',
        },
      });
    }

    const suffix =
      randomBytes(
        8,
      )
        .toString(
          'hex',
        );

    const anonymousName =
      'Deleted Player';

    const anonymousInGameName =
      `Deleted-${suffix.slice(
        0,
        12,
      )}`;

    const anonymousPlayerCode =
      `DEL-${suffix
        .slice(
          0,
          12,
        )
        .toUpperCase()}`;

    const anonymousEmail =
      `deleted-${suffix}@deleted.fcarena.invalid`;

    const anonymousTargetId =
      `DELETED:${suffix}`;

    const oldInGameName =
      user.player
        ?.identity
        ?.inGameName ??
      null;

    const oldPlayerCode =
      user.player
        ?.playerCode ??
      null;

    const ocrArtifacts =
      await this.prisma.ocrExtraction.findMany({
        where: {
          OR: [
            {
              submittedByUserId:
                userId,
            },
            {
              homeMatchedUserId:
                userId,
            },
            {
              awayMatchedUserId:
                userId,
            },
          ],
        },
        select: {
          imagePath:
            true,
        },
      });

    /*
     * External/local image cleanup runs before the database anonymization.
     * If cleanup cannot be verified, do not claim successful deletion while
     * a personal image may still remain outside PostgreSQL.
     */
    if (
      user.player
        ?.profileImageUrl &&
      user.player.id
    ) {
      await this.removeDeletedAccountProfileImage(
        user.player.id,
      );
    }

    await this.removeDeletedAccountOcrArtifacts(
      ocrArtifacts.map(
        (
          artifact,
        ) =>
          artifact.imagePath,
      ),
    );

    const randomPassword =
      await bcrypt.hash(
        randomBytes(
          48,
        )
          .toString(
            'base64url',
          ),
        12,
      );

    await this.prisma.$transaction(
      async (
        tx,
      ) => {
        const memberships =
          await tx.tournamentRegistrationMember.findMany({
            where: {
              userId,
            },
            select: {
              registrationId:
                true,
              tournament: {
                select: {
                  teamSize:
                    true,
                },
              },
            },
          });

        const soloRegistrationIds =
          [
            ...new Set(
              memberships
                .filter(
                  (
                    membership,
                  ) =>
                    membership
                      .tournament
                      .teamSize ===
                    1,
                )
                .map(
                  (
                    membership,
                  ) =>
                    membership
                      .registrationId,
                ),
            ),
          ];

        if (
          soloRegistrationIds.length >
          0
        ) {
          await tx.tournamentRegistration.updateMany({
            where: {
              id: {
                in:
                  soloRegistrationIds,
              },
            },
            data: {
              entryName:
                anonymousInGameName,
            },
          });
        }

        await tx.roleAssignment.deleteMany({
          where: {
            userId,
          },
        });

        await tx.roleAssignment.updateMany({
          where: {
            assignedByUserId:
              userId,
          },
          data: {
            assignedByUserId:
              null,
          },
        });

        await tx.leagueAdmin.deleteMany({
          where: {
            userId,
          },
        });

        await tx.pushDevice.deleteMany({
          where: {
            userId,
          },
        });

        await tx.refreshSession.deleteMany({
          where: {
            userId,
          },
        });

        await tx.authOtp.deleteMany({
          where: {
            userId,
          },
        });

        await tx.notification.deleteMany({
          where: {
            userId,
          },
        });

        await tx.matchDispute.updateMany({
          where: {
            raisedByUserId:
              userId,
          },
          data: {
            reason:
              'Retained de-identified dispute record.',
            evidenceUrl:
              null,
            resolutionNote:
              null,
          },
        });

        await tx.fairPlayAppeal.updateMany({
          where: {
            appealedByUserId:
              userId,
          },
          data: {
            reason:
              'Retained de-identified Fair Play appeal.',
            resolutionNote:
              null,
          },
        });

        await tx.fairPlayEvent.updateMany({
          where: {
            userId,
          },
          data: {
            reason:
              'Retained de-identified Fair Play record.',
            evidenceUrl:
              null,
            revocationNote:
              null,
          },
        });

        await tx.ocrExtraction.updateMany({
          where: {
            OR: [
              {
                submittedByUserId:
                  userId,
              },
              {
                homeMatchedUserId:
                  userId,
              },
              {
                awayMatchedUserId:
                  userId,
              },
            ],
          },
          data: {
            imagePath:
              'redacted://account-deletion',
            rawText:
              null,
            detectedHomeName:
              null,
            detectedAwayName:
              null,
            homeMatchedUserId:
              null,
            awayMatchedUserId:
              null,
            failureReason:
              null,
          },
        });

        await tx.achievement.updateMany({
          where: {
            userId,
          },
          data: {
            description:
              null,
            metadata: {
              redacted:
                true,
            },
          },
        });

        await tx.seasonalAward.updateMany({
          where: {
            userId,
          },
          data: {
            description:
              null,
            metadata: {
              redacted:
                true,
            },
          },
        });

        const redactedMetadata = {
          redacted:
            true,
          reason:
            'ACCOUNT_DELETION',
        };

        await tx.auditLog.updateMany({
          where: {
            actorUserId:
              userId,
          },
          data: {
            actorUserId:
              null,
            metadata:
              redactedMetadata,
            beforeData:
              redactedMetadata,
            afterData:
              redactedMetadata,
          },
        });

        await tx.auditLog.updateMany({
          where: {
            targetType:
              'USER',
            targetId:
              userId,
          },
          data: {
            targetId:
              anonymousTargetId,
            metadata:
              redactedMetadata,
            beforeData:
              redactedMetadata,
            afterData:
              redactedMetadata,
          },
        });

        /*
         * Cached ranking snapshots are JSON documents rather than relations.
         * Replace stable public identifiers so archived leaderboards cannot
         * reconnect the anonymized account to its previous identity.
         */
        await tx.$executeRaw`
          UPDATE "ballon_ranking_snapshots"
          SET "rows" =
            replace(
              "rows"::text,
              ${userId},
              ${anonymousTargetId}
            )::jsonb
          WHERE "rows"::text LIKE
            ${`%${userId}%`}
        `;

        await tx.$executeRaw`
          UPDATE "ranking_snapshots"
          SET "positions" =
            replace(
              "positions"::text,
              ${userId},
              ${anonymousTargetId}
            )::jsonb
          WHERE "positions"::text LIKE
            ${`%${userId}%`}
        `;

        if (
          oldInGameName
        ) {
          await tx.$executeRaw`
            UPDATE "ballon_ranking_snapshots"
            SET "rows" =
              replace(
                "rows"::text,
                ${oldInGameName},
                ${anonymousInGameName}
              )::jsonb
            WHERE "rows"::text LIKE
              ${`%${oldInGameName}%`}
          `;

          await tx.$executeRaw`
            UPDATE "ranking_snapshots"
            SET "positions" =
              replace(
                "positions"::text,
                ${oldInGameName},
                ${anonymousInGameName}
              )::jsonb
            WHERE "positions"::text LIKE
              ${`%${oldInGameName}%`}
          `;

          await tx.$executeRaw`
            UPDATE "notifications"
            SET
              "title" =
                replace(
                  "title",
                  ${oldInGameName},
                  ${anonymousInGameName}
                ),
              "message" =
                replace(
                  "message",
                  ${oldInGameName},
                  ${anonymousInGameName}
                ),
              "updatedAt" =
                NOW()
            WHERE
              "title" LIKE
                ${`%${oldInGameName}%`}
              OR
              "message" LIKE
                ${`%${oldInGameName}%`}
          `;
        }

        if (
          oldPlayerCode
        ) {
          await tx.$executeRaw`
            UPDATE "ballon_ranking_snapshots"
            SET "rows" =
              replace(
                "rows"::text,
                ${oldPlayerCode},
                ${anonymousPlayerCode}
              )::jsonb
            WHERE "rows"::text LIKE
              ${`%${oldPlayerCode}%`}
          `;

          await tx.$executeRaw`
            UPDATE "ranking_snapshots"
            SET "positions" =
              replace(
                "positions"::text,
                ${oldPlayerCode},
                ${anonymousPlayerCode}
              )::jsonb
            WHERE "positions"::text LIKE
              ${`%${oldPlayerCode}%`}
          `;
        }

        if (
          user.player
        ) {
          await tx.player.update({
            where: {
              id:
                user.player.id,
            },
            data: {
              playerCode:
                anonymousPlayerCode,
              profileImageUrl:
                null,
            },
          });

          if (
            user.player
              .identity
          ) {
            await tx.playerIdentity.update({
              where: {
                playerId:
                  user.player.id,
              },
              data: {
                inGameName:
                  anonymousInGameName,
                inGameNameNormalized:
                  anonymousInGameName
                    .toLowerCase(),
                gameUid:
                  null,
                isVerified:
                  false,
                verifiedAt:
                  null,
                lockedAt:
                  new Date(),
              },
            });
          }
        }

        await tx.user.update({
          where: {
            id:
              userId,
          },
          data: {
            fullName:
              anonymousName,
            email:
              anonymousEmail,
            phoneNumber:
              null,
            passwordHash:
              randomPassword,
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

        await tx.auditLog.create({
          data: {
            actorUserId:
              null,
            action:
              'ACCOUNT_DELETION_COMPLETED',
            targetType:
              'DELETED_ACCOUNT',
            targetId:
              anonymousTargetId,
            scopeType:
              'GLOBAL',
            scopeId:
              'PRIVACY',
            metadata: {
              completedAt:
                new Date()
                  .toISOString(),
              retained:
                'De-identified competition, integrity and security records only.',
            },
          },
        });
      },
      {
        isolationLevel:
          'Serializable',
      },
    );

    return {
      success: true,
      data: {
        accountDeleted:
          true,
        message:
          'Your FC ARENA account has been deleted. Competition history that must remain has been de-identified.',
      },
      error: null,
    };
  }

  async login(dto: LoginDto) {
    const identifier =
      normalizeLoginIdentifier(
        dto.identifier ??
        dto.email ??
        '',
      );

    if (!identifier) {
      throw this.invalidCredentials();
    }

    const userInclude = {
      player: {
        include: {
          identity: true,
        },
      },
    } as const;

    const user =
      identifier.includes('@')
        ? await this.prisma.user.findUnique({
            where: {
              email:
                identifier.toLowerCase(),
            },
            include:
              userInclude,
          })
        : (
            await this.prisma.playerIdentity.findUnique({
              where: {
                inGameNameNormalized:
                  identifier.toLowerCase(),
              },
              include: {
                player: {
                  include: {
                    user: {
                      include:
                        userInclude,
                    },
                  },
                },
              },
            })
          )?.player.user ??
          null;

    if (!user) {
      throw this.invalidCredentials();
    }

    const passwordValid =
      await this.passwordMatches(
        dto.password,
        user.passwordHash,
      );

    if (!passwordValid) {
      throw this.invalidCredentials();
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message: 'This account is not active. Contact an administrator if you need help.',
        },
      });
    }

    const tokens = await this.createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const themePreference =
      await this.getThemePreference(
        user.id,
      );

    return {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: ACCESS_TOKEN_SECONDS,
        user: this.publicUser({
          ...user,
          themePreference,
        }),
      },
      error: null,
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
          algorithms: ['HS256'],
        },
      );

      if (payload.type !== 'refresh' || typeof payload.sub !== 'string' || !payload.sub || typeof payload.sid !== 'string' || !payload.sid) {
        throw new Error('Invalid token type.');
      }
    } catch {
      throw this.invalidRefreshToken();
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            player: {
              include: {
                identity: true,
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw this.invalidRefreshToken();
    }

    const suppliedHash = this.hashToken(refreshToken);
    const storedHash = session.tokenHash;

    const hashesMatch =
      suppliedHash.length === storedHash.length &&
      timingSafeEqual(
        Buffer.from(suppliedHash, 'hex'),
        Buffer.from(storedHash, 'hex'),
      );

    if (!hashesMatch) {
      throw this.invalidRefreshToken();
    }

    if (session.user.status !== 'ACTIVE') {
      throw this.invalidRefreshToken();
    }

    const newSessionId = randomUUID();

    const newTokens = await this.buildTokens(
      {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
      newSessionId,
    );

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_SECONDS * 1000,
    );

    const rotated =
      await this.prisma.$transaction(
        async (tx) => {
          const claimed =
            await tx.refreshSession.updateMany({
              where: {
                id:
                  session.id,
                userId:
                  payload.sub,
                tokenHash:
                  suppliedHash,
                revokedAt:
                  null,
                expiresAt: {
                  gt:
                    new Date(),
                },
                user: { is: { status: 'ACTIVE', passwordHash: session.user.passwordHash } },
              },
              data: {
                revokedAt:
                  new Date(),
              },
            });

          if (
            claimed.count !==
            1
          ) {
            return false;
          }

          await tx.refreshSession.create({
            data: {
              id:
                newSessionId,
              userId:
                session.user.id,
              tokenHash:
                this.hashToken(
                  newTokens.refreshToken,
                ),
              expiresAt,
            },
          });

          await tx.pushDevice.updateMany({where:{sessionId:session.id,userId:session.user.id},data:{sessionId:newSessionId}});
          return true;
        },
      );

    if (!rotated) {
      throw this.invalidRefreshToken();
    }

    const themePreference =
      await this.getThemePreference(
        session.user.id,
      );

    return {
      success: true,
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: ACCESS_TOKEN_SECONDS,
        user: this.publicUser({
          ...session.user,
          themePreference,
        }),
      },
      error: null,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      let payload: RefreshTokenPayload | undefined;
      try {
        payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
          secret: this.refreshSecret,
          algorithms: ['HS256'],
        });
      } catch {
        // An invalid/expired token is already logged out. Storage failures below
        // must propagate instead of falsely reporting successful revocation.
      }
      if (payload?.type === 'refresh' && typeof payload.sub === 'string' && payload.sub && typeof payload.sid === 'string' && payload.sid) {
        await this.prisma.refreshSession.updateMany({
          where: { id: payload.sid, userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    return {
      success: true,
      data: {
        message: 'Logged out successfully.',
      },
      error: null,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        player: {
          include: {
            identity: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account could not be found.',
        },
      });
    }

    const themePreference =
      await this.getThemePreference(
        user.id,
      );

    return {
      success: true,
      data: {
        user: this.publicUser({
          ...user,
          themePreference,
        }),
      },
      error: null,
    };
  }

  async updateThemePreference(
    userId: string,
    themePreference: ThemePreferenceValue,
  ) {
    const updated =
      await this.prisma.$executeRaw`
        UPDATE "users"
        SET
          "themePreference" =
            ${themePreference}::"ThemePreference",
          "updatedAt" = NOW()
        WHERE "id" = ${userId}::uuid
      `;

    if (
      updated ===
      0
    ) {
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code:
            'ACCOUNT_NOT_FOUND',
          message:
            'Account could not be found.',
        },
      });
    }

    return {
      success: true,
      data: {
        message:
          'Theme preference updated.',
        themePreference,
      },
      error: null,
    };
  }

  private async getThemePreference(
    userId: string,
  ): Promise<ThemePreferenceValue> {
    const rows =
      await this.prisma.$queryRaw<
        Array<{
          themePreference:
            ThemePreferenceValue;
        }>
      >`
        SELECT
          "themePreference"
        FROM "users"
        WHERE "id" =
          ${userId}::uuid
        LIMIT 1
      `;

    return (
      rows[0]
        ?.themePreference ??
      'CLASSIC_BLUE'
    );
  }

  private async getLatestOtp(
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ) {
    return this.prisma.authOtp.findFirst({
      where: {
        userId,
        purpose,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async validateOtpRecord(
    otpRecord: {
      id: string;
      codeHash: string;
      attempts: number;
      expiresAt: Date;
    } | null,
    submittedOtp: string,
  ): Promise<void> {
    if (!otpRecord || otpRecord.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'OTP_EXPIRED',
          message: 'The OTP has expired. Request a new OTP.',
        },
      });
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new HttpException(
        {
          success: false,
          data: null,
          error: {
            code: 'OTP_ATTEMPT_LIMIT',
            message: 'Too many incorrect OTP attempts. Request a new OTP.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reserve an attempt atomically before checking the hash. Parallel requests
    // cannot exceed the configured attempt budget using the same stale record.
    const attempt = await this.prisma.authOtp.updateMany({
      where: { id: otpRecord.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count !== 1) {
      throw new BadRequestException({ success: false, data: null, error: {
        code: 'OTP_INVALID', message: 'The OTP is invalid or expired.',
      } });
    }

    const valid = await bcrypt.compare(
      submittedOtp,
      otpRecord.codeHash,
    );

    if (!valid) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'OTP_INVALID',
          message: 'The OTP is incorrect.',
        },
      });
    }
  }

  private async consumeValidatedOtp(
    tx: Prisma.TransactionClient,
    otpId: string,
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
    now: Date,
  ): Promise<void> {
    const claimed = await tx.authOtp.updateMany({
      where: { id: otpId, userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) {
      throw this.invalidPasswordReset();
    }
    await tx.authOtp.updateMany({
      where: { userId, purpose, consumedAt: null }, data: { consumedAt: now },
    });
  }

  private async enforceOtpRateLimit(
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ): Promise<void> {
    const latestOtp = await this.prisma.authOtp.findFirst({
      where: {
        userId,
        purpose,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (
      latestOtp &&
      latestOtp.createdAt.getTime() >
        Date.now() - OTP_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        {
          success: false,
          data: null,
          error: {
            code: 'OTP_RESEND_COOLDOWN',
            message:
              'Please wait 60 seconds before requesting another OTP.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentCount = await this.prisma.authOtp.count({
      where: {
        userId,
        purpose,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (recentCount >= OTP_HOURLY_LIMIT) {
      throw new HttpException(
        {
          success: false,
          data: null,
          error: {
            code: 'OTP_RESEND_LIMIT',
            message: 'OTP request limit reached. Try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async createOtp(
    userId: string,
    purpose:
      | 'EMAIL_VERIFICATION'
      | 'PASSWORD_RESET',
  ): Promise<{
    id: string;
    otp: string;
  }> {
    const otp =
      this.generateOtp();

    const codeHash =
      await bcrypt.hash(
        otp,
        10,
      );

    const expiresAt =
      new Date(
        Date.now() +
          OTP_EXPIRY_MINUTES *
            60 *
            1000,
      );

    const record =
      await this.prisma.authOtp.create({
        data: {
          userId,
          purpose,
          codeHash,
          expiresAt,
        },

        select: {
          id: true,
        },
      });

    return {
      id: record.id,
      otp,
    };
  }


  private async consumeOlderOtps(
    userId: string,
    purpose:
      | 'EMAIL_VERIFICATION'
      | 'PASSWORD_RESET',
    keepOtpId: string,
  ): Promise<void> {
    await this.prisma.authOtp.updateMany({
      where: {
        userId,
        purpose,
        consumedAt: null,

        id: {
          not:
            keepOtpId,
        },
      },

      data: {
        consumedAt:
          new Date(),
      },
    });
  }

  private async createSession(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const sessionId = randomUUID();
    const tokens = await this.buildTokens(user, sessionId);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_SECONDS * 1000,
        ),
      },
    });

    return tokens;
  }

  private async buildTokens(
    user: {
      id: string;
      email: string;
      role: string;
    },
    sessionId: string,
  ) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      sid: sessionId,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sid: sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: ACCESS_TOKEN_SECONDS,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: REFRESH_TOKEN_SECONDS,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private publicUser(user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role: string;
    status: string;
    themePreference:
      ThemePreferenceValue;
    player: {
      playerCode: string;
      profileImageUrl: string | null;
      identity: {
        inGameName: string;
        gameUid: string | null;
        isVerified: boolean;
      } | null;
    } | null;
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      themePreference:
        user.themePreference,
      player: user.player
        ? {
            playerCode: user.player.playerCode,
            profileImageUrl: user.player.profileImageUrl,
            identity: user.player.identity
              ? {
                  inGameName: user.player.identity.inGameName,
                  gameUid: user.player.identity.gameUid,
                  isVerified: user.player.identity.isVerified,
                }
              : null,
          }
        : null,
    };
  }

  private async removeDeletedAccountProfileImage(
    playerId:
      string,
  ) {
    const cloudinaryUrl =
      process.env
        .CLOUDINARY_URL
        ?.trim();

    let cloudName =
      process.env
        .CLOUDINARY_CLOUD_NAME
        ?.trim();

    let apiKey =
      process.env
        .CLOUDINARY_API_KEY
        ?.trim();

    let apiSecret =
      process.env
        .CLOUDINARY_API_SECRET
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
          'cloudinary:'
        ) {
          cloudName =
            parsed.hostname;

          apiKey =
            decodeURIComponent(
              parsed.username,
            );

          apiSecret =
            decodeURIComponent(
              parsed.password,
            );
        }
      } catch {
        // Fall through to
        // individual variables.
      }
    }

    if (
      !cloudName ||
      !apiKey ||
      !apiSecret
    ) {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code:
            'ACCOUNT_DELETION_IMAGE_CLEANUP_UNAVAILABLE',
          message:
            'Account deletion could not verify profile-image cleanup. Please retry later.',
        },
      });
    }

    const timestamp =
      Math.floor(
        Date.now() /
          1000,
      );

    const publicId =
      `fc-arena/players/${playerId}/profile`;

    const unsigned =
      [
        'invalidate=true',
        `public_id=${publicId}`,
        `timestamp=${timestamp}`,
      ].join(
        '&',
      );

    const signature =
      createHash(
        'sha1',
      )
        .update(
          `${unsigned}${apiSecret}`,
        )
        .digest(
          'hex',
        );

    const formData =
      new FormData();

    formData.append(
      'api_key',
      apiKey,
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

    try {
      const response =
        await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(
            cloudName,
          )}/image/destroy`,
          {
            method:
              'POST',
            body:
              formData,
          },
        );

      const payload =
        await response.json() as {
          error?: {
            message?:
              string;
          };
        };

      if (
        !response.ok ||
        payload.error
      ) {
        throw new Error(
          'Profile image cleanup failed.',
        );
      }
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code:
            'ACCOUNT_DELETION_IMAGE_CLEANUP_FAILED',
          message:
            'Account deletion could not verify profile-image cleanup. Please retry later.',
        },
      });
    }
  }

  private async removeDeletedAccountOcrArtifacts(
    rawPaths:
      string[],
  ) {
    const paths =
      [
        ...new Set(
          rawPaths.filter(
            Boolean,
          ),
        ),
      ];

    for (
      const path
      of paths
    ) {
      if (
        path.startsWith(
          'redacted://',
        )
      ) {
        continue;
      }

      try {
        await unlink(
          path,
        );
      } catch (
        error
      ) {
        const code =
          (
            error as {
              code?:
                string;
            }
          ).code;

        if (
          code ===
          'ENOENT'
        ) {
          continue;
        }

        throw new ServiceUnavailableException({
          success: false,
          data: null,
          error: {
            code:
              'ACCOUNT_DELETION_OCR_CLEANUP_FAILED',
            message:
              'Account deletion could not verify stored screenshot cleanup. Please retry later.',
          },
        });
      }
    }
  }

  private async passwordMatches(
    submittedPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    if (
      await bcrypt.compare(
        submittedPassword,
        storedHash,
      )
    ) {
      return true;
    }

    const mobileNormalized =
      submittedPassword
        .normalize('NFKC')
        .trim();

    if (
      mobileNormalized ===
      submittedPassword
    ) {
      return false;
    }

    return bcrypt.compare(
      mobileNormalized,
      storedHash,
    );
  }


  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private formatPlayerCode(serialNumber: number): string {
    return `FCA-P-${serialNumber.toString().padStart(6, '0')}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private genericVerificationResponse() {
    return {
      success: true,
      data: {
        message:
          'If an unverified account exists, a new verification code has been generated.',
      },
      error: null,
    };
  }

  private genericPasswordResetResponse() {
    return {
      success: true,
      data: {
        message:
          'If the account exists, a password reset OTP has been generated.',
      },
      error: null,
    };
  }

  private registrationConflict() {
    return new ConflictException({
      success: false,
      data: null,
      error: {
        code:
          'REGISTRATION_CONFLICT',
        message:
          'Unable to create an account with the supplied details.',
      },
    });
  }

  private invalidPasswordReset() {
    return new BadRequestException({
      success: false,
      data: null,
      error: {
        code:
          'INVALID_PASSWORD_RESET',
        message:
          'Unable to reset this password using the supplied details.',
      },
    });
  }

  private invalidCredentials() {
    return new UnauthorizedException({
      success: false,
      data: null,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email, Game Name, or password is incorrect.',
      },
    });
  }

  private invalidRefreshToken() {
    return new UnauthorizedException({
      success: false,
      data: null,
      error: {
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh session is invalid or expired.',
      },
    });
  }
}