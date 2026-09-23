import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  writeFile,
} from 'node:fs/promises';
import {
  extname,
  resolve,
} from 'node:path';
import {
  randomUUID,
} from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { SubmitResultDto } from '../results/dto/submit-result.dto.js';
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

@Injectable()
export class OcrService {
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
  ) {}

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

    await this.ocrQueue.add(
      OCR_JOB_PROCESS_MATCH_RESULT,
      {
        ocrExtractionId:
          extraction.id,
      },
      {
        jobId:
          `ocr-${extraction.id}`,

        attempts: 2,

        backoff: {
          type: 'exponential',
          delay: 2000,
        },

        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

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

    const submission =
      await this.prisma.resultSubmission.create({
        data: {
          matchId:
            extraction.matchId,

          submittedByUserId:
            userId,

          source:
            'OCR',

          ocrExtractionId:
            extraction.id,

          homeScore:
            dto.homeScore,

          awayScore:
            dto.awayScore,

          status:
            'PENDING_VERIFICATION',
        },
      });

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

      const lines =
        raw.text
          .split(/\r?\n/)
          .map(
            (line) =>
              line.trim(),
          )
          .filter(Boolean);

      const homeMatch =
        this.findBestParticipantMatch(
          lines,
          homeCandidates,
          raw.confidence,
        );

      const awayMatch =
        this.findBestParticipantMatch(
          lines,
          awayCandidates,
          raw.confidence,
        );

      const score =
        this.detectScore(
          lines,
          raw.confidence,
        );

      return await this.prisma.ocrExtraction.update({
        where: {
          id:
            extraction.id,
        },

        data: {
          status:
            'COMPLETED',

          rawText:
            raw.text,

          ocrConfidence:
            raw.confidence,

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
        error instanceof Error
          ? error.message
          : 'Unknown OCR processing error.';

      await this.prisma.ocrExtraction.update({
        where: {
          id:
            extraction.id,
        },

        data: {
          status:
            'FAILED',

          failureReason:
            message,

          processedAt:
            new Date(),
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

  private findBestParticipantMatch(
    lines: string[],
    candidates:
      OcrParticipantCandidate[],
    ocrConfidence: number,
  ) {
    let best = {
      userId:
        null as string | null,

      detectedText:
        null as string | null,

      confidence: 0,
    };

    for (
      const candidate
      of candidates
    ) {
      const target =
        candidate.inGameName ||
        candidate.fullName;

      for (
        const line
        of lines
      ) {
        const similarity =
          this.similarity(
            target,
            line,
          );

        const confidence =
          Math.max(
            0,
            Math.min(
              1,
              similarity *
                Math.max(
                  0.5,
                  ocrConfidence,
                ),
            ),
          );

        if (
          confidence >
          best.confidence
        ) {
          best = {
            userId:
              candidate.userId,

            detectedText:
              line,

            confidence:
              Number(
                confidence.toFixed(
                  4,
                ),
              ),
          };
        }
      }
    }

    if (
      best.confidence <
      0.5
    ) {
      return {
        userId: null,
        detectedText:
          best.detectedText,
        confidence:
          best.confidence,
      };
    }

    return best;
  }

  private detectScore(
    lines: string[],
    ocrConfidence: number,
  ) {
    for (
      const line of lines
    ) {
      const match =
        line.match(
          /\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/,
        );

      if (!match) {
        continue;
      }

      const homeScore =
        Number(match[1]);

      const awayScore =
        Number(match[2]);

      if (
        homeScore > 30 ||
        awayScore > 30
      ) {
        continue;
      }

      const compactLine =
        line.length <= 24;

      const confidence =
        Math.max(
          0,
          Math.min(
            1,
            ocrConfidence *
              (compactLine
                ? 1
                : 0.75),
          ),
        );

      return {
        homeScore,
        awayScore,

        confidence:
          Number(
            confidence.toFixed(
              4,
            ),
          ),
      };
    }

    return {
      homeScore:
        null as number | null,

      awayScore:
        null as number | null,

      confidence: 0,
    };
  }

  private similarity(
    left: string,
    right: string,
  ) {
    const a =
      this.normalizeName(left);

    const b =
      this.normalizeName(right);

    if (!a || !b) {
      return 0;
    }

    if (
      a.includes(b) ||
      b.includes(a)
    ) {
      const ratio =
        Math.min(
          a.length,
          b.length,
        ) /
        Math.max(
          a.length,
          b.length,
        );

      return Math.max(
        ratio,
        0.9,
      );
    }

    const distance =
      this.levenshtein(
        a,
        b,
      );

    return Math.max(
      0,
      1 -
        distance /
          Math.max(
            a.length,
            b.length,
          ),
    );
  }

  private normalizeName(
    value: string,
  ) {
    return value
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        '',
      );
  }

  private levenshtein(
    a: string,
    b: string,
  ) {
    const matrix:
      number[][] =
      Array.from(
        {
          length:
            a.length + 1,
        },
        () =>
          Array(
            b.length + 1,
          ).fill(0),
      );

    for (
      let i = 0;
      i <= a.length;
      i++
    ) {
      matrix[i][0] = i;
    }

    for (
      let j = 0;
      j <= b.length;
      j++
    ) {
      matrix[0][j] = j;
    }

    for (
      let i = 1;
      i <= a.length;
      i++
    ) {
      for (
        let j = 1;
        j <= b.length;
        j++
      ) {
        const cost =
          a[i - 1] ===
          b[j - 1]
            ? 0
            : 1;

        matrix[i][j] =
          Math.min(
            matrix[i - 1][j] +
              1,

            matrix[i][j - 1] +
              1,

            matrix[i - 1][j - 1] +
              cost,
          );
      }
    }

    return matrix[
      a.length
    ][b.length];
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