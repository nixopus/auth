ALTER TABLE "ssh_keys" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "ssh_keys" SET "is_default" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("organization_id") "id"
  FROM "ssh_keys"
  WHERE "deleted_at" IS NULL AND "is_active" = true
  ORDER BY "organization_id", "created_at" DESC, "id" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "ssh_keys_one_default_per_org" ON "ssh_keys" USING btree ("organization_id") WHERE is_default = true AND deleted_at IS NULL;
