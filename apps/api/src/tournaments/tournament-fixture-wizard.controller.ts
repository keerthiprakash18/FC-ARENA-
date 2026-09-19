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
  UpdateFixtureWizardSettingsDto,
} from './dto/update-fixture-wizard-settings.dto.js';

import {
  TournamentFixtureWizardService,
} from './tournament-fixture-wizard.service.js';


type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };


@Controller()
@UseGuards(
  JwtAuthGuard,
)
export class TournamentFixtureWizardController {
  constructor(
    private readonly service:
      TournamentFixtureWizardService,
  ) {}


  @Get(
    'tournaments/:tournamentId/wizard/fixture-settings',
  )
  settings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.service.getSettings(
      request.user.sub,
      tournamentId,
    );
  }


  @Patch(
    'tournaments/:tournamentId/wizard/fixture-settings',
  )
  updateSettings(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Body()
    dto:
      UpdateFixtureWizardSettingsDto,
  ) {
    return this.service.updateSettings(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Post(
    'tournaments/:tournamentId/wizard/fixture-preview/generate',
  )
  generate(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.service.generatePreview(
      request.user.sub,
      tournamentId,
    );
  }


  @Get(
    'tournaments/:tournamentId/wizard/fixture-preview',
  )
  preview(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.service.getPreview(
      request.user.sub,
      tournamentId,
    );
  }


  @Delete(
    'tournaments/:tournamentId/wizard/fixture-preview',
  )
  reset(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,
  ) {
    return this.service.resetPreview(
      request.user.sub,
      tournamentId,
    );
  }
}