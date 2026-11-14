BEGIN;

CREATE TABLE "league_invites" (
    "id" UUID PRIMARY KEY,
    "leagueId" UUID NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "league_invites_tokenHash_key" ON "league_invites"("tokenHash");
CREATE INDEX "league_invites_leagueId_createdAt_idx" ON "league_invites"("leagueId", "createdAt");

ALTER TABLE "league_applications" ADD COLUMN "inviteId" UUID REFERENCES "league_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "league_applications_inviteId_status_idx" ON "league_applications"("inviteId", "status");

CREATE TABLE "arena_league_subscriptions" (
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "leagueId" UUID NOT NULL REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("userId", "leagueId")
);
CREATE INDEX "arena_league_subscriptions_leagueId_idx" ON "arena_league_subscriptions"("leagueId");

CREATE TABLE "arena_player_mutes" (
    "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "mutedUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("userId", "mutedUserId"),
    CONSTRAINT "arena_player_mutes_distinct_users" CHECK ("userId" <> "mutedUserId")
);
CREATE INDEX "arena_player_mutes_mutedUserId_idx" ON "arena_player_mutes"("mutedUserId");
CREATE INDEX "refresh_sessions_createdAt_userId_idx" ON "refresh_sessions"("createdAt", "userId");

COMMIT;
