ALTER TABLE "leagues"
  ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "leagues_discoverable_createdAt_idx"
  ON "leagues"("discoverable", "createdAt");
