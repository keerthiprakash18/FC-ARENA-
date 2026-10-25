CREATE TYPE "LeagueAdminPermission" AS ENUM (
  'MANAGE_SETTINGS',
  'MANAGE_MEMBERS',
  'MANAGE_FIXTURES',
  'MANAGE_STANDINGS',
  'MANAGE_TOURNAMENTS',
  'VIEW_REPORTS'
);

CREATE TYPE "TournamentAdminRole" AS ENUM ('OWNER', 'ADMIN');

CREATE TYPE "TournamentAdminPermission" AS ENUM (
  'MANAGE_FIXTURES',
  'MANAGE_RESULTS',
  'VERIFY_SCORES',
  'MANAGE_PARTICIPANTS',
  'MANAGE_SETTINGS',
  'VIEW_REPORTS'
);

ALTER TABLE "leagues"
  ADD COLUMN "maxAdmins" INTEGER;

ALTER TABLE "league_admins"
  ADD COLUMN "permissions" "LeagueAdminPermission"[] NOT NULL DEFAULT ARRAY[]::"LeagueAdminPermission"[];

ALTER TABLE "tournaments"
  ADD COLUMN "maxAdmins" INTEGER;

ALTER TABLE "leagues"
  ADD CONSTRAINT "leagues_maxAdmins_nonnegative_chk"
  CHECK ("maxAdmins" IS NULL OR "maxAdmins" >= 0);

ALTER TABLE "tournaments"
  ADD CONSTRAINT "tournaments_maxAdmins_nonnegative_chk"
  CHECK ("maxAdmins" IS NULL OR "maxAdmins" >= 0);

CREATE TABLE "tournament_admins" (
  "id" UUID NOT NULL,
  "tournamentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "TournamentAdminRole" NOT NULL DEFAULT 'ADMIN',
  "permissions" "TournamentAdminPermission"[] NOT NULL DEFAULT ARRAY[]::"TournamentAdminPermission"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tournament_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_admins_tournamentId_userId_key"
  ON "tournament_admins"("tournamentId", "userId");

CREATE INDEX "tournament_admins_userId_idx"
  ON "tournament_admins"("userId");

CREATE INDEX "tournament_admins_tournamentId_role_idx"
  ON "tournament_admins"("tournamentId", "role");

ALTER TABLE "tournament_admins"
  ADD CONSTRAINT "tournament_admins_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tournament_admins"
  ADD CONSTRAINT "tournament_admins_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "league_admins"
SET "permissions" = ARRAY[
  'MANAGE_SETTINGS',
  'MANAGE_MEMBERS',
  'MANAGE_FIXTURES',
  'MANAGE_STANDINGS',
  'MANAGE_TOURNAMENTS',
  'VIEW_REPORTS'
]::"LeagueAdminPermission"[];

INSERT INTO "tournament_admins" (
  "id",
  "tournamentId",
  "userId",
  "role",
  "permissions",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  t."id",
  t."createdByUserId",
  'OWNER'::"TournamentAdminRole",
  ARRAY[
    'MANAGE_FIXTURES',
    'MANAGE_RESULTS',
    'VERIFY_SCORES',
    'MANAGE_PARTICIPANTS',
    'MANAGE_SETTINGS',
    'VIEW_REPORTS'
  ]::"TournamentAdminPermission"[],
  t."createdAt"
FROM "tournaments" t
ON CONFLICT ("tournamentId", "userId") DO NOTHING;

INSERT INTO "tournament_admins" (
  "id",
  "tournamentId",
  "userId",
  "role",
  "permissions",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  ra."scopeId"::UUID,
  ra."userId",
  'ADMIN'::"TournamentAdminRole",
  ARRAY[
    'MANAGE_FIXTURES',
    'MANAGE_RESULTS',
    'VERIFY_SCORES',
    'MANAGE_PARTICIPANTS',
    'MANAGE_SETTINGS',
    'VIEW_REPORTS'
  ]::"TournamentAdminPermission"[],
  ra."createdAt"
FROM "role_assignments" ra
JOIN "tournaments" t ON t."id"::text = ra."scopeId"
WHERE ra."role" = 'TOURNAMENT_ADMIN'::"ScopedRole"
  AND ra."scopeType" = 'TOURNAMENT'::"RoleScopeType"
  AND ra."scopeId" ~* '^[0-9a-f-]{36}$'
ON CONFLICT ("tournamentId", "userId") DO NOTHING;

DELETE FROM "role_assignments"
WHERE "role" = 'TOURNAMENT_ADMIN'::"ScopedRole"
  AND "scopeType" = 'TOURNAMENT'::"RoleScopeType"
  AND "scopeId" ~* '^[0-9a-f-]{36}$';
