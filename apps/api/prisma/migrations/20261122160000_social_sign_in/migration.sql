-- Additive identity links only. Existing accounts and nullable legacy profile
-- fields remain intact; application validation requires complete new profiles.
CREATE TABLE "social_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_identities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "social_identities_provider_check" CHECK ("provider" IN ('google', 'facebook'))
);
CREATE UNIQUE INDEX "social_identities_provider_subject_key" ON "social_identities"("provider", "subject");
CREATE UNIQUE INDEX "social_identities_user_id_provider_key" ON "social_identities"("user_id", "provider");
ALTER TABLE "social_identities" ADD CONSTRAINT "social_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
