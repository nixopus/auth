-- agent_schedules is created at runtime by the Go API (bun model in
-- internal/features/agent/service/scheduler/store.go), not by drizzle.
-- On a fresh DB the table does not exist yet, so guard the backfill:
-- tables the API creates from now on already include notify_on.
DO $$ BEGIN
 IF to_regclass('public.agent_schedules') IS NOT NULL THEN
  ALTER TABLE "agent_schedules" ADD COLUMN IF NOT EXISTS "notify_on" text DEFAULT 'smart' NOT NULL;
 END IF;
END $$;
