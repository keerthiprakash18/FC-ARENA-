-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('UNSCHEDULED', 'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FixtureNextSlot" AS ENUM ('HOME', 'AWAY');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "fixturesGeneratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL,
    "fixtureCode" VARCHAR(32) NOT NULL,
    "tournamentId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "matchday" INTEGER,
    "roundNumber" INTEGER NOT NULL,
    "roundName" VARCHAR(80) NOT NULL,
    "bracketPosition" INTEGER NOT NULL,
    "homeRegistrationId" UUID,
    "awayRegistrationId" UUID,
    "nextFixtureId" UUID,
    "nextSlot" "FixtureNextSlot",
    "scheduledAt" TIMESTAMP(3),
    "status" "FixtureStatus" NOT NULL DEFAULT 'UNSCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_fixtureCode_key" ON "fixtures"("fixtureCode");

-- CreateIndex
CREATE INDEX "fixtures_tournamentId_roundNumber_idx" ON "fixtures"("tournamentId", "roundNumber");

-- CreateIndex
CREATE INDEX "fixtures_tournamentId_matchday_idx" ON "fixtures"("tournamentId", "matchday");

-- CreateIndex
CREATE INDEX "fixtures_homeRegistrationId_idx" ON "fixtures"("homeRegistrationId");

-- CreateIndex
CREATE INDEX "fixtures_awayRegistrationId_idx" ON "fixtures"("awayRegistrationId");

-- CreateIndex
CREATE INDEX "fixtures_nextFixtureId_idx" ON "fixtures"("nextFixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_tournamentId_sequence_key" ON "fixtures"("tournamentId", "sequence");

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_homeRegistrationId_fkey" FOREIGN KEY ("homeRegistrationId") REFERENCES "tournament_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_awayRegistrationId_fkey" FOREIGN KEY ("awayRegistrationId") REFERENCES "tournament_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_nextFixtureId_fkey" FOREIGN KEY ("nextFixtureId") REFERENCES "fixtures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
