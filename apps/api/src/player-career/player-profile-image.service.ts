import {
  BadRequestException,
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


interface CloudinaryDestroyResponse {
  result?: string;
  error?: {
    message?: string;
  };
}


@Injectable()
export class PlayerProfileImageService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}


  async uploadAvatar(
    userId: string,
    file:
      Express.Multer.File,
  ) {
    const player =
      await this.prisma.player.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          profileImageUrl: true,
        },
      });

    if (!player) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'PLAYER_NOT_FOUND',
          message:
            'Player profile could not be found.',
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
            'PROFILE_IMAGE_REQUIRED',
          message:
            'Select a profile photo to upload.',
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
            'PROFILE_IMAGE_TOO_LARGE',
          message:
            'Profile photo must be 5 MB or smaller.',
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
            'INVALID_PROFILE_IMAGE_TYPE',
          message:
            'Only PNG, JPG, JPEG and WEBP images are allowed.',
        },
      });
    }

    let optimized:
      Buffer;

    try {
      optimized =
        await sharp(
          file.buffer,
        )
          .rotate()
          .resize(
            512,
            512,
            {
              fit: 'cover',
              position:
                'attention',
            },
          )
          .webp({
            quality: 88,
          })
          .toBuffer();
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_PROFILE_IMAGE',
          message:
            'The selected profile photo is not a readable image.',
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
        player.id,
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
            optimized,
          ),
        ],
        {
          type:
            'image/webp',
        },
      ),
      'profile.webp',
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
            'PROFILE_IMAGE_UPLOAD_FAILED',
          message:
            payload.error
              ?.message ??
            'Profile photo could not be uploaded.',
        },
      });
    }

    const updated =
      await this.prisma.player.update({
        where: {
          id:
            player.id,
        },
        data: {
          profileImageUrl:
            payload.secure_url,
        },
        select: {
          profileImageUrl:
            true,
        },
      });

    return {
      success: true,
      data: {
        message:
          'Profile photo updated.',
        profileImageUrl:
          updated.profileImageUrl,
      },
      error: null,
    };
  }


  async removeAvatar(
    userId: string,
  ) {
    const player =
      await this.prisma.player.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          profileImageUrl: true,
        },
      });

    if (!player) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code:
            'PLAYER_NOT_FOUND',
          message:
            'Player profile could not be found.',
        },
      });
    }

    if (
      player.profileImageUrl
    ) {
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
          player.id,
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
              'PROFILE_IMAGE_REMOVE_FAILED',
            message:
              payload.error
                .message ??
              'Profile photo could not be removed.',
          },
        });
      }
    }

    await this.prisma.player.update({
      where: {
        id:
          player.id,
      },
      data: {
        profileImageUrl:
          null,
      },
    });

    return {
      success: true,
      data: {
        message:
          'Profile photo removed.',
        profileImageUrl:
          null,
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
          throw new Error(
            'Invalid Cloudinary protocol.',
          );
        }

        const apiKey =
          decodeURIComponent(
            parsed.username,
          );

        const apiSecret =
          decodeURIComponent(
            parsed.password,
          );

        const cloudName =
          parsed.hostname;

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
        // Fall through to
        // individual environment
        // variables.
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
            'Player image storage is not configured. Add CLOUDINARY_URL to the Railway API service.',
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
    playerId: string,
  ) {
    return `fc-arena/players/${playerId}/profile`;
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
