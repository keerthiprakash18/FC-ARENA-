import {
  BadRequestException,
  ConflictException,
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
  public_id?: string;
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
export class TournamentLogoService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async uploadLogo(
    userId: string,
    tournamentId: string,
    file:
      Express.Multer.File,
  ) {
    await this.assertEditableTournament(
      userId,
      tournamentId,
    );

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
            'TOURNAMENT_LOGO_REQUIRED',
          message:
            'Select a Tournament logo to upload.',
        },
      });
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_LOGO_TOO_LARGE',
          message:
            'Tournament logo must be 5 MB or smaller.',
        },
      });
    }

    const allowedMimeTypes =
      new Set([
        'image/png',
        'image/jpeg',
        'image/webp',
      ]);

    if (
      !allowedMimeTypes.has(
        file.mimetype,
      )
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_TOURNAMENT_LOGO_TYPE',
          message:
            'Only PNG, JPG, JPEG and WEBP images are allowed.',
        },
      });
    }

    try {
      const metadata =
        await sharp(
          file.buffer,
        ).metadata();

      if (
        ![
          'png',
          'jpeg',
          'webp',
        ].includes(
          metadata.format ??
            '',
        )
      ) {
        throw new Error(
          'Unsupported image format.',
        );
      }

      if (
        !metadata.width ||
        !metadata.height
      ) {
        throw new Error(
          'Image dimensions are unavailable.',
        );
      }

      if (
        metadata.width >
          8000 ||
        metadata.height >
          8000
      ) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code:
              'TOURNAMENT_LOGO_DIMENSIONS_TOO_LARGE',
            message:
              'Tournament logo dimensions are too large. Use an image up to 8000 × 8000 px.',
          },
        });
      }
    } catch (
      error
    ) {
      if (
        error instanceof
        BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_TOURNAMENT_LOGO',
          message:
            'The selected Tournament logo is not a readable image.',
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
      this.publicId(
        tournamentId,
      );

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
            file.buffer,
          ),
        ],
        {
          type:
            file.mimetype,
        },
      ),
      file.originalname ||
        'tournament-logo',
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
            'TOURNAMENT_LOGO_UPLOAD_FAILED',
          message:
            payload.error
              ?.message ??
            'Tournament logo could not be uploaded.',
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
          logoUrl:
            payload.secure_url,
        },
        select: {
          id: true,
          logoUrl: true,
        },
      });

    return {
      success: true,
      data: {
        message:
          'Tournament logo uploaded.',
        logoUrl:
          updated.logoUrl,
      },
      error: null,
    };
  }


  async removeLogo(
    userId: string,
    tournamentId: string,
  ) {
    const tournament =
      await this.assertEditableTournament(
        userId,
        tournamentId,
      );

    const {
      cloudName,
      apiKey,
      apiSecret,
    } =
      this.cloudinaryConfig();

    if (
      tournament.logoUrl
    ) {
      const timestamp =
        Math.floor(
          Date.now() /
            1000,
        );

      const publicId =
        this.publicId(
          tournamentId,
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
          apiSecret,
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
        await response.json() as
          CloudinaryDestroyResponse;

      if (
        !response.ok &&
        payload.error
      ) {
        throw new InternalServerErrorException({
          success: false,
          data: null,
          error: {
            code:
              'TOURNAMENT_LOGO_REMOVE_FAILED',
            message:
              payload.error.message ??
              'Tournament logo could not be removed.',
          },
        });
      }
    }

    await this.prisma.tournament.update({
      where: {
        id:
          tournamentId,
      },
      data: {
        logoUrl:
          null,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Tournament logo removed.',
        logoUrl:
          null,
      },
      error: null,
    };
  }


  private async assertEditableTournament(
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
          id: true,
          leagueId: true,
          status: true,
          logoUrl: true,
        },
      });

    if (
      !tournament
    ) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_NOT_FOUND',
          message:
            'Tournament could not be found.',
        },
      });
    }

    const admin =
      await this.prisma.leagueAdmin.findUnique({
        where: {
          leagueId_userId: {
            leagueId:
              tournament.leagueId,
            userId,
          },
        },
      });

    if (
      !admin
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'LEAGUE_ADMIN_REQUIRED',
          message:
            'Only a League Admin can manage the Tournament logo.',
        },
      });
    }

    if (
      tournament.status !==
      'DRAFT'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'TOURNAMENT_LOGO_LOCKED',
          message:
            'Tournament logo can only be changed while the Tournament is in Draft.',
        },
      });
    }

    return tournament;
  }


  private cloudinaryConfig() {
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
            'Image storage is not configured. Add the Cloudinary environment variables to the API service.',
        },
      });
    }

    return {
      cloudName,
      apiKey,
      apiSecret,
    };
  }


  private publicId(
    tournamentId: string,
  ) {
    return `fc-arena/tournaments/${tournamentId}/logo`;
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
