CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"credentials" jsonb DEFAULT '{}' NOT NULL,
	"custom_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_org_id" ON "mcp_servers" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mcp_servers_org_name" ON "mcp_servers" USING btree ("org_id","name") WHERE deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
