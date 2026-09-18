import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LeagueManagementService } from './league-management.service.js';
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
  ],
  exports: [
    LeaguesService,
    LeagueManagementService,
  ],
})
export class LeaguesModule {}