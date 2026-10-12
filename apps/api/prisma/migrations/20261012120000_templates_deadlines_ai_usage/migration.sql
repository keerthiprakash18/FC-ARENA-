-- CreateEnum
CREATE TYPE "DeadlineCaseStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "resultDeadlineHours" INTEGER NOT NULL DEFAULT 48;

-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN "resultDeadlineAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tournament_templates" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_deadline_cases" (
    "id" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "DeadlineCaseStatus" NOT NULL DEFAULT 'OPEN',
    "reminderSentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" VARCHAR(1000),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixture_deadline_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_buckets" (
    "userId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "minuteStartedAt" TIMESTAMP(3) NOT NULL,
    "minuteCount" INTEGER NOT NULL DEFAULT 0,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_buckets_pkey" PRIMARY KEY ("userId", "day")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_templates_leagueId_name_key" ON "tournament_templates"("leagueId", "name");
CREATE INDEX "tournament_templates_leagueId_updatedAt_idx" ON "tournament_templates"("leagueId", "updatedAt");
CREATE INDEX "tournament_templates_createdByUserId_idx" ON "tournament_templates"("createdByUserId");
CREATE UNIQUE INDEX "fixture_deadline_cases_fixtureId_key" ON "fixture_deadline_cases"("fixtureId");
CREATE INDEX "fixture_deadline_cases_tournamentId_status_dueAt_idx" ON "fixture_deadline_cases"("tournamentId", "status", "dueAt");
CREATE INDEX "ai_usage_buckets_updatedAt_idx" ON "ai_usage_buckets"("updatedAt");

-- AddForeignKey
ALTER TABLE "tournament_templates" ADD CONSTRAINT "tournament_templates_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_templates" ADD CONSTRAINT "tournament_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixture_deadline_cases" ADD CONSTRAINT "fixture_deadline_cases_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixture_deadline_cases" ADD CONSTRAINT "fixture_deadline_cases_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage_buckets" ADD CONSTRAINT "ai_usage_buckets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
