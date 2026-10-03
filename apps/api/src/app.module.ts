import { APP_FILTER } from '@nestjs/core';
import { SafeExceptionFilter } from './security/safe-exception.filter.js';
import { Module } from '@nestjs/common';

import { AchievementsModule } from './achievements/achievements.module.js';
import { AdminOpsModule } from './admin-ops/admin-ops.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BallonModule } from './ballon/ballon.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { DisputesModule } from './disputes/disputes.module.js';
import { DiscoverModule } from './discover/discover.module.js';
import { FairPlayModule } from './fair-play/fair-play.module.js';
import { LeaguesModule } from './leagues/leagues.module.js';
import { LeagueWarsModule } from './league-wars/league-wars.module.js';
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
  providers: [{ provide: APP_FILTER, useClass: SafeExceptionFilter }],
  imports: [
    PrismaModule,
    SecurityModule,
    AdminOpsModule,
    HealthModule,
    AuthModule,
    BallonModule,
    LeaguesModule,
    LeagueWarsModule,
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
    DiscoverModule,
    FairPlayModule,
    PublicModule,
  ],
})
export class AppModule {}