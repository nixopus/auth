CREATE TYPE "public"."provision_status" AS ENUM('pending', 'initializing', 'creating_container', 'configuring_ssh', 'setting_up_subdomain', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "user_provision_details" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"lxd_container_name" varchar(255),
	"ssh_key_id" uuid,
	"subdomain" varchar(255),
	"status" "provision_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "deviceCode" CASCADE;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD CONSTRAINT "user_provision_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD CONSTRAINT "user_provision_details_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provision_details" ADD CONSTRAINT "user_provision_details_ssh_key_id_ssh_keys_id_fk" FOREIGN KEY ("ssh_key_id") REFERENCES "public"."ssh_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_provision_details_user_id" ON "user_provision_details" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_provision_details_organization_id" ON "user_provision_details" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_provision_details_status" ON "user_provision_details" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_provision_details_ssh_key_id" ON "user_provision_details" USING btree ("ssh_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_provision_details_user_org_unique" ON "user_provision_details" USING btree ("user_id","organization_id");