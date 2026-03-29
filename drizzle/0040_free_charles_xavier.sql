CREATE TABLE "application_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"server_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_servers_unique_app_server" UNIQUE("application_id","server_id")
);
--> statement-breakpoint
ALTER TABLE "application_deployment" ADD COLUMN "server_id" uuid;--> statement-breakpoint
ALTER TABLE "application_deployment" ADD COLUMN "parent_deployment_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "routing_strategy" varchar(20) DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_servers" ADD CONSTRAINT "application_servers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_servers" ADD CONSTRAINT "application_servers_server_id_ssh_keys_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."ssh_keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_servers_one_primary_per_app" ON "application_servers" USING btree ("application_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "idx_application_servers_application_id" ON "application_servers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_application_servers_server_id" ON "application_servers" USING btree ("server_id");--> statement-breakpoint
ALTER TABLE "application_deployment" ADD CONSTRAINT "application_deployment_server_id_ssh_keys_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."ssh_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_deployment" ADD CONSTRAINT "application_deployment_parent_fk" FOREIGN KEY ("parent_deployment_id") REFERENCES "public"."application_deployment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO application_servers (id, application_id, server_id, is_primary, created_at)
SELECT gen_random_uuid(), a.id, sk.id, true, NOW()
FROM applications a
JOIN LATERAL (
  SELECT id FROM ssh_keys
  WHERE organization_id = a.organization_id
    AND deleted_at IS NULL AND is_active = true
  ORDER BY is_default DESC, created_at DESC LIMIT 1
) sk ON true
ON CONFLICT (application_id, server_id) DO NOTHING;
