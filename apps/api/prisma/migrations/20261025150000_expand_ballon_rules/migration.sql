ALTER TABLE "ballon_seasons"
ADD COLUMN "maximumMatches" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN "tournamentRequirements" JSONB NOT NULL DEFAULT '{"SOLO":0,"DUO":0,"TEAM":0}';

ALTER TABLE "ballon_seasons"
ALTER COLUMN "minimumMatches" SET DEFAULT 10;
