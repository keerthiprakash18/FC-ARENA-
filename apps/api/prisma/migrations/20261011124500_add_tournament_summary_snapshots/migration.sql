CREATE TABLE "tournament_summaries" (
  "id" UUID NOT NULL,
  "tournamentId" UUID NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tournament_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_summaries_tournamentId_key"
ON "tournament_summaries"("tournamentId");

CREATE INDEX "tournament_summaries_publishedAt_idx"
ON "tournament_summaries"("publishedAt");

CREATE INDEX "tournament_summaries_publishedByUserId_publishedAt_idx"
ON "tournament_summaries"("publishedByUserId", "publishedAt");

ALTER TABLE "tournament_summaries"
ADD CONSTRAINT "tournament_summaries_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
