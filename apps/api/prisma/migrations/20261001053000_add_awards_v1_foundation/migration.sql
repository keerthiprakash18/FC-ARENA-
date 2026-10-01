-- FC Arena Awards V1 foundation
ALTER TYPE "AchievementType" ADD VALUE IF NOT EXISTS 'GOLDEN_GLOVE';

DO $$ BEGIN
  CREATE TYPE "BallonSeasonStatus" AS ENUM ('DRAFT', 'LIVE', 'FINALIZING', 'LOCKED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SeasonalAwardType" AS ENUM ('FC_ARENA_BALLON', 'RISING_STAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ballon_seasons" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "minimumMatches" INTEGER NOT NULL DEFAULT 6,
  "rankingLimit" INTEGER NOT NULL DEFAULT 20,
  "status" "BallonSeasonStatus" NOT NULL DEFAULT 'DRAFT',
  "eligibleLeagueIds" JSONB NOT NULL,
  "eligibleTournamentIds" JSONB NOT NULL,
  "scoringConfig" JSONB NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "finalWinnerUserId" UUID,
  "risingStarUserId" UUID,
  "liveAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ballon_seasons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ballon_seasons_status_startAt_endAt_idx"
  ON "ballon_seasons"("status", "startAt", "endAt");
CREATE INDEX IF NOT EXISTS "ballon_seasons_createdByUserId_idx"
  ON "ballon_seasons"("createdByUserId");

CREATE TABLE IF NOT EXISTS "ballon_ranking_snapshots" (
  "id" UUID NOT NULL,
  "seasonId" UUID NOT NULL,
  "day" DATE NOT NULL,
  "rows" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ballon_ranking_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ballon_ranking_snapshots_seasonId_day_key"
  ON "ballon_ranking_snapshots"("seasonId", "day");
CREATE INDEX IF NOT EXISTS "ballon_ranking_snapshots_seasonId_capturedAt_idx"
  ON "ballon_ranking_snapshots"("seasonId", "capturedAt");

CREATE TABLE IF NOT EXISTS "ballon_final_rankings" (
  "id" UUID NOT NULL,
  "seasonId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "rank" INTEGER NOT NULL,
  "rating" DOUBLE PRECISION NOT NULL,
  "breakdown" JSONB NOT NULL,
  "statistics" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ballon_final_rankings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ballon_final_rankings_seasonId_userId_key"
  ON "ballon_final_rankings"("seasonId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ballon_final_rankings_seasonId_rank_key"
  ON "ballon_final_rankings"("seasonId", "rank");
CREATE INDEX IF NOT EXISTS "ballon_final_rankings_userId_createdAt_idx"
  ON "ballon_final_rankings"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "seasonal_awards" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "seasonId" UUID NOT NULL,
  "type" "SeasonalAwardType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seasonal_awards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "seasonal_awards_userId_seasonId_type_key"
  ON "seasonal_awards"("userId", "seasonId", "type");
CREATE INDEX IF NOT EXISTS "seasonal_awards_userId_awardedAt_idx"
  ON "seasonal_awards"("userId", "awardedAt");
CREATE INDEX IF NOT EXISTS "seasonal_awards_seasonId_type_idx"
  ON "seasonal_awards"("seasonId", "type");


-- Relational integrity for FC Arena Ballon data.
ALTER TABLE "ballon_seasons"
  ADD CONSTRAINT "ballon_seasons_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ballon_seasons"
  ADD CONSTRAINT "ballon_seasons_finalWinnerUserId_fkey"
  FOREIGN KEY ("finalWinnerUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ballon_seasons"
  ADD CONSTRAINT "ballon_seasons_risingStarUserId_fkey"
  FOREIGN KEY ("risingStarUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ballon_ranking_snapshots"
  ADD CONSTRAINT "ballon_ranking_snapshots_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "ballon_seasons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ballon_final_rankings"
  ADD CONSTRAINT "ballon_final_rankings_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "ballon_seasons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ballon_final_rankings"
  ADD CONSTRAINT "ballon_final_rankings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seasonal_awards"
  ADD CONSTRAINT "seasonal_awards_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seasonal_awards"
  ADD CONSTRAINT "seasonal_awards_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "ballon_seasons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
