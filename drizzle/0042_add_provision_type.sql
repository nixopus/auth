CREATE TYPE "provision_type" AS ENUM ('trial', 'managed', 'user_owned');--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN "type" "provision_type" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_provision_details_user_org_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_provision_details_user_org_trial_unique" ON "user_provision_details" ("user_id", "organization_id") WHERE type = 'trial';
