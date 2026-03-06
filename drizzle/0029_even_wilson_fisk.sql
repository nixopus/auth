ALTER TABLE "domains" ADD COLUMN "type" varchar(50) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "verification_token" varchar(255);--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dns_provider" varchar(100);--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "target_subdomain" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_domains_type" ON "domains" USING btree ("type");