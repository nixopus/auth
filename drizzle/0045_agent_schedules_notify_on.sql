ALTER TABLE "agent_schedules" ADD COLUMN IF NOT EXISTS "notify_on" text DEFAULT 'smart' NOT NULL;
