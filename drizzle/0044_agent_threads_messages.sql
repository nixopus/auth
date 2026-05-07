-- Create agent_threads if it does not exist (fresh deployments).
-- On existing deployments where the Go API already created the table,
-- this is a no-op and the user_id column is added by the ALTER below.
CREATE TABLE IF NOT EXISTS "agent_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Create agent_messages if it does not exist (fresh deployments).
CREATE TABLE IF NOT EXISTS "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tool_calls" text DEFAULT '[]',
	"tool_call_id" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seq" integer NOT NULL
);
--> statement-breakpoint
-- Add user_id column to agent_threads (existing Go-API tables won't have it).
ALTER TABLE "agent_threads" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
-- Backfill existing threads: assign to the first user available.
-- No-op on fresh deployments where the table is empty.
UPDATE "agent_threads" SET "user_id" = (
  SELECT u.id FROM "user" u LIMIT 1
) WHERE "user_id" IS NULL;
--> statement-breakpoint
-- If backfill could not find a user (e.g. fresh DB with empty user table),
-- delete any orphaned threads so we can enforce NOT NULL.
DELETE FROM "agent_threads" WHERE "user_id" IS NULL;
--> statement-breakpoint
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
-- Clean orphaned messages whose thread no longer exists.
DELETE FROM "agent_messages" WHERE "thread_id" NOT IN (SELECT "id" FROM "agent_threads");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_messages_thread_seq" ON "agent_messages" USING btree ("thread_id","seq");
