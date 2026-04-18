ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "server_id" uuid;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "guest_ip" text;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "vcpu_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "memory_mb" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD COLUMN IF NOT EXISTS "disk_size_gb" integer DEFAULT 0 NOT NULL;
