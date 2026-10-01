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

CREATE TYPE "SponsorStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "SponsorPlacementKey" AS ENUM (
  'DASHBOARD',
  'AWARDS',
  'LEAGUE_WAR',
  'DISCOVER'
);

CREATE TYPE "SubscriptionAudience" AS ENUM (
  'USER',
  'LEAGUE'
);

CREATE TYPE "SubscriptionInterval" AS ENUM (
  'MONTHLY',
  'YEARLY'
);

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
  'CANCELED',
  'EXPIRED'
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

CREATE TABLE "sponsors" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "logoUrl" TEXT,
  "websiteUrl" TEXT,
  "description" TEXT,
  "disclosureLabel" VARCHAR(60) NOT NULL DEFAULT 'Sponsored',
  "status" "SponsorStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sponsor_placements" (
  "id" UUID NOT NULL,
  "sponsorId" UUID NOT NULL,
  "key" "SponsorPlacementKey" NOT NULL,
  "headline" VARCHAR(180) NOT NULL,
  "body" TEXT,
  "ctaLabel" VARCHAR(60),
  "ctaUrl" TEXT,
  "rewardText" VARCHAR(300),
  "termsUrl" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sponsor_placements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_plans" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "audience" "SubscriptionAudience" NOT NULL,
  "interval" "SubscriptionInterval" NOT NULL,
  "priceMinor" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "features" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_subscriptions" (
  "id" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "audience" "SubscriptionAudience" NOT NULL,
  "userId" UUID,
  "leagueId" UUID,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  "providerSubscriptionId" VARCHAR(160),
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "grantedByUserId" UUID,
  "note" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_subscriptions_owner_check"
    CHECK (
      ("audience" = 'USER' AND "userId" IS NOT NULL AND "leagueId" IS NULL)
      OR
      ("audience" = 'LEAGUE' AND "leagueId" IS NOT NULL AND "userId" IS NULL)
    )
);

CREATE UNIQUE INDEX "fair_play_appeals_eventId_appealedByUserId_key"
  ON "fair_play_appeals"("eventId", "appealedByUserId");

CREATE UNIQUE INDEX "subscription_plans_code_key"
  ON "subscription_plans"("code");

CREATE INDEX "fair_play_events_userId_issuedAt_idx"
  ON "fair_play_events"("userId", "issuedAt");
CREATE INDEX "fair_play_events_userId_expiresAt_revokedAt_idx"
  ON "fair_play_events"("userId", "expiresAt", "revokedAt");
CREATE INDEX "fair_play_events_leagueId_issuedAt_idx"
  ON "fair_play_events"("leagueId", "issuedAt");
CREATE INDEX "fair_play_appeals_status_createdAt_idx"
  ON "fair_play_appeals"("status", "createdAt");
CREATE INDEX "sponsors_status_updatedAt_idx"
  ON "sponsors"("status", "updatedAt");
CREATE INDEX "sponsor_placements_key_isActive_startsAt_endsAt_priority_idx"
  ON "sponsor_placements"("key", "isActive", "startsAt", "endsAt", "priority");
CREATE INDEX "sponsor_placements_sponsorId_idx"
  ON "sponsor_placements"("sponsorId");
CREATE INDEX "subscription_plans_audience_isActive_priceMinor_idx"
  ON "subscription_plans"("audience", "isActive", "priceMinor");
CREATE INDEX "user_subscriptions_userId_status_currentPeriodEnd_idx"
  ON "user_subscriptions"("userId", "status", "currentPeriodEnd");
CREATE INDEX "user_subscriptions_leagueId_status_currentPeriodEnd_idx"
  ON "user_subscriptions"("leagueId", "status", "currentPeriodEnd");
CREATE INDEX "user_subscriptions_planId_status_idx"
  ON "user_subscriptions"("planId", "status");

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

ALTER TABLE "sponsors"
  ADD CONSTRAINT "sponsors_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sponsor_placements"
  ADD CONSTRAINT "sponsor_placements_sponsorId_fkey"
  FOREIGN KEY ("sponsorId") REFERENCES "sponsors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsor_placements"
  ADD CONSTRAINT "sponsor_placements_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_subscriptions"
  ADD CONSTRAINT "user_subscriptions_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
