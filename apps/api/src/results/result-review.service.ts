import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { assertImageFormat } from '../security/image-format.js';
import sharp from 'sharp';
import type { ResultQueueDto } from './dto/result-queue.dto.js';

@Injectable()
export class ResultReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async queue(userId: string, query: ResultQueueDto) {
    const scope = await this.authorization.resultVerificationScope(userId);
    const tournaments = await this.prisma.tournament.findMany({
      where: scope,
      select: {
        id: true,
        name: true,
        leagueId: true,
        league: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    if (!tournaments.length)
      throw new ForbiddenException(
        'Result verification permission is required.',
      );
    const where: Prisma.ResultSubmissionWhereInput = {
      status: query.status,
      match: {
        tournament: {
          AND: [
            scope,
            {
              ...(query.tournamentId ? { id: query.tournamentId } : {}),
              ...(query.leagueId ? { leagueId: query.leagueId } : {}),
            },
          ],
        },
        ...(query.status === 'PENDING_VERIFICATION'
          ? { confirmedResultSubmissionId: null }
          : {}),
      },
    };
    const pageSize = 20;
    const [total, submissions] = await this.prisma.$transaction([
      this.prisma.resultSubmission.count({ where }),
      this.prisma.resultSubmission.findMany({
        where,
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          homePenaltyScore: true,
          awayPenaltyScore: true,
          status: true,
          source: true,
          createdAt: true,
          reviewedAt: true,
          rejectionReason: true,
          submittedBy: { select: { fullName: true } },
          reviewedBy: { select: { fullName: true } },
          ocrExtraction: {
            select: { id: true, status: true, scoreConfidence: true },
          },
          match: {
            select: {
              id: true,
              matchCode: true,
              tournamentId: true,
              fixture: {
                select: {
                  fixtureCode: true,
                  roundName: true,
                  homeRegistration: {
                    select: {
                      entryName: true,
                      members: {
                        select: { user: { select: { fullName: true } } },
                      },
                    },
                  },
                  awayRegistration: {
                    select: {
                      entryName: true,
                      members: {
                        select: { user: { select: { fullName: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      success: true,
      data: { submissions, tournaments, total, page: query.page, pageSize },
      error: null,
    };
  }

  async evidence(userId: string, submissionId: string) {
    const submission = await this.prisma.resultSubmission.findUnique({
      where: { id: submissionId },
      select: {
        matchId: true,
        ocrExtraction: { select: { imagePath: true, mimeType: true } },
      },
    });
    if (!submission) throw new NotFoundException('Result could not be found.');
    await this.authorization.assertCanVerifyResult(userId, submission.matchId);
    const evidence = submission.ocrExtraction;
    if (!evidence)
      throw new NotFoundException(
        'This result was entered manually and has no screenshot.',
      );
    let bytes: Buffer;
    try {
      const root = await realpath(
        resolve(
          process.cwd(),
          process.env.OCR_UPLOAD_DIR ?? 'storage/match-results',
        ),
      );
      const path = await realpath(evidence.imagePath);
      const child = relative(root, path);
      if (!child || child.startsWith('..') || isAbsolute(child))
        throw new Error('Invalid evidence path');
      const info = await stat(path);
      if (!info.isFile() || info.size > 10 * 1024 * 1024)
        throw new Error('Invalid evidence file');
      bytes = await readFile(path);
      assertImageFormat(
        evidence.mimeType,
        (await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata())
          .format,
      );
    } catch {
      throw new NotFoundException(
        'Screenshot is no longer available. Open the match to request new evidence.',
      );
    }
    return {
      success: true,
      data: { mimeType: evidence.mimeType, base64: bytes.toString('base64') },
      error: null,
    };
  }
}
