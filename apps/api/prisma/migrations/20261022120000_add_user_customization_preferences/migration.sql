-- Additive user customization preferences. NULL means the safe default set is active.
ALTER TABLE "users" ADD COLUMN "notificationPreferences" JSONB;
ALTER TABLE "users" ADD COLUMN "dashboardPreferences" JSONB;
