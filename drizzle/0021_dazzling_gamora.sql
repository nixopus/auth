DO $$ BEGIN
  CREATE TYPE "public"."provision_step" AS ENUM('INITIALIZING', 'CREATING_CONTAINER', 'SETUP_NETWORKING', 'INSTALLING_DEPENDENCIES', 'CONFIGURING_SSH', 'SETUP_SSH_FORWARDING', 'VERIFYING_SSH', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_provision_details_status";--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "step" "provision_step";--> statement-breakpoint
ALTER TABLE "user_provision_details" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
DO $$ BEGIN
  DROP TYPE IF EXISTS "public"."provision_status";
EXCEPTION WHEN SQLSTATE '2BP01' THEN
  NULL;
END $$;