import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';
import {
  LeagueWarsController,
} from './league-wars.controller.js';
import {
  LeagueWarProofService,
} from './league-war-proof.service.js';
import {
  LeagueWarsService,
} from './league-wars.service.js';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [
    LeagueWarsController,
  ],
  providers: [
    LeagueWarsService,
    LeagueWarProofService,
  ],
  exports: [
    LeagueWarsService,
  ],
})
export class LeagueWarsModule {}
