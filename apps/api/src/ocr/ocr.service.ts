import { assertImageFormat } from '../security/image-format.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InjectQueue,
} from '@nestjs/bullmq';
import type {
  Queue,
} from 'bullmq';
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  randomUUID,
} from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { SubmitResultDto } from '../results/dto/submit-result.dto.js';
import { ResultsService } from '../results/results.service.js';
import {
  OCR_JOB_PROCESS_MATCH_RESULT,
  OCR_QUEUE,
} from './ocr.constants.js';
import type {
  OcrJobData,
  OcrParticipantCandidate,
  OcrProvider,
} from './ocr.types.js';
import { TesseractOcrProvider } from './providers/tesseract-ocr.provider.js';
import { parseOcrResult, normalizedConfidence } from './ocr-parser.js';

@Injectable()
export class OcrService
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authorization:
      AuthorizationService,

    @InjectQueue(OCR_QUEUE)
    private readonly ocrQueue:
      Queue<OcrJobData>,

    private readonly ocrProvider:
      TesseractOcrProvider,
    private readonly results: ResultsService,
  ) {}

  onModuleInit(): void {
    if (process.env.OCR_RETENTION_CLEANUP_ENABLED === 'false') {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredArtifacts().catch(() => {
        this.logger.warn('OCR artifact cleanup failed.');
      });
    }, 6 * 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async cleanupExpiredArtifacts(
    retentionMs = this.retentionMs(),
  ): Promise<number> {
    const cutoff = new Date(Date.now() - Math.max(retentionMs, 60_000));
    const extractions = await this.prisma.ocrExtraction.findMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
        status: {
          in: ['COMPLETED', 'FAILED'],
        },
        resultSubmission: {
          is: null,
        },
      },
      select: {
        id: true,
        imagePath: true,
      },
      take: 500,
    });

    const root = resolve(
      process.cwd(),
      process.env.OCR_UPLOAD_DIR ?? 'storage/match-results',
    );
    let removed = 0;

    for (const extraction of extractions) {
      const imagePath = resolve(extraction.imagePath);
      const pathFromRoot = relative(root, imagePath);

      if (
        pathFromRoot === '' ||
        pathFromRoot.startsWith(`..${sep}`) ||
        pathFromRoot === '..' ||
        pathFromRoot.startsWith(sep)
      ) {
        this.logger.warn(`Skipped OCR artifact outside configured storage: ${extraction.id}`);
        continue;
      }

      try {
        await unlink(imagePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          continue;
        }
      }

      const result = await this.prisma.ocrExtraction.deleteMany({
        where: {
          id: extraction.id,
          resultSubmission: {
            is: null,
          },
        },
      });
      removed += result.count;
    }

    return removed;
  }

  async uploadScreenshot(
    userId: string,
    matchId: string,
    file: Express.Multer.File,
  ) {
    const match =
      await this.getAuthorizedMatch(
        userId,
        matchId,
      );

    if (
      match.confirmedResultSubmissionId
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESULT_ALREADY_RECORDED',

          message:
            'This match already has a confirmed result.',
        },
      });
    }

    if (
      !file ||
      !file.buffer ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'SCREENSHOT_REQUIRED',

          message:
            'A result screenshot is required.',
        },
      });
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'SCREENSHOT_TOO_LARGE',

          message:
            'Screenshot must be 10 MB or smaller.',
        },
      });
    }

    const allowedMimeTypes =
      new Set([
        'image/jpeg',
        'image/png',
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
            'INVALID_SCREENSHOT_TYPE',

          message:
            'Only JPG, PNG and WEBP screenshots are allowed.',
        },
      });
    }

    let metadata:
      Metadata;

    try {
      metadata =
        await sharp(
          file.buffer,
        ).metadata();
      assertImageFormat(file.mimetype, metadata.format);
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'INVALID_IMAGE',

          message:
            'The uploaded file is not a readable image.',
        },
      });
    }

    const width =
      metadata.width ?? 0;

    const height =
      metadata.height ?? 0;

    if (
      width < 320 ||
      height < 240
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'IMAGE_RESOLUTION_TOO_LOW',

          message:
            'Screenshot resolution is too low for reliable OCR.',
        },
      });
    }

    if (
      width > 8000 ||
      height > 8000
    ) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code:
            'IMAGE_RESOLUTION_TOO_HIGH',

          message:
            'Screenshot resolution is too large.',
        },
      });
    }

    const extension =
      this.extensionForMimeType(
        file.mimetype,
      );

    const root =
      resolve(
        process.cwd(),
        process.env
          .OCR_UPLOAD_DIR ??
          'storage/match-results',
      );

    const matchDirectory =
      resolve(
        root,
        matchId,
      );

    await mkdir(
      matchDirectory,
      {
        recursive: true,
      },
    );

    const filename =
      `${randomUUID()}${extension}`;

    const imagePath =
      resolve(
        matchDirectory,
        filename,
      );

    await writeFile(
      imagePath,
      file.buffer,
    );

    const extraction =
      await this.prisma.ocrExtraction.create({
        data: {
          matchId,
          submittedByUserId:
            userId,
          imagePath,
          mimeType:
            file.mimetype,
          fileSize:
            file.size,
          width,
          height,
          status:
            'QUEUED',
        },
      });

    try {
      await this.ocrQueue.add(
        OCR_JOB_PROCESS_MATCH_RESULT,
        { ocrExtractionId: extraction.id },
        {
          jobId: `ocr-${extraction.id}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      );
    } catch {
      const message = 'Screenshot processing is temporarily unavailable. Please retry or enter the result manually.';
      await this.prisma.ocrExtraction.update({
        where: { id: extraction.id },
        data: { status: 'FAILED', failureReason: message, processedAt: new Date() },
      });
      throw new ServiceUnavailableException(message);
    }

    return {
      success: true,

      data: {
        message:
          'Screenshot uploaded. Processing Match Result...',

        extraction: {
          id:
            extraction.id,

          status:
            extraction.status,

          createdAt:
            extraction.createdAt,
        },
      },

      error: null,
    };
  }

  async getLatestExtraction(
    userId: string,
    matchId: string,
  ) {
    await this.getAuthorizedMatch(
      userId,
      matchId,
    );

    const extraction =
      await this.prisma.ocrExtraction.findFirst({
        where: {
          matchId,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          homeMatchedUser: {
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

          awayMatchedUser: {
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

          resultSubmission: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

    return {
      success: true,

      data: {
        extraction,
      },

      error: null,
    };
  }

  async submitOcrResult(
    userId: string,
    ocrExtractionId: string,
    dto: SubmitResultDto,
  ) {
    const extraction =
      await this.prisma.ocrExtraction.findUnique({
        where: {
          id:
            ocrExtractionId,
        },

        include: {
          match: {
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

              confirmedResult: true,
            },
          },

          resultSubmission: true,
        },
      });

    if (!extraction) {
      throw this.ocrNotFound();
    }

    await this.assertCanAccessMatch(
      userId,
      extraction.match,
    );

    if (
      extraction.status !==
      'COMPLETED'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'OCR_NOT_READY',

          message:
            'OCR processing has not completed yet.',
        },
      });
    }

    if (
      extraction.resultSubmission
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'OCR_RESULT_ALREADY_SUBMITTED',

          message:
            'This OCR extraction has already been submitted for verification.',
        },
      });
    }

    if (
      extraction.match
        .confirmedResultSubmissionId
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'RESULT_ALREADY_RECORDED',

          message:
            'This match already has a confirmed result.',
        },
      });
    }

    if (
      extraction.match.status !==
        'UNSCHEDULED' &&
      extraction.match.status !==
        'SCHEDULED' &&
      extraction.match.status !==
        'LIVE'
    ) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code:
            'MATCH_NOT_OPEN_FOR_RESULT',

          message:
            'Only unscheduled, scheduled or live matches can accept a result.',
        },
      });
    }

    const submitted = await this.results.submitResult(userId, extraction.matchId, dto, {
      ocrExtractionId: extraction.id,
    });
    const submission = submitted.data.submission;

    return {
      success: true,

      data: {
        message:
          'OCR result submitted for Admin verification.',

        submission: {
          id:
            submission.id,

          status:
            submission.status,

          source:
            submission.source,

          homeScore:
            submission.homeScore,

          awayScore:
            submission.awayScore,
        },
      },

      error: null,
    };
  }

  async processExtraction(
    ocrExtractionId: string,
    finalAttempt = true,
  ) {
    const extraction =
      await this.prisma.ocrExtraction.findUnique({
        where: {
          id:
            ocrExtractionId,
        },

        include: {
          match: {
            include: {
              fixture: {
                include: {
                  homeRegistration: {
                    include: {
                      members: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              fullName: true,

                              player: {
                                select: {
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
                      },
                    },
                  },

                  awayRegistration: {
                    include: {
                      members: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              fullName: true,

                              player: {
                                select: {
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
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!extraction) {
      throw this.ocrNotFound();
    }

    await this.prisma.ocrExtraction.update({
      where: {
        id:
          extraction.id,
      },

      data: {
        status:
          'PROCESSING',

        failureReason:
          null,
      },
    });

    try {
      await readFile(
        extraction.imagePath,
      );

      const raw =
        await (
          this.ocrProvider as OcrProvider
        ).extract(
          extraction.imagePath,
        );

      const homeCandidates =
        this.mapCandidates(
          extraction.match.fixture
            .homeRegistration
            ?.members ??
            [],
        );

      const awayCandidates =
        this.mapCandidates(
          extraction.match.fixture
            .awayRegistration
            ?.members ??
            [],
        );

      const parsed = parseOcrResult(raw, homeCandidates, awayCandidates);
      const homeMatch = parsed.home;
      const awayMatch = parsed.away;
      const score = parsed.score;

      return await this.prisma.ocrExtraction.update({
        where: {
          id:
            extraction.id,
        },

        data: {
          status:
            'COMPLETED',

          rawText:
            parsed.raw.text,

          ocrConfidence:
            normalizedConfidence(parsed.raw.confidence),

          detectedHomeName:
            homeMatch.detectedText,

          detectedAwayName:
            awayMatch.detectedText,

          detectedHomeScore:
            score.homeScore,

          detectedAwayScore:
            score.awayScore,

          homeNameConfidence:
            homeMatch.confidence,

          awayNameConfidence:
            awayMatch.confidence,

          scoreConfidence:
            score.confidence,

          homeMatchedUserId:
            homeMatch.userId,

          awayMatchedUserId:
            awayMatch.userId,

          processedAt:
            new Date(),

          failureReason:
            null,
        },
      });
    } catch (error) {
      const message =
        'OCR processing failed. Please retry with a clear image.';

      await this.prisma.ocrExtraction.update({
        where: {
          id:
            extraction.id,
        },

        data: {
          status:
            finalAttempt ? 'FAILED' : 'QUEUED',

          failureReason:
            finalAttempt ? message : null,

          processedAt:
            finalAttempt ? new Date() : null,
        },
      });

      throw error;
    }
  }

  private async getAuthorizedMatch(
    userId: string,
    matchId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id:
            matchId,
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

    await this.assertCanAccessMatch(
      userId,
      match,
    );

    return match;
  }

  private async assertCanAccessMatch(
    userId: string,
    match: any,
  ) {
    const canVerifyResult =
      await this.authorization.canVerifyResult(
        userId,
        match.id,
      );

    if (
      canVerifyResult
    ) {
      return;
    }

    const participants = [
      ...(match.fixture
        .homeRegistration
        ?.members ??
        []),

      ...(match.fixture
        .awayRegistration
        ?.members ??
        []),
    ];

    const isParticipant =
      participants.some(
        (member: {
          userId: string;
        }) =>
          member.userId ===
          userId,
      );

    if (!isParticipant) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code:
            'OCR_UPLOAD_FORBIDDEN',

          message:
            'Only Match participants or an authorized Tournament Match Admin may use OCR for this Match.',
        },
      });
    }
  }

  private mapCandidates(
    members: Array<any>,
  ): OcrParticipantCandidate[] {
    return members.map(
      (member) => ({
        userId:
          member.user.id,

        fullName:
          member.user.fullName,

        inGameName:
          member.user.player
            ?.identity
            ?.inGameName ??
          null,
      }),
    );
  }

  private extensionForMimeType(
    mimeType: string,
  ) {
    if (
      mimeType ===
      'image/png'
    ) {
      return '.png';
    }

    if (
      mimeType ===
      'image/webp'
    ) {
      return '.webp';
    }

    return '.jpg';
  }

  private retentionMs(): number {
    const configuredDays = Number.parseInt(
      process.env.OCR_RETENTION_DAYS ?? '30',
      10,
    );
    const days = Number.isFinite(configuredDays)
      ? Math.min(3650, Math.max(1, configuredDays))
      : 30;

    return days * 24 * 60 * 60 * 1000;
  }

  private ocrNotFound() {
    return new NotFoundException({
      success: false,
      data: null,
      error: {
        code:
          'OCR_EXTRACTION_NOT_FOUND',

        message:
          'OCR extraction could not be found.',
      },
    });
  }
}
