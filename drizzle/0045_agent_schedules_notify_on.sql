DO $$ BEGIN
  IF to_regclass('public.agent_schedules') IS NOT NULL THEN
    ALTER TABLE "agent_schedules" ADD COLUMN IF NOT EXISTS "notify_on" text DEFAULT 'smart' NOT NULL;
  END IF;
END $$;