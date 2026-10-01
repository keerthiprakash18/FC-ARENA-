import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  createHash,
} from 'node:crypto';
import sharp from 'sharp';

import {
  PrismaService,
} from '../database/prisma.service.js';

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class LeagueWarProofService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async uploadProof(
    userId: string,
    warId: string,
    matchId: string,
    file:
      Express.Multer.File,
  ) {
    const war =
      await this.prisma.leagueWar.findUnique({
        where: {
          id:
            warId,
        },
        select: {
          id: true,
          status: true,
          homeLeagueId: true,
          awayLeagueId: true,
        },
      });

    if (!war) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_NOT_FOUND',
          message:
            'League War could not be found.',
        },
      });
    }

    if (
      war.status !==
      'LIVE'
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_NOT_LIVE',
          message:
            'Match proof can only be uploaded while the League War is LIVE.',
        },
      });
    }

    const [
      user,
      admin,
      match,
    ] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id:
              userId,
          },
          select: {
            role: true,
          },
        }),
        this.prisma.leagueAdmin.findFirst({
          where: {
            userId,
            leagueId: {
              in: [
                war.homeLeagueId,
                war.awayLeagueId,
              ],
            },
          },
          select: {
            id: true,
          },
        }),
        this.prisma.leagueWarMatch.findUnique({
          where: {
            id:
              matchId,
          },
          select: {
            id: true,
            warId: true,
          },
        }),
      ]);

    if (
      user?.role !==
        'SUPER_ADMIN' &&
      !admin
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_ADMIN_REQUIRED',
          message:
            'League owner or admin permission is required.',
        },
      });
    }

    if (
      !match ||
      match.warId !==
        warId
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_MATCH_NOT_FOUND',
          message:
            'League War match could not be found.',
        },
      });
    }

    if (
      !file ||
      !file.buffer ||
      file.buffer.length ===
        0
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_PROOF_REQUIRED',
          message:
            'Select a screenshot to upload.',
        },
      });
    }

    if (
      file.size >
      8 * 1024 * 1024
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_PROOF_TOO_LARGE',
          message:
            'Match proof screenshot must be 8 MB or smaller.',
        },
      });
    }

    const allowed =
      new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
      ]);

    if (
      !allowed.has(
        file.mimetype,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_LEAGUE_WAR_PROOF_TYPE',
          message:
            'Only PNG, JPG, JPEG and WEBP screenshots are allowed.',
        },
      });
    }

    let optimized:
      Buffer;

    try {
      const image =
        sharp(
          file.buffer,
        );

      const metadata =
        await image.metadata();

      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width >
          8000 ||
        metadata.height >
          8000
      ) {
        throw new Error(
          'Invalid dimensions.',
        );
      }

      optimized =
        await image
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit:
              'inside',
            withoutEnlargement:
              true,
          })
          .webp({
            quality: 86,
          })
          .toBuffer();
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_LEAGUE_WAR_PROOF',
          message:
            'The selected proof is not a readable image.',
        },
      });
    }

    const {
      cloudName,
      apiKey,
      apiSecret,
    } =
      this.cloudinaryConfig();

    const timestamp =
      Math.floor(
        Date.now() /
          1000,
      );

    const publicId =
      `fc-arena/league-wars/${warId}/matches/${matchId}/proof`;

    const signature =
      this.sign(
        {
          invalidate:
            'true',
          overwrite:
            'true',
          public_id:
            publicId,
          timestamp:
            String(
              timestamp,
            ),
        },
        apiSecret,
      );

    const formData =
      new FormData();

    formData.append(
      'file',
      new Blob(
        [
          new Uint8Array(
            optimized,
          ),
        ],
        {
          type:
            'image/webp',
        },
      ),
      'match-proof.webp',
    );

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
      'overwrite',
      'true',
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
          cloudName,
        )}/image/upload`,
        {
          method:
            'POST',
          body:
            formData,
        },
      );

    const payload =
      await response.json() as
        CloudinaryUploadResponse;

    if (
      !response.ok ||
      !payload.secure_url
    ) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_WAR_PROOF_UPLOAD_FAILED',
          message:
            payload.error
              ?.message ??
            'Match proof screenshot could not be uploaded.',
        },
      });
    }

    await this.prisma.leagueWarMatch.update({
      where: {
        id:
          matchId,
      },
      data: {
        proofUrl:
          payload.secure_url,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Match proof uploaded.',
        proofUrl:
          payload.secure_url,
      },
      error: null,
    };
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
          parsed.protocol !==
          'cloudinary:'
        ) {
          throw new Error();
        }

        const cloudName =
          parsed.hostname;
        const apiKey =
          decodeURIComponent(
            parsed.username,
          );
        const apiSecret =
          decodeURIComponent(
            parsed.password,
          );

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
      !cloudName ||
      !apiKey ||
      !apiSecret
    ) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        error: {
          code:
            'IMAGE_STORAGE_NOT_CONFIGURED',
          message:
            'Image storage is not configured.',
        },
      });
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
    };
  }

  private sign(
    values:
      Record<
        string,
        string
      >,
    apiSecret:
      string,
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
}
