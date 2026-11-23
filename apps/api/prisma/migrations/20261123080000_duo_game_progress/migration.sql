-- Persist unfinished individual Duo games without creating a verified result.
ALTER TABLE "matches" ADD COLUMN "duoGameProgress" JSONB;
