-- CreateEnum
CREATE TYPE "TournamentPairingMethod" AS ENUM ('CROSS_GROUP', 'SEEDED', 'RANDOM', 'MANUAL');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "fixturesPublishedAt" TIMESTAMP(3),
ADD COLUMN     "playoffPairingMethod" "TournamentPairingMethod" NOT NULL DEFAULT 'CROSS_GROUP',
ADD COLUMN     "qualifiersPerGroup" INTEGER;
