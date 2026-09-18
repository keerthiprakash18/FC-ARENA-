-- CreateEnum
CREATE TYPE "LeagueMemberType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "LeagueApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LeagueAdminRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TournamentMode" AS ENUM ('SOLO', 'DUO', 'TEAM');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('ROUND_ROBIN', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "region" VARCHAR(120),
    "rules" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 100,
    "creatorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_members" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "LeagueMemberType" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_applications" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "LeagueApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_admins" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "LeagueAdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "leagueId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "mode" "TournamentMode" NOT NULL,
    "format" "TournamentFormat" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "teamSize" INTEGER NOT NULL,
    "maxEntries" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3),
    "registrationOpenedAt" TIMESTAMP(3),
    "registrationClosedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "registeredByUserId" UUID NOT NULL,
    "entryName" VARCHAR(120),
    "status" "TournamentRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registration_members" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_registration_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_code_key" ON "leagues"("code");

-- CreateIndex
CREATE INDEX "leagues_creatorUserId_idx" ON "leagues"("creatorUserId");

-- CreateIndex
CREATE INDEX "leagues_name_idx" ON "leagues"("name");

-- CreateIndex
CREATE INDEX "league_members_userId_idx" ON "league_members"("userId");

-- CreateIndex
CREATE INDEX "league_members_leagueId_type_idx" ON "league_members"("leagueId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "league_members_leagueId_userId_key" ON "league_members"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "league_applications_leagueId_status_idx" ON "league_applications"("leagueId", "status");

-- CreateIndex
CREATE INDEX "league_applications_userId_status_idx" ON "league_applications"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "league_applications_leagueId_userId_key" ON "league_applications"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "league_admins_userId_idx" ON "league_admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "league_admins_leagueId_userId_key" ON "league_admins"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_code_key" ON "tournaments"("code");

-- CreateIndex
CREATE INDEX "tournaments_leagueId_status_idx" ON "tournaments"("leagueId", "status");

-- CreateIndex
CREATE INDEX "tournaments_createdByUserId_idx" ON "tournaments"("createdByUserId");

-- CreateIndex
CREATE INDEX "tournament_registrations_tournamentId_status_idx" ON "tournament_registrations"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "tournament_registrations_registeredByUserId_idx" ON "tournament_registrations"("registeredByUserId");

-- CreateIndex
CREATE INDEX "tournament_registration_members_registrationId_idx" ON "tournament_registration_members"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registration_members_tournamentId_userId_key" ON "tournament_registration_members"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registration_members_registrationId_userId_key" ON "tournament_registration_members"("registrationId", "userId");

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_applications" ADD CONSTRAINT "league_applications_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_applications" ADD CONSTRAINT "league_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_applications" ADD CONSTRAINT "league_applications_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_admins" ADD CONSTRAINT "league_admins_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_admins" ADD CONSTRAINT "league_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "tournament_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registration_members" ADD CONSTRAINT "tournament_registration_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
