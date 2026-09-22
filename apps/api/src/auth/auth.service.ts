import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './auth.types.js';
import { OtpMailService } from './mail.service.js';
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
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account already exists with this email address.',
        },
      });
    }

    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (existingPhone) {
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'PHONE_ALREADY_REGISTERED',
            message: 'An account already exists with this phone number.',
          },
        });
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
        throw new ConflictException({
          success: false,
          data: null,
          error: {
            code: 'GAME_UID_TAKEN',
            message: 'This game UID is already registered.',
          },
        });
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

    const otpRecord = await this.getLatestOtp(
      user.id,
      'EMAIL_VERIFICATION',
    );

    await this.validateOtpRecord(otpRecord, dto.otp);

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'ACTIVE',
          emailVerifiedAt: now,
        },
      }),
      this.prisma.authOtp.updateMany({
        where: {
          userId: user.id,
          purpose: 'EMAIL_VERIFICATION',
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      }),
    ]);

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

    if (!user) {
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
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_PASSWORD_RESET',
          message: 'Unable to reset this password.',
        },
      });
    }

    const otpRecord = await this.getLatestOtp(
      user.id,
      'PASSWORD_RESET',
    );

    await this.validateOtpRecord(otpRecord, dto.otp);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
        },
      }),
      this.prisma.authOtp.updateMany({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      }),
      this.prisma.refreshSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        message:
          'Password reset successfully. Sign in using the new password.',
      },
      error: null,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        player: {
          include: {
            identity: true,
          },
        },
      },
    });

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
        },
      );

      if (payload.type !== 'refresh') {
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

    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
        },
      }),
      this.prisma.refreshSession.create({
        data: {
          id: newSessionId,
          userId: session.user.id,
          tokenHash: this.hashToken(newTokens.refreshToken),
          expiresAt,
        },
      }),
    ]);

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
      try {
        const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
          refreshToken,
          {
            secret: this.refreshSecret,
          },
        );

        if (payload.type === 'refresh') {
          await this.prisma.refreshSession.updateMany({
            where: {
              id: payload.sid,
              userId: payload.sub,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
            },
          });
        }
      } catch {
        // Invalid or expired token behaves as already logged out.
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

    const valid = await bcrypt.compare(
      submittedOtp,
      otpRecord.codeHash,
    );

    if (!valid) {
      await this.prisma.authOtp.update({
        where: { id: otpRecord.id },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

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

  private invalidCredentials() {
    return new UnauthorizedException({
      success: false,
      data: null,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
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