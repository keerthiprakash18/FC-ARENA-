import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { FixturesService } from './fixtures.service.js';

import { GroupFixturesService } from './group-fixtures.service.js';
import { PlayoffsService } from './playoffs.service.js';

import { TournamentGroupsService } from './tournament-groups.service.js';

import { TournamentsController } from './tournaments.controller.js';

import { TournamentsService } from './tournaments.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    TournamentsController,
  ],

  providers: [
    TournamentsService,
    FixturesService,
    TournamentGroupsService,
    GroupFixturesService,
    PlayoffsService,
  ],

  exports: [
    TournamentsService,
    FixturesService,
    TournamentGroupsService,
    GroupFixturesService,
    PlayoffsService,
  ],
})
export class TournamentsModule {}