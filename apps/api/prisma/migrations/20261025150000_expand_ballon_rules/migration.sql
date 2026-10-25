ALTER TABLE "ballon_seasons"
ADD COLUMN "maximum_matches" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN "tournament_requirements" JSONB NOT NULL DEFAULT '{"SOLO":0,"DUO":0,"TEAM":0}';

ALTER TABLE "ballon_seasons"
ALTER COLUMN "minimum_matches" SET DEFAULT 10;
