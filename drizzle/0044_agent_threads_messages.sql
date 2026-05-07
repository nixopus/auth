-- Add user_id column to existing agent_threads table (created by Go API)
-- For existing rows, we set a placeholder that must be backfilled
ALTER TABLE "agent_threads" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
-- Backfill existing threads: assign to the first user in the org from metadata
UPDATE "agent_threads" SET "user_id" = (
  SELECT u.id FROM "user" u LIMIT 1
) WHERE "user_id" IS NULL;
--> statement-breakpoint
-- Now make it NOT NULL
ALTER TABLE "agent_threads" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_threads_user" ON "agent_threads" USING btree ("user_id");
--> statement-breakpoint
-- Clean orphaned messages whose thread no longer exists
DELETE FROM "agent_messages" WHERE "thread_id" NOT IN (SELECT "id" FROM "agent_threads");
--> statement-breakpoint
-- Ensure agent_messages has FK to agent_threads
DO $$ BEGIN
 ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_messages_thread_seq" ON "agent_messages" USING btree ("thread_id","seq");
