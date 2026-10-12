import { assertImageFormat } from '../security/image-format.js';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../database/prisma.service.js';

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: {
    message?: string;
  };
}

interface CloudinaryDestroyResponse {
  result?: string;
  error?: {
    message?: string;
  };
}

@Injectable()
export class LeagueLogoService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async uploadLogo(
    userId: string,
    leagueId: string,
    file: Express.Multer.File,
  ) {
    const league = await this.assertAdmin(userId, leagueId);

    if (!file?.buffer?.length) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_LOGO_REQUIRED',
          message: 'Select a League logo to upload.',
        },
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_LOGO_TOO_LARGE',
          message: 'League logo must be 5 MB or smaller.',
        },
      });
    }

    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_LEAGUE_LOGO_TYPE',
          message: 'Only PNG, JPG, JPEG and WEBP images are allowed.',
        },
      });
    }

    let optimized: Buffer;

    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 64_000_000,
      });

      const metadata = await image.metadata();
      assertImageFormat(file.mimetype, metadata.format);

      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > 8000 ||
        metadata.height > 8000
      ) {
        throw new Error('League logo dimensions are not allowed.');
      }

      optimized = await image
        .rotate()
        .resize(512, 512, {
          fit: 'cover',
          position: 'center',
        })
        .webp({
          quality: 90,
        })
        .toBuffer();
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_LEAGUE_LOGO',
          message: 'The selected League logo is not a readable image.',
        },
      });
    }

    const {
      cloudName,
      apiKey,
      apiSecret,
    } = this.cloudinaryConfig();

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = this.publicId(league.id);
    const signature = this.sign(
      {
        invalidate: 'true',
        overwrite: 'true',
        public_id: publicId,
        timestamp: String(timestamp),
      },
      apiSecret,
    );

    const formData = new FormData();

    formData.append(
      'file',
      new Blob(
        [new Uint8Array(optimized)],
        {
          type: 'image/webp',
        },
      ),
      'league-logo.webp',
    );
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(
        cloudName,
      )}/image/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );

    const payload = await response.json() as CloudinaryUploadResponse;

    if (!response.ok || !payload.secure_url) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_LOGO_UPLOAD_FAILED',
          message:
            payload.error?.message ??
            'League logo could not be uploaded.',
        },
      });
    }

    const updated = await this.prisma.league.update({
      where: {
        id: league.id,
      },
      data: {
        logoUrl: payload.secure_url,
      },
      select: {
        logoUrl: true,
      },
    });

    return {
      success: true,
      data: {
        message: 'League logo updated.',
        logoUrl: updated.logoUrl,
      },
      error: null,
    };
  }

  async removeLogo(
    userId: string,
    leagueId: string,
  ) {
    const league = await this.assertAdmin(userId, leagueId);

    if (league.logoUrl) {
      const {
        cloudName,
        apiKey,
        apiSecret,
      } = this.cloudinaryConfig();

      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = this.publicId(league.id);
      const signature = this.sign(
        {
          invalidate: 'true',
          public_id: publicId,
          timestamp: String(timestamp),
        },
        apiSecret,
      );

      const formData = new FormData();
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('public_id', publicId);
      formData.append('invalidate', 'true');
      formData.append('signature', signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(
          cloudName,
        )}/image/destroy`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const payload = await response.json() as CloudinaryDestroyResponse;

      if (!response.ok && payload.error) {
        throw new InternalServerErrorException({
          success: false,
          data: null,
          error: {
            code: 'LEAGUE_LOGO_REMOVE_FAILED',
            message:
              payload.error.message ??
              'League logo could not be removed.',
          },
        });
      }
    }

    await this.prisma.league.update({
      where: {
        id: league.id,
      },
      data: {
        logoUrl: null,
      },
    });

    return {
      success: true,
      data: {
        message: 'League logo removed.',
        logoUrl: null,
      },
      error: null,
    };
  }

  private async assertAdmin(
    userId: string,
    leagueId: string,
  ) {
    const league = await this.prisma.league.findUnique({
      where: {
        id: leagueId,
      },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    if (!league) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_NOT_FOUND',
          message: 'League could not be found.',
        },
      });
    }

    const admin = await this.prisma.leagueAdmin.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!admin) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'LEAGUE_ADMIN_REQUIRED',
          message: 'Only League admins can change the League logo.',
        },
      });
    }

    return league;
  }

  private cloudinaryConfig() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

    if (cloudinaryUrl) {
      try {
        const parsed = new URL(cloudinaryUrl);

        if (parsed.protocol !== 'cloudinary:') {
          throw new Error('Invalid Cloudinary protocol.');
        }

        const apiKey = decodeURIComponent(parsed.username);
        const apiSecret = decodeURIComponent(parsed.password);
        const cloudName = parsed.hostname;

        if (cloudName && apiKey && apiSecret) {
          return {
            cloudName,
            apiKey,
            apiSecret,
          };
        }
      } catch {
        // Fall through to individual environment variables.
      }
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        error: {
          code: 'IMAGE_STORAGE_NOT_CONFIGURED',
          message:
            'League image storage is not configured on the API service.',
        },
      });
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
    };
  }

  private publicId(leagueId: string) {
    return `fc-arena/leagues/${leagueId}/logo`;
  }

  private sign(
    values: Record<string, string>,
    apiSecret: string,
  ) {
    const unsigned = Object.entries(values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return createHash('sha1')
      .update(`${unsigned}${apiSecret}`)
      .digest('hex');
  }
}
