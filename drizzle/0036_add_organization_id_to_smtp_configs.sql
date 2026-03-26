ALTER TABLE "smtp_configs" ADD COLUMN "organization_id" uuid NOT NULL REFERENCES "public"."organization"("id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "idx_smtp_configs_organization_id" ON "smtp_configs" USING btree ("organization_id");
