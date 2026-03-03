CREATE TABLE "compose_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"port" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_domains" ADD COLUMN "compose_service_id" uuid;--> statement-breakpoint
ALTER TABLE "application_domains" ADD COLUMN "port" integer;--> statement-breakpoint
ALTER TABLE "compose_services" ADD CONSTRAINT "compose_services_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_compose_services_application_id" ON "compose_services" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_compose_services_app_service_unique" ON "compose_services" USING btree ("application_id","service_name");--> statement-breakpoint
ALTER TABLE "application_domains" ADD CONSTRAINT "application_domains_compose_service_id_compose_services_id_fk" FOREIGN KEY ("compose_service_id") REFERENCES "public"."compose_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_application_domains_compose_service_id" ON "application_domains" USING btree ("compose_service_id");