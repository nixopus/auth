CREATE TABLE "application_context" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"root_hash" text,
	"paths" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_context" ADD CONSTRAINT "application_context_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;