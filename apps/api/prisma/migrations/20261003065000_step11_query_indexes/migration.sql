-- Production Readiness Step 11: additive indexes for high-frequency read paths.
-- These indexes do not change rows or constraints and are safe to deploy before
-- application code that benefits from them.

CREATE INDEX IF NOT EXISTS "tournaments_leagueId_status_createdAt_idx"
ON "tournaments"("leagueId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "trm_user_tournament_registration_idx"
ON "tournament_registration_members"("userId", "tournamentId", "registrationId");

CREATE INDEX IF NOT EXISTS "fixtures_tournamentId_status_scheduledAt_sequence_idx"
ON "fixtures"("tournamentId", "status", "scheduledAt", "sequence");

CREATE INDEX IF NOT EXISTS "matches_tournamentId_status_updatedAt_idx"
ON "matches"("tournamentId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "result_submissions_matchId_status_createdAt_idx"
ON "result_submissions"("matchId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_eventAt_idx"
ON "notifications"("userId", "readAt", "eventAt");

CREATE INDEX IF NOT EXISTS "push_devices_userId_lastSyncedAt_idx"
ON "push_devices"("userId", "lastSyncedAt");

CREATE INDEX IF NOT EXISTS "audit_logs_actorUserId_action_createdAt_idx"
ON "audit_logs"("actorUserId", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_logs_action_targetType_targetId_createdAt_idx"
ON "audit_logs"("action", "targetType", "targetId", "createdAt");
