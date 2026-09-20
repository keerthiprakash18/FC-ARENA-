-- Add per-user FC ARENA visual theme preference.
CREATE TYPE "ThemePreference" AS ENUM ('LUXURY_GOLD', 'CLASSIC_BLUE');

ALTER TABLE "users"
ADD COLUMN "themePreference" "ThemePreference" NOT NULL DEFAULT 'CLASSIC_BLUE';
