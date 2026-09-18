import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateTournamentDto } from './dto/create-tournament.dto.js';
import { RegisterTournamentDto } from './dto/register-tournament.dto.js';
import { ScheduleFixtureDto } from './dto/schedule-fixture.dto.js';
import { UpdateSchedulingSettingsDto } from './dto/update-scheduling-settings.dto.js';
import { FixturesService } from './fixtures.service.js';
import { TournamentsService } from './tournaments.service.js';

type AuthenticatedRequest = Request & {
  user: AccessTokenPayload;
};

@Controller()
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(
    private readonly tournamentsService:
      TournamentsService,

    private readonly fixturesService:
      FixturesService,
  ) {}

  @Post('leagues/:leagueId/tournaments')
  createTournament(
    @Req()
    request: AuthenticatedRequest,

    @Param('leagueId')
    leagueId: string,

    @Body()
    dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.createTournament(
      request.user.sub,
      leagueId,
      dto,
    );
  }

  @Get('leagues/:leagueId/tournaments')
  getLeagueTournaments(
    @Req()
    request: AuthenticatedRequest,

    @Param('leagueId')
    leagueId: string,
  ) {
    return this.tournamentsService.getLeagueTournaments(
      request.user.sub,
      leagueId,
    );
  }

  @Get('tournaments/:tournamentId')
  getTournament(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.tournamentsService.getTournament(
      request.user.sub,
      tournamentId,
    );
  }

  @Post(
    'tournaments/:tournamentId/open-registration',
  )
  openRegistration(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.tournamentsService.openRegistration(
      request.user.sub,
      tournamentId,
    );
  }

  @Post(
    'tournaments/:tournamentId/close-registration',
  )
  closeRegistration(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.tournamentsService.closeRegistration(
      request.user.sub,
      tournamentId,
    );
  }

  @Post(
    'tournaments/:tournamentId/register',
  )
  register(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,

    @Body()
    dto: RegisterTournamentDto,
  ) {
    return this.tournamentsService.register(
      request.user.sub,
      tournamentId,
      dto,
    );
  }

  @Get(
    'tournaments/:tournamentId/registrations',
  )
  registrations(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.tournamentsService.getRegistrations(
      request.user.sub,
      tournamentId,
    );
  }

  @Post(
    'tournaments/:tournamentId/registrations/:registrationId/approve',
  )
  approve(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,

    @Param('registrationId')
    registrationId: string,
  ) {
    return this.tournamentsService.approveRegistration(
      request.user.sub,
      tournamentId,
      registrationId,
    );
  }

  @Post(
    'tournaments/:tournamentId/registrations/:registrationId/reject',
  )
  reject(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,

    @Param('registrationId')
    registrationId: string,
  ) {
    return this.tournamentsService.rejectRegistration(
      request.user.sub,
      tournamentId,
      registrationId,
    );
  }

  @Post(
    'tournaments/:tournamentId/fixtures/generate',
  )
  generateFixtures(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.fixturesService.generateFixtures(
      request.user.sub,
      tournamentId,
    );
  }

  @Get(
    'tournaments/:tournamentId/fixtures',
  )
  getFixtures(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,
  ) {
    return this.fixturesService.getFixtures(
      request.user.sub,
      tournamentId,
    );
  }

  @Patch(
    'tournaments/:tournamentId/scheduling-settings',
  )
  updateSchedulingSettings(
    @Req()
    request: AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId: string,

    @Body()
    dto: UpdateSchedulingSettingsDto,
  ) {
    return this.fixturesService.updateSchedulingSettings(
      request.user.sub,
      tournamentId,
      dto,
    );
  }

  @Post(
    'fixtures/:fixtureId/schedule',
  )
  scheduleFixture(
    @Req()
    request: AuthenticatedRequest,

    @Param('fixtureId')
    fixtureId: string,

    @Body()
    dto: ScheduleFixtureDto,
  ) {
    return this.fixturesService.scheduleFixture(
      request.user.sub,
      fixtureId,
      dto,
    );
  }

  @Post(
    'fixtures/:fixtureId/postpone',
  )
  postponeFixture(
    @Req()
    request: AuthenticatedRequest,

    @Param('fixtureId')
    fixtureId: string,
  ) {
    return this.fixturesService.postponeFixture(
      request.user.sub,
      fixtureId,
    );
  }

  @Post(
    'fixtures/:fixtureId/cancel',
  )
  cancelFixture(
    @Req()
    request: AuthenticatedRequest,

    @Param('fixtureId')
    fixtureId: string,
  ) {
    return this.fixturesService.cancelFixture(
      request.user.sub,
      fixtureId,
    );
  }
}