ALTER TABLE "apikey" RENAME COLUMN "userId" TO "referenceId";--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "configId" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX "apikey_referenceId_idx" ON "apikey" USING btree ("referenceId");--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "apikey" USING btree ("configId");