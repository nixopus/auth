CREATE TABLE "application_file_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"path" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"content" text NOT NULL,
	"chunk_hash" varchar(64) NOT NULL,
	"language" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_file_chunks" ADD CONSTRAINT "application_file_chunks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_application_file_chunks_app_path" ON "application_file_chunks" USING btree ("application_id","path");--> statement-breakpoint
CREATE INDEX "idx_application_file_chunks_app_id" ON "application_file_chunks" USING btree ("application_id");