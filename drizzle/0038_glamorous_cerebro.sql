CREATE TYPE "public"."machine_backup_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "machine_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"provision_id" uuid,
	"machine_name" varchar(255) NOT NULL,
	"status" "machine_backup_status" DEFAULT 'pending' NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"snapshot_path" text,
	"s3_path" text,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machine_backups" ADD CONSTRAINT "machine_backups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_backups" ADD CONSTRAINT "machine_backups_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_backups" ADD CONSTRAINT "machine_backups_provision_id_user_provision_details_id_fk" FOREIGN KEY ("provision_id") REFERENCES "public"."user_provision_details"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_machine_backups_user_id" ON "machine_backups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_machine_backups_organization_id" ON "machine_backups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_machine_backups_provision_id" ON "machine_backups" USING btree ("provision_id");--> statement-breakpoint
CREATE INDEX "idx_machine_backups_machine_name" ON "machine_backups" USING btree ("machine_name");--> statement-breakpoint
CREATE INDEX "idx_machine_backups_status" ON "machine_backups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_machine_backups_created_at" ON "machine_backups" USING btree ("created_at");
