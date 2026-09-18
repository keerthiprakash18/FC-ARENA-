-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('TOURNAMENT_CHAMPION', 'TOURNAMENT_RUNNER_UP', 'GOLDEN_BOOT', 'BEST_PLAYER', 'WINNING_STREAK', 'TOURNAMENT_PARTICIPATION');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievements_userId_awardedAt_idx" ON "achievements"("userId", "awardedAt");

-- CreateIndex
CREATE INDEX "achievements_tournamentId_type_idx" ON "achievements"("tournamentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_userId_tournamentId_type_key" ON "achievements"("userId", "tournamentId", "type");

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
