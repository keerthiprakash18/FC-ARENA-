-- Privacy by default. Existing players must explicitly opt in before contact is available.
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "whatsappNumber" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "whatsappShareEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
