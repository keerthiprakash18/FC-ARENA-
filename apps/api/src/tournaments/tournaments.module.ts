import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FixturesService } from './fixtures.service.js';
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
  ],
  exports: [
    TournamentsService,
    FixturesService,
  ],
})
export class TournamentsModule {}