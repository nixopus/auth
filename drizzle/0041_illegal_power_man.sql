CREATE TYPE "public"."provision_type" AS ENUM('trial', 'managed', 'user_owned');--> statement-breakpoint
DROP INDEX "idx_user_provision_details_user_org_unique";--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN "type" "provision_type" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_provision_details_user_org_trial_unique" ON "user_provision_details" USING btree ("user_id","organization_id") WHERE type = 'trial';