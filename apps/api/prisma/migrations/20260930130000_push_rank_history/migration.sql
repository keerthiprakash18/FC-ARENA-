CREATE TABLE "ranking_snapshots" ("id" UUID NOT NULL, "leagueId" UUID NOT NULL, "scope" VARCHAR(8) NOT NULL, "day" DATE NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "positions" JSONB NOT NULL, CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ranking_snapshots_leagueId_scope_day_key" ON "ranking_snapshots"("leagueId","scope","day");
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "push_devices" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "sessionId" UUID NOT NULL, "token" VARCHAR(2048) NOT NULL, "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");
CREATE INDEX "push_devices_lastSyncedAt_idx" ON "push_devices"("lastSyncedAt");
CREATE INDEX "push_devices_userId_idx" ON "push_devices"("userId");
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "refresh_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "push_deliveries" ("id" UUID NOT NULL, "deviceId" UUID NOT NULL, "notificationId" UUID NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "leaseUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deliveredAt" TIMESTAMP(3), CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "push_deliveries_deviceId_notificationId_key" ON "push_deliveries"("deviceId","notificationId");
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope historical notification deduplication to its recipient before background sync starts.
UPDATE "notifications" SET "dedupeKey" = "userId"::text || ':' || "dedupeKey";
