CREATE TYPE "public"."machine_billing_status" AS ENUM('active', 'grace_period', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "machine_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"ram_mb" integer NOT NULL,
	"vcpu" integer NOT NULL,
	"storage_mb" integer NOT NULL,
	"monthly_cost_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_plans_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "org_machine_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ssh_key_id" uuid,
	"machine_plan_id" uuid NOT NULL,
	"status" "machine_billing_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"grace_deadline" timestamp with time zone,
	"last_charged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_machine_billing" ADD CONSTRAINT "org_machine_billing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_machine_billing" ADD CONSTRAINT "org_machine_billing_ssh_key_id_ssh_keys_id_fk" FOREIGN KEY ("ssh_key_id") REFERENCES "public"."ssh_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_machine_billing" ADD CONSTRAINT "org_machine_billing_machine_plan_id_machine_plans_id_fk" FOREIGN KEY ("machine_plan_id") REFERENCES "public"."machine_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_machine_billing_org" ON "org_machine_billing" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_machine_billing_status" ON "org_machine_billing" USING btree ("status");--> statement-breakpoint
INSERT INTO "machine_plans" ("tier", "name", "ram_mb", "vcpu", "storage_mb", "monthly_cost_cents")
VALUES
  ('machine_1', 'Machine 1', 4096, 1, 61440, 900),
  ('machine_2', 'Machine 2', 16384, 4, 256000, 3900),
  ('machine_3', 'Machine 3', 57344, 6, 512000, 9900),
  ('machine_4', 'Machine 4', 114688, 12, 1536000, 19900)
ON CONFLICT ("tier") DO NOTHING;