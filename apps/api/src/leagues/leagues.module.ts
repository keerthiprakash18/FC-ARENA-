import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LeagueManagementService } from './league-management.service.js';
import { LeagueLogoService } from './league-logo.service.js';
import { LeaguesController } from './leagues.controller.js';
import { LeaguesService } from './leagues.service.js';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [
    LeaguesController,
  ],
  providers: [
    LeaguesService,
    LeagueManagementService,
    LeagueLogoService,
  ],
  exports: [
    LeaguesService,
    LeagueManagementService,
  ],
})
export class LeaguesModule {}