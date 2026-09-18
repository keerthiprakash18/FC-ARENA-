/*
  Warnings:

  - A unique constraint covering the columns `[confirmedResultSubmissionId]` on the table `matches` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ResultSubmissionStatus" AS ENUM ('PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResultSubmissionSource" AS ENUM ('MANUAL', 'OCR');

-- CreateEnum
CREATE TYPE "StatEventType" AS ENUM ('APPLY', 'REVERSE');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "confirmedResultSubmissionId" UUID;

-- CreateTable
CREATE TABLE "result_submissions" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "source" "ResultSubmissionSource" NOT NULL DEFAULT 'MANUAL',
    "ocrExtractionId" UUID,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "status" "ResultSubmissionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "result_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_extractions" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "submittedByUserId" UUID NOT NULL,
    "imagePath" TEXT NOT NULL,
    "mimeType" VARCHAR(50) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "OcrStatus" NOT NULL DEFAULT 'QUEUED',
    "rawText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "detectedHomeName" VARCHAR(160),
    "detectedAwayName" VARCHAR(160),
    "detectedHomeScore" INTEGER,
    "detectedAwayScore" INTEGER,
    "homeNameConfidence" DOUBLE PRECISION,
    "awayNameConfidence" DOUBLE PRECISION,
    "scoreConfidence" DOUBLE PRECISION,
    "homeMatchedUserId" UUID,
    "awayMatchedUserId" UUID,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_standings" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "goalDifference" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "form" VARCHAR(10) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_tournament_statistics" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "goalDifference" INTEGER NOT NULL DEFAULT 0,
    "form" VARCHAR(10) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_tournament_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_result_stat_events" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "resultSubmissionId" UUID NOT NULL,
    "type" "StatEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_result_stat_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "result_submissions_ocrExtractionId_key" ON "result_submissions"("ocrExtractionId");

-- CreateIndex
CREATE INDEX "result_submissions_matchId_status_idx" ON "result_submissions"("matchId", "status");

-- CreateIndex
CREATE INDEX "result_submissions_submittedByUserId_status_idx" ON "result_submissions"("submittedByUserId", "status");

-- CreateIndex
CREATE INDEX "ocr_extractions_matchId_createdAt_idx" ON "ocr_extractions"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "ocr_extractions_submittedByUserId_idx" ON "ocr_extractions"("submittedByUserId");

-- CreateIndex
CREATE INDEX "ocr_extractions_status_idx" ON "ocr_extractions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_standings_registrationId_key" ON "tournament_standings"("registrationId");

-- CreateIndex
CREATE INDEX "tournament_standings_tournamentId_points_goalDifference_goa_idx" ON "tournament_standings"("tournamentId", "points", "goalDifference", "goalsFor");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_standings_tournamentId_registrationId_key" ON "tournament_standings"("tournamentId", "registrationId");

-- CreateIndex
CREATE INDEX "player_tournament_statistics_userId_idx" ON "player_tournament_statistics"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_tournament_statistics_tournamentId_userId_key" ON "player_tournament_statistics"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "match_result_stat_events_matchId_idx" ON "match_result_stat_events"("matchId");

-- CreateIndex
CREATE INDEX "match_result_stat_events_tournamentId_createdAt_idx" ON "match_result_stat_events"("tournamentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_stat_events_resultSubmissionId_type_key" ON "match_result_stat_events"("resultSubmissionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "matches_confirmedResultSubmissionId_key" ON "matches"("confirmedResultSubmissionId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmedResultSubmissionId_fkey" FOREIGN KEY ("confirmedResultSubmissionId") REFERENCES "result_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_submissions" ADD CONSTRAINT "result_submissions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_submissions" ADD CONSTRAINT "result_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_submissions" ADD CONSTRAINT "result_submissions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_submissions" ADD CONSTRAINT "result_submissions_ocrExtractionId_fkey" FOREIGN KEY ("ocrExtractionId") REFERENCES "ocr_extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_homeMatchedUserId_fkey" FOREIGN KEY ("homeMatchedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_awayMatchedUserId_fkey" FOREIGN KEY ("awayMatchedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "tournament_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_tournament_statistics" ADD CONSTRAINT "player_tournament_statistics_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_tournament_statistics" ADD CONSTRAINT "player_tournament_statistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_stat_events" ADD CONSTRAINT "match_result_stat_events_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_stat_events" ADD CONSTRAINT "match_result_stat_events_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_stat_events" ADD CONSTRAINT "match_result_stat_events_resultSubmissionId_fkey" FOREIGN KEY ("resultSubmissionId") REFERENCES "result_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
