import { Module } from '@nestjs/common';

import { AchievementsModule } from './achievements/achievements.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { DisputesModule } from './disputes/disputes.module.js';
import { LeaguesModule } from './leagues/leagues.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OcrModule } from './ocr/ocr.module.js';
import { PlayerCareerModule } from './player-career/player-career.module.js';
import { PublicModule } from './public/public.module.js';
import { RankingsModule } from './rankings/rankings.module.js';
import { ResultsModule } from './results/results.module.js';
import { SecurityModule } from './security/security.module.js';
import { TournamentsModule } from './tournaments/tournaments.module.js';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    HealthModule,
    AuthModule,
    LeaguesModule,
    TournamentsModule,
    MatchesModule,
    ResultsModule,
    OcrModule,
    RankingsModule,
    AchievementsModule,
    AiModule,
    NotificationsModule,
    PlayerCareerModule,
    DisputesModule,
    PublicModule,
  ],
})
export class AppModule {}