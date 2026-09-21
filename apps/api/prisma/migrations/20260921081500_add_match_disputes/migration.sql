CREATE TABLE "match_disputes" (
  "id" UUID NOT NULL,
  "matchId" UUID NOT NULL,
  "raisedByUserId" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "evidenceUrl" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  "resolutionNote" VARCHAR(1000),
  "resolvedByUserId" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "match_disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "match_disputes_matchId_status_idx"
ON "match_disputes"("matchId", "status");

CREATE INDEX "match_disputes_raisedByUserId_status_idx"
ON "match_disputes"("raisedByUserId", "status");

CREATE UNIQUE INDEX "match_disputes_one_open_per_user_match"
ON "match_disputes"("matchId", "raisedByUserId")
WHERE "status" = 'OPEN';

ALTER TABLE "match_disputes"
ADD CONSTRAINT "match_disputes_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "matches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_disputes"
ADD CONSTRAINT "match_disputes_raisedByUserId_fkey"
FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_disputes"
ADD CONSTRAINT "match_disputes_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
