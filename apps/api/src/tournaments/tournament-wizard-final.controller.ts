import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  CreatePreviewFixtureDto,
} from './dto/create-preview-fixture.dto.js';

import {
  UpdatePreviewFixtureDto,
} from './dto/update-preview-fixture.dto.js';

import {
  UpdateQualificationSettingsDto,
} from './dto/update-qualification-settings.dto.js';

import {
  TournamentFixturePreviewService,
} from './tournament-fixture-preview.service.js';

import {
  TournamentWizardFinalizeService,
} from './tournament-wizard-finalize.service.js';


type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };


@Controller()
@UseGuards(
  JwtAuthGuard,
)
export class TournamentWizardFinalController {
  constructor(
    private readonly preview:
      TournamentFixturePreviewService,

    private readonly finalize:
      TournamentWizardFinalizeService,
  ) {}


  @Post(
    'tournaments/:tournamentId/wizard/fixture-preview',
  )
  createFixture(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Body()
    dto:
      CreatePreviewFixtureDto,
  ) {
    return this.preview.createFixture(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Patch(
    'tournaments/:tournamentId/wizard/fixture-preview/:fixtureId',
  )
  updateFixture(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Param('fixtureId')
    fixtureId:
      string,

    @Body()
    dto:
      UpdatePreviewFixtureDto,
  ) {
    return this.preview.updateFixture(
      request.user.sub,
      tournamentId,
      fixtureId,
      dto,
    );
  }


  @Post(
    'tournaments/:tournamentId/wizard/fixture-preview/:fixtureId/swap',
  )
  swapFixture(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Param('fixtureId')
    fixtureId:
      string,
  ) {
    return this.preview.swapHomeAway(
      request.user.sub,
      tournamentId,
      fixtureId,
    );
  }


  @Delete(
    'tournaments/:tournamentId/wizard/fixture-preview/:fixtureId',
  )
  deleteFixture(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Param('fixtureId')
    fixtureId:
      string,
  ) {
    return this.preview.deleteFixture(
      request.user.sub,
      tournamentId,
      fixtureId,
    );
  }


  @Post(
    'tournaments/:tournamentId/wizard/fixture-preview/publish',
  )
  publishFixtures(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.preview.publishFixtures(
      request.user.sub,
      tournamentId,
    );
  }


  @Patch(
    'tournaments/:tournamentId/wizard/qualification',
  )
  qualification(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Body()
    dto:
      UpdateQualificationSettingsDto,
  ) {
    return this.finalize.saveQualification(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Get(
    'tournaments/:tournamentId/wizard/review',
  )
  review(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.finalize.getReview(
      request.user.sub,
      tournamentId,
    );
  }


  @Post(
    'tournaments/:tournamentId/wizard/publish',
  )
  publishTournament(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.finalize.publishTournament(
      request.user.sub,
      tournamentId,
    );
  }
}