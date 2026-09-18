-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAGUE_JOIN_REQUESTED', 'LEAGUE_REQUEST_APPROVED', 'LEAGUE_REQUEST_REJECTED', 'TOURNAMENT_CREATED', 'TOURNAMENT_REGISTRATION_OPENED', 'TOURNAMENT_APPLICATION_APPROVED', 'TOURNAMENT_APPLICATION_REJECTED', 'FIXTURE_CREATED', 'FIXTURE_CHANGED', 'MATCH_REMINDER', 'RESULT_SUBMITTED', 'RESULT_CONFIRMED', 'STATISTICS_UPDATED', 'TOURNAMENT_COMPLETED', 'ACHIEVEMENT_RECEIVED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "entityType" VARCHAR(80),
    "entityId" VARCHAR(120),
    "dedupeKey" VARCHAR(255) NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_eventAt_idx" ON "notifications"("userId", "eventAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
