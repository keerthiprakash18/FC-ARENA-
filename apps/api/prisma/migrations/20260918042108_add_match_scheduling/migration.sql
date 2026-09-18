-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNSCHEDULED', 'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED');

-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "venue" VARCHAR(160);

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "dailyMatchLimit" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "matchDurationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "matchesPerParticipantPerDay" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "serialNumber" SERIAL NOT NULL,
    "matchCode" VARCHAR(20),
    "tournamentId" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'UNSCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matches_serialNumber_key" ON "matches"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "matches_matchCode_key" ON "matches"("matchCode");

-- CreateIndex
CREATE UNIQUE INDEX "matches_fixtureId_key" ON "matches"("fixtureId");

-- CreateIndex
CREATE INDEX "matches_tournamentId_status_idx" ON "matches"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "fixtures_tournamentId_scheduledAt_idx" ON "fixtures"("tournamentId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
