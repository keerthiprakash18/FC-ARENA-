-- Universal playoff engine, loser progression and club-inspired account themes.
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'CITY_SKY';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'LONDON_RED';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'MERSEY_RED';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'MADRID_ROYAL';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'CATALAN_NIGHTS';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'MUNICH_RED';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'PARIS_NIGHT';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'MILAN_BLUE';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'MILAN_RED';
ALTER TYPE "ThemePreference" ADD VALUE IF NOT EXISTS 'TURIN_MONO';

CREATE TYPE "PlayoffFormat" AS ENUM ('GLOBAL_SEEDED', 'PROTECTED_SEED', 'DOUBLE_CHANCE');
CREATE TYPE "PlayoffSource" AS ENUM ('AUTO', 'DIRECT_ENTRIES', 'OVERALL_STANDINGS', 'GROUP_QUALIFIERS');
CREATE TYPE "PlayoffSeedingBasis" AS ENUM ('AUTO', 'OVERALL_PERFORMANCE', 'GROUP_POSITION', 'MANUAL', 'RANDOM');

ALTER TABLE "tournaments"
  ADD COLUMN "playoffFormat" "PlayoffFormat" NOT NULL DEFAULT 'PROTECTED_SEED',
  ADD COLUMN "playoffSource" "PlayoffSource" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "playoffSeedingBasis" "PlayoffSeedingBasis" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "playoffQualifiersTotal" INTEGER,
  ADD COLUMN "avoidSameGroupEarly" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "fixtures"
  ADD COLUMN "loserNextFixtureId" UUID,
  ADD COLUMN "loserNextSlot" "FixtureNextSlot";

ALTER TABLE "fixtures"
  ADD CONSTRAINT "fixtures_loserNextFixtureId_fkey"
  FOREIGN KEY ("loserNextFixtureId")
  REFERENCES "fixtures"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "fixtures_loserNextFixtureId_idx"
  ON "fixtures"("loserNextFixtureId");

UPDATE "tournaments"
SET
  "playoffFormat" = 'PROTECTED_SEED',
  "playoffSource" = 'GROUP_QUALIFIERS',
  "playoffSeedingBasis" = 'GROUP_POSITION'
WHERE "competitionFormat" = 'GROUP_STAGE_KNOCKOUT';

UPDATE "tournaments"
SET
  "playoffFormat" = 'GLOBAL_SEEDED',
  "playoffSource" = 'DIRECT_ENTRIES',
  "playoffSeedingBasis" = 'AUTO'
WHERE "competitionFormat" = 'SINGLE_ELIMINATION';
