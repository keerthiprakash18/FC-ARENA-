-- Extend tournament achievement types.
ALTER TYPE "AchievementType" ADD VALUE 'GOLDEN_GLOVE';

-- FC Arena Ballon seasonal award lifecycle.
CREATE TYPE "BallonSeasonStatus" AS ENUM ('DRAFT', 'LIVE', 'LOCKED', 'ARCHIVED');

CREATE TABLE "ballon_seasons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "minMatches" INTEGER NOT NULL DEFAULT 6,
    "rankingSize" INTEGER NOT NULL DEFAULT 20,
    "soloOnly" BOOLEAN NOT NULL DEFAULT true,
    "status" "BallonSeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "leagueId" UUID,
    "createdByUserId" UUID NOT NULL,
    "winnerUserId" UUID,
    "winnerRating" DOUBLE PRECISION,
    "risingStarWinnerUserId" UUID,
    "startedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ballon_seasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ballon_season_tournaments" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ballon_season_tournaments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ballon_ranking_snapshots" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positions" JSONB NOT NULL,

    CONSTRAINT "ballon_ranking_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ballon_seasons_status_startAt_endAt_idx"
ON "ballon_seasons"("status", "startAt", "endAt");

CREATE INDEX "ballon_seasons_leagueId_status_idx"
ON "ballon_seasons"("leagueId", "status");

CREATE UNIQUE INDEX "ballon_season_tournaments_seasonId_tournamentId_key"
ON "ballon_season_tournaments"("seasonId", "tournamentId");

CREATE INDEX "ballon_season_tournaments_tournamentId_idx"
ON "ballon_season_tournaments"("tournamentId");

CREATE UNIQUE INDEX "ballon_ranking_snapshots_seasonId_day_key"
ON "ballon_ranking_snapshots"("seasonId", "day");

CREATE INDEX "ballon_ranking_snapshots_seasonId_capturedAt_idx"
ON "ballon_ranking_snapshots"("seasonId", "capturedAt");

ALTER TABLE "ballon_seasons"
ADD CONSTRAINT "ballon_seasons_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "leagues"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ballon_seasons"
ADD CONSTRAINT "ballon_seasons_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ballon_seasons"
ADD CONSTRAINT "ballon_seasons_winnerUserId_fkey"
FOREIGN KEY ("winnerUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ballon_seasons"
ADD CONSTRAINT "ballon_seasons_risingStarWinnerUserId_fkey"
FOREIGN KEY ("risingStarWinnerUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ballon_season_tournaments"
ADD CONSTRAINT "ballon_season_tournaments_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "ballon_seasons"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ballon_season_tournaments"
ADD CONSTRAINT "ballon_season_tournaments_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ballon_ranking_snapshots"
ADD CONSTRAINT "ballon_ranking_snapshots_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "ballon_seasons"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
