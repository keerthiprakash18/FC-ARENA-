CREATE TYPE "LeagueWarStatus" AS ENUM ('INVITED', 'ACCEPTED', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "LeagueWarLegType" AS ENUM ('SINGLE_LEG', 'HOME_AWAY');
CREATE TYPE "LeagueWarMatchStatus" AS ENUM ('SCHEDULED', 'COMPLETED');

CREATE TABLE "league_wars" (
  "id" UUID NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "homeLeagueId" UUID NOT NULL,
  "awayLeagueId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "winnerLeagueId" UUID,
  "status" "LeagueWarStatus" NOT NULL DEFAULT 'INVITED',
  "playerCount" INTEGER NOT NULL,
  "legType" "LeagueWarLegType" NOT NULL DEFAULT 'SINGLE_LEG',
  "winPoints" INTEGER NOT NULL DEFAULT 3,
  "drawPoints" INTEGER NOT NULL DEFAULT 1,
  "lossPoints" INTEGER NOT NULL DEFAULT 0,
  "acceptedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "league_wars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "league_war_participants" (
  "id" UUID NOT NULL,
  "warId" UUID NOT NULL,
  "leagueId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "slot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "league_war_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "league_war_matches" (
  "id" UUID NOT NULL,
  "warId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "leg" INTEGER NOT NULL DEFAULT 1,
  "homePlayerUserId" UUID NOT NULL,
  "awayPlayerUserId" UUID NOT NULL,
  "homeScore" INTEGER,
  "awayScore" INTEGER,
  "status" "LeagueWarMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "resultUpdatedByUserId" UUID,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "league_war_matches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "league_wars_homeLeagueId_status_idx" ON "league_wars"("homeLeagueId", "status");
CREATE INDEX "league_wars_awayLeagueId_status_idx" ON "league_wars"("awayLeagueId", "status");
CREATE INDEX "league_wars_createdByUserId_idx" ON "league_wars"("createdByUserId");
CREATE UNIQUE INDEX "league_war_participants_warId_userId_key" ON "league_war_participants"("warId", "userId");
CREATE UNIQUE INDEX "league_war_participants_warId_leagueId_slot_key" ON "league_war_participants"("warId", "leagueId", "slot");
CREATE INDEX "league_war_participants_leagueId_idx" ON "league_war_participants"("leagueId");
CREATE INDEX "league_war_participants_userId_idx" ON "league_war_participants"("userId");
CREATE UNIQUE INDEX "league_war_matches_warId_sequence_key" ON "league_war_matches"("warId", "sequence");
CREATE INDEX "league_war_matches_warId_status_idx" ON "league_war_matches"("warId", "status");
CREATE INDEX "league_war_matches_homePlayerUserId_idx" ON "league_war_matches"("homePlayerUserId");
CREATE INDEX "league_war_matches_awayPlayerUserId_idx" ON "league_war_matches"("awayPlayerUserId");

ALTER TABLE "league_wars" ADD CONSTRAINT "league_wars_homeLeagueId_fkey" FOREIGN KEY ("homeLeagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_wars" ADD CONSTRAINT "league_wars_awayLeagueId_fkey" FOREIGN KEY ("awayLeagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_wars" ADD CONSTRAINT "league_wars_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_wars" ADD CONSTRAINT "league_wars_winnerLeagueId_fkey" FOREIGN KEY ("winnerLeagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "league_war_participants" ADD CONSTRAINT "league_war_participants_warId_fkey" FOREIGN KEY ("warId") REFERENCES "league_wars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_war_participants" ADD CONSTRAINT "league_war_participants_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_war_participants" ADD CONSTRAINT "league_war_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_war_matches" ADD CONSTRAINT "league_war_matches_warId_fkey" FOREIGN KEY ("warId") REFERENCES "league_wars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_war_matches" ADD CONSTRAINT "league_war_matches_homePlayerUserId_fkey" FOREIGN KEY ("homePlayerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_war_matches" ADD CONSTRAINT "league_war_matches_awayPlayerUserId_fkey" FOREIGN KEY ("awayPlayerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_war_matches" ADD CONSTRAINT "league_war_matches_resultUpdatedByUserId_fkey" FOREIGN KEY ("resultUpdatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
