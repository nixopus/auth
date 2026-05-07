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
CREATE TABLE IF NOT EXISTS "agent_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_threads" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
UPDATE "agent_threads" SET "user_id" = (
  SELECT u.id FROM "user" u LIMIT 1
) WHERE "user_id" IS NULL;
--> statement-breakpoint
DELETE FROM "agent_threads" WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "agent_threads" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_thread_id_agent_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_messages_thread_seq" ON "agent_messages" USING btree ("thread_id","seq");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_threads_user" ON "agent_threads" USING btree ("user_id");
