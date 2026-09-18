import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CorrectResultDto } from './dto/correct-result.dto.js';
import { RejectResultDto } from './dto/reject-result.dto.js';
import { ReverseResultDto } from './dto/reverse-result.dto.js';
import { SubmitResultDto } from './dto/submit-result.dto.js';
import { ResultCorrectionService } from './result-correction.service.js';
import { ResultsService } from './results.service.js';

type AuthenticatedRequest =
  Request & {
    user: AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class ResultsController {
  constructor(
    private readonly resultsService:
      ResultsService,

    private readonly resultCorrectionService:
      ResultCorrectionService,
  ) {}

  @Post(
    'matches/:matchId/results',
  )
  submit(
    @Req()
    request: AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @Body()
    dto: SubmitResultDto,
  ) {
    return this.resultsService.submitResult(
      request.user.sub,
      matchId,
      dto,
    );
  }

  @Get(
    'matches/:matchId/results',
  )
  getMatchResults(
    @Req()
    request: AuthenticatedRequest,

    @Param('matchId')
    matchId: string,
  ) {
    return this.resultsService.getMatchResults(
      request.user.sub,
      matchId,
    );
  }

  @Post(
    'results/:resultSubmissionId/confirm',
  )
  confirm(
    @Req()
    request: AuthenticatedRequest,

    @Param('resultSubmissionId')
    resultSubmissionId: string,
  ) {
    return this.resultsService.confirmResult(
      request.user.sub,
      resultSubmissionId,
    );
  }

  @Post(
    'results/:resultSubmissionId/reject',
  )
  reject(
    @Req()
    request: AuthenticatedRequest,

    @Param('resultSubmissionId')
    resultSubmissionId: string,

    @Body()
    dto: RejectResultDto,
  ) {
    return this.resultsService.rejectResult(
      request.user.sub,
      resultSubmissionId,
      dto,
    );
  }

  @Post(
    'matches/:matchId/results/correct',
  )
  correct(
    @Req()
    request: AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @Body()
    dto: CorrectResultDto,
  ) {
    return this.resultCorrectionService.correctResult(
      request.user.sub,
      matchId,
      dto,
    );
  }

  @Post(
    'matches/:matchId/results/reverse',
  )
  reverse(
    @Req()
    request: AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @Body()
    dto: ReverseResultDto,
  ) {
    return this.resultCorrectionService.reverseResult(
      request.user.sub,
      matchId,
      dto,
    );
  }

  @Get(
    'tournaments/:tournamentId/standings',
  )
  standings(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.resultsService.getStandings(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'tournaments/:tournamentId/my-statistics',
  )
  myStatistics(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.resultsService.getMyStatistics(
      request.user.sub,
      tournamentId,
    );
  }
}