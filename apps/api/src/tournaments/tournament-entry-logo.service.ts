import { assertImageFormat } from '../security/image-format.js';
import {
  BadRequestException,
  ConflictException,
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
  error?: { message?: string };
}

interface CloudinaryDestroyResponse {
  result?: string;
  error?: { message?: string };
}

@Injectable()
export class TournamentEntryLogoService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async uploadLogo(
    userId: string,
    tournamentId: string,
    registrationId: string,
    file: Express.Multer.File,
  ) {
    const access = await this.assertCanManageEntryLogo(
      userId,
      tournamentId,
      registrationId,
    );

    if (!file?.buffer?.length) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_REQUIRED',
          message: 'Select a team logo to upload.',
        },
      });
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_TOO_LARGE',
          message: 'Team logo must be 2 MB or smaller.',
        },
      });
    }

    const allowed = new Set([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);

    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_ENTRY_LOGO_TYPE',
          message: 'Only PNG, JPG, JPEG and WEBP team logos are allowed.',
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
        metadata.width < 128 ||
        metadata.height < 128 ||
        metadata.width > 8000 ||
        metadata.height > 8000
      ) {
        throw new Error('Entry logo dimensions are not allowed.');
      }

      optimized = await image
        .rotate()
        .resize(512, 512, {
          fit: 'cover',
          position: 'attention',
        })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: 'INVALID_ENTRY_LOGO',
          message: 'Use a readable square-friendly image between 128 px and 8000 px.',
        },
      });
    }

    const { cloudName, apiKey, apiSecret } = this.cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = this.publicId(tournamentId, registrationId);
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
      new Blob([new Uint8Array(optimized)], { type: 'image/webp' }),
      'team-logo.webp',
    );
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('overwrite', 'true');
    formData.append('invalidate', 'true');
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      { method: 'POST', body: formData },
    );

    const payload = await response.json() as CloudinaryUploadResponse;

    if (!response.ok || !payload.secure_url) {
      throw new InternalServerErrorException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_UPLOAD_FAILED',
          message: payload.error?.message ?? 'Team logo could not be uploaded.',
        },
      });
    }

    const updated = await this.prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: { entryLogoUrl: payload.secure_url },
      select: {
        id: true,
        entryName: true,
        entryLogoUrl: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: access.isAdmin ? 'ENTRY_LOGO_ADMIN_UPDATED' : 'ENTRY_LOGO_UPDATED',
        targetType: 'TournamentRegistration',
        targetId: registrationId,
        scopeType: 'TOURNAMENT',
        scopeId: tournamentId,
        afterData: {
          entryLogoUrl: updated.entryLogoUrl,
        },
      },
    });

    return {
      success: true,
      data: {
        message: 'Team logo updated.',
        entry: updated,
      },
      error: null,
    };
  }

  async removeLogo(
    userId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    const access = await this.assertCanManageEntryLogo(
      userId,
      tournamentId,
      registrationId,
    );

    const { cloudName, apiKey, apiSecret } = this.cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = this.publicId(tournamentId, registrationId);
    const signature = this.sign(
      {
        invalidate: 'true',
        public_id: publicId,
        timestamp: String(timestamp),
      },
      apiSecret,
    );

    if (access.entry.entryLogoUrl) {
      const formData = new FormData();
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('public_id', publicId);
      formData.append('invalidate', 'true');
      formData.append('signature', signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`,
        { method: 'POST', body: formData },
      );

      const payload = await response.json() as CloudinaryDestroyResponse;

      if (!response.ok && payload.error) {
        throw new InternalServerErrorException({
          success: false,
          data: null,
          error: {
            code: 'ENTRY_LOGO_REMOVE_FAILED',
            message: 'Team logo could not be removed.',
          },
        });
      }
    }

    const updated = await this.prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: { entryLogoUrl: null },
      select: {
        id: true,
        entryName: true,
        entryLogoUrl: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: access.isAdmin ? 'ENTRY_LOGO_ADMIN_REMOVED' : 'ENTRY_LOGO_REMOVED',
        targetType: 'TournamentRegistration',
        targetId: registrationId,
        scopeType: 'TOURNAMENT',
        scopeId: tournamentId,
        afterData: { entryLogoUrl: null },
      },
    });

    return {
      success: true,
      data: {
        message: 'Team logo removed.',
        entry: updated,
      },
      error: null,
    };
  }

  private async assertCanManageEntryLogo(
    userId: string,
    tournamentId: string,
    registrationId: string,
  ) {
    const entry = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      include: {
        tournament: {
          select: {
            id: true,
            leagueId: true,
            status: true,
          },
        },
        members: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!entry || entry.tournamentId !== tournamentId) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: 'TOURNAMENT_ENTRY_NOT_FOUND',
          message: 'Tournament entry could not be found.',
        },
      });
    }

    const admin = await this.prisma.leagueAdmin.findUnique({
      where: {
        leagueId_userId: {
          leagueId: entry.tournament.leagueId,
          userId,
        },
      },
    });

    const ownsEntry =
      entry.registeredByUserId === userId ||
      entry.members.length > 0;

    if (!admin && !ownsEntry) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_PERMISSION_REQUIRED',
          message: 'Only this entry’s players or a League Admin can manage its logo.',
        },
      });
    }

    if (
      !admin &&
      !['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(
        entry.tournament.status,
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_LOCKED',
          message: 'Team logos are locked for players once the Tournament starts. Ask an admin to change it.',
        },
      });
    }

    if (
      admin &&
      ['COMPLETED', 'CANCELLED'].includes(entry.tournament.status)
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: 'ENTRY_LOGO_LOCKED',
          message: 'Team logos are locked after the Tournament is completed or cancelled.',
        },
      });
    }

    return {
      entry,
      isAdmin: Boolean(admin),
    };
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
          return { cloudName, apiKey, apiSecret };
        }
      } catch {
        // Fall through to individual variables.
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
          message: 'Team logo storage is not configured. Add CLOUDINARY_URL to the Railway API service.',
        },
      });
    }

    return { cloudName, apiKey, apiSecret };
  }

  private publicId(
    tournamentId: string,
    registrationId: string,
  ) {
    return `fc-arena/tournaments/${tournamentId}/entries/${registrationId}/logo`;
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
