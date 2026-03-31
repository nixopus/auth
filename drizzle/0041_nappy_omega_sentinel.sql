CREATE TABLE "cli_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"os" varchar(50) DEFAULT 'unknown' NOT NULL,
	"arch" varchar(10) DEFAULT 'unknown' NOT NULL,
	"version" varchar(20) NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"error" varchar(200),
	"ip_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_cli_installations_created_at" ON "cli_installations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cli_installations_ip_hash" ON "cli_installations" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX "idx_cli_installations_event_type" ON "cli_installations" USING btree ("event_type");