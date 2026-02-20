ALTER TABLE "extensions" DROP CONSTRAINT IF EXISTS "valid_extension_id";--> statement-breakpoint
ALTER TABLE "extensions" DROP CONSTRAINT IF EXISTS "valid_version";--> statement-breakpoint
ALTER TABLE "extensions" DROP CONSTRAINT IF EXISTS "description_length";--> statement-breakpoint
ALTER TABLE "application_deployment" ADD COLUMN "image_s3_key" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "application_deployment" ADD COLUMN "image_size" bigint DEFAULT 0;