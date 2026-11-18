-- Additive, opt-in club tables. Existing tournaments, entrants and results remain unchanged.
CREATE TABLE "arena_clubs" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(400),
  "ownerUserId" UUID NOT NULL,
  "inviteHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "arena_clubs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "arena_clubs_slug_key" ON "arena_clubs"("slug");
CREATE UNIQUE INDEX "arena_clubs_inviteHash_key" ON "arena_clubs"("inviteHash");
CREATE INDEX "arena_clubs_ownerUserId_idx" ON "arena_clubs"("ownerUserId");
CREATE INDEX "arena_clubs_createdAt_idx" ON "arena_clubs"("createdAt");
ALTER TABLE "arena_clubs" ADD CONSTRAINT "arena_clubs_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "arena_club_members" (
  "clubId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arena_club_members_pkey" PRIMARY KEY ("clubId","userId")
);
CREATE INDEX "arena_club_members_userId_idx" ON "arena_club_members"("userId");
ALTER TABLE "arena_club_members" ADD CONSTRAINT "arena_club_members_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "arena_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_club_members" ADD CONSTRAINT "arena_club_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "arena_club_entries" (
  "registrationId" UUID NOT NULL,
  "clubId" UUID NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arena_club_entries_pkey" PRIMARY KEY ("registrationId")
);
CREATE INDEX "arena_club_entries_clubId_linkedAt_idx" ON "arena_club_entries"("clubId","linkedAt");
ALTER TABLE "arena_club_entries" ADD CONSTRAINT "arena_club_entries_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "arena_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_club_entries" ADD CONSTRAINT "arena_club_entries_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "tournament_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
