-- CreateEnum
CREATE TYPE "TournamentCompetitionFormat" AS ENUM ('LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'SINGLE_ELIMINATION', 'GROUP_STAGE_KNOCKOUT', 'CUSTOM_MANUAL');

-- CreateEnum
CREATE TYPE "TournamentGroupMode" AS ENUM ('SINGLE_GROUP', 'MULTIPLE_GROUPS');

-- CreateEnum
CREATE TYPE "TournamentLegType" AS ENUM ('SINGLE_LEG', 'HOME_AWAY');

-- CreateEnum
CREATE TYPE "TournamentFixtureMode" AS ENUM ('AUTOMATIC', 'RANDOMIZED', 'MANUAL');

-- CreateEnum
CREATE TYPE "TournamentVisibility" AS ENUM ('PRIVATE', 'LEAGUE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TournamentRegistrationMode" AS ENUM ('OPEN', 'APPROVAL', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "TournamentWizardStep" AS ENUM ('SETUP', 'TEAMS', 'GROUPS', 'FIXTURE_SETTINGS', 'FIXTURE_PREVIEW', 'QUALIFICATION', 'REVIEW', 'PUBLISHED');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "competitionFormat" "TournamentCompetitionFormat" NOT NULL DEFAULT 'LEAGUE_ROUND_ROBIN',
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "fixtureMode" "TournamentFixtureMode" NOT NULL DEFAULT 'AUTOMATIC',
ADD COLUMN     "groupMode" "TournamentGroupMode" NOT NULL DEFAULT 'SINGLE_GROUP',
ADD COLUMN     "legType" "TournamentLegType" NOT NULL DEFAULT 'SINGLE_LEG',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "registrationMode" "TournamentRegistrationMode" NOT NULL DEFAULT 'APPROVAL',
ADD COLUMN     "visibility" "TournamentVisibility" NOT NULL DEFAULT 'LEAGUE',
ADD COLUMN     "wizardStep" "TournamentWizardStep" NOT NULL DEFAULT 'SETUP';
