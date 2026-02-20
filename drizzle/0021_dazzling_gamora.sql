CREATE TYPE "public"."provision_step" AS ENUM('INITIALIZING', 'CREATING_CONTAINER', 'SETUP_NETWORKING', 'INSTALLING_DEPENDENCIES', 'CONFIGURING_SSH', 'SETUP_SSH_FORWARDING', 'VERIFYING_SSH', 'COMPLETED');--> statement-breakpoint
DROP INDEX "idx_user_provision_details_status";--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN "step" "provision_step";--> statement-breakpoint
ALTER TABLE "user_provision_details" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."provision_status";