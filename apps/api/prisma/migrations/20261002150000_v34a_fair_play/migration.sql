ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FAIR_PLAY_UPDATED';

CREATE TYPE "FairPlayEventKind" AS ENUM (
  'COMMENDATION',
  'WARNING',
  'LATE_RESULT',
  'NO_SHOW',
  'RESULT_INTEGRITY',
  'CONDUCT',
  'OTHER'
);

CREATE TYPE "FairPlayAppealStatus" AS ENUM (
  'PENDING',
  'UPHELD',
  'OVERTURNED'
);

CREATE TABLE "fair_play_events" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "leagueId" UUID NOT NULL,
  "kind" "FairPlayEventKind" NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "evidenceUrl" TEXT,
  "issuedByUserId" UUID NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" UUID,
  "revocationNote" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fair_play_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fair_play_appeals" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "appealedByUserId" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "status" "FairPlayAppealStatus" NOT NULL DEFAULT 'PENDING',
  "resolutionNote" VARCHAR(1000),
  "resolvedByUserId" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fair_play_appeals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fair_play_appeals_eventId_appealedByUserId_key"
  ON "fair_play_appeals"("eventId", "appealedByUserId");

CREATE INDEX "fair_play_events_userId_issuedAt_idx"
  ON "fair_play_events"("userId", "issuedAt");

CREATE INDEX "fair_play_events_userId_expiresAt_revokedAt_idx"
  ON "fair_play_events"("userId", "expiresAt", "revokedAt");

CREATE INDEX "fair_play_events_leagueId_issuedAt_idx"
  ON "fair_play_events"("leagueId", "issuedAt");

CREATE INDEX "fair_play_appeals_status_createdAt_idx"
  ON "fair_play_appeals"("status", "createdAt");

ALTER TABLE "fair_play_events"
  ADD CONSTRAINT "fair_play_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fair_play_events"
  ADD CONSTRAINT "fair_play_events_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fair_play_events"
  ADD CONSTRAINT "fair_play_events_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fair_play_events"
  ADD CONSTRAINT "fair_play_events_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fair_play_appeals"
  ADD CONSTRAINT "fair_play_appeals_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "fair_play_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fair_play_appeals"
  ADD CONSTRAINT "fair_play_appeals_appealedByUserId_fkey"
  FOREIGN KEY ("appealedByUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fair_play_appeals"
  ADD CONSTRAINT "fair_play_appeals_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
