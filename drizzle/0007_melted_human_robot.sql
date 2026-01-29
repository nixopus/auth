ALTER TABLE "ssh_keys" ADD COLUMN "host" varchar(255);--> statement-breakpoint
ALTER TABLE "ssh_keys" ADD COLUMN "user" varchar(255);--> statement-breakpoint
ALTER TABLE "ssh_keys" ADD COLUMN "port" integer DEFAULT 22;