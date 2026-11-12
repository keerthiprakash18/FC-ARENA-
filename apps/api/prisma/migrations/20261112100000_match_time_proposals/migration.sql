-- Advisory match-time proposals: cannot change scheduled fixtures, results or awards.
-- All business operations remain gated by MATCH_TIME_PROPOSALS_ENABLED (off by default).
CREATE TABLE "match_time_proposals" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "proposedByUserId" UUID NOT NULL,
    "proposedSide" VARCHAR(4) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(240),
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "confirmedByUserId" UUID,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "match_time_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "match_time_proposals_matchId_status_createdAt_idx"
  ON "match_time_proposals"("matchId", "status", "createdAt");
CREATE INDEX "match_time_proposals_proposedByUserId_createdAt_idx"
  ON "match_time_proposals"("proposedByUserId", "createdAt");

ALTER TABLE "match_time_proposals" ADD CONSTRAINT "match_time_proposals_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_time_proposals" ADD CONSTRAINT "match_time_proposals_proposedByUserId_fkey"
  FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_time_proposals" ADD CONSTRAINT "match_time_proposals_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
