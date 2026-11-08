import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LeagueLogoService } from './league-logo.service.js';
import { LeagueManagementService } from './league-management.service.js';
import { LeaguesController } from './leagues.controller.js';
import { LeaguesService } from './leagues.service.js';
import { LeagueFixtureFeedController } from './league-fixture-feed.controller.js';
import { LeagueFixtureFeedService } from './league-fixture-feed.service.js';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [
    LeaguesController,
    LeagueFixtureFeedController,
  ],
  providers: [
    LeaguesService,
    LeagueManagementService,
    LeagueLogoService,
    LeagueFixtureFeedService,
  ],
  exports: [
    LeaguesService,
    LeagueManagementService,
  ],
})
export class LeaguesModule {}
