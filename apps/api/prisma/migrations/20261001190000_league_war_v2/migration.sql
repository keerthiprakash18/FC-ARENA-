ALTER TYPE "LeagueWarStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "LeagueWarStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "LeagueWarPairingMode" AS ENUM ('SLOT', 'MANUAL', 'RANDOM');
CREATE TYPE "LeagueWarResultStatus" AS ENUM ('NONE', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DISPUTED', 'WALKOVER_PENDING', 'WALKOVER_CONFIRMED');

ALTER TABLE "league_wars"
  ADD COLUMN "rematchOfWarId" UUID,
  ADD COLUMN "pairingMode" "LeagueWarPairingMode" NOT NULL DEFAULT 'SLOT',
  ADD COLUMN "challengeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
  ADD COLUMN "deadlineAt" TIMESTAMP(3),
  ADD COLUMN "homeReadyAt" TIMESTAMP(3),
  ADD COLUMN "awayReadyAt" TIMESTAMP(3),
  ADD COLUMN "homeRosterLockedAt" TIMESTAMP(3),
  ADD COLUMN "awayRosterLockedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" VARCHAR(500),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" VARCHAR(500);

ALTER TABLE "league_war_matches"
  ADD COLUMN "resultStatus" "LeagueWarResultStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "resultSubmittedByUserId" UUID,
  ADD COLUMN "resultSubmittedByLeagueId" UUID,
  ADD COLUMN "resultConfirmedByUserId" UUID,
  ADD COLUMN "proofUrl" TEXT,
  ADD COLUMN "disputeReason" VARCHAR(1000),
  ADD COLUMN "walkoverLeagueId" UUID,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "disputedAt" TIMESTAMP(3);

CREATE INDEX "league_wars_challengeExpiresAt_idx" ON "league_wars"("challengeExpiresAt");
CREATE INDEX "league_wars_rematchOfWarId_idx" ON "league_wars"("rematchOfWarId");
CREATE INDEX "league_war_matches_warId_resultStatus_idx" ON "league_war_matches"("warId", "resultStatus");
