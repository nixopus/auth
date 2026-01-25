-- Fix the valid_version constraint regex pattern
-- The previous pattern used '^d+.d+.d+' which was incorrect (literal 'd' instead of \d for digits)
-- This migration drops and recreates the constraint with the correct pattern using dollar-quoted strings
--> statement-breakpoint
ALTER TABLE "extensions" DROP CONSTRAINT IF EXISTS "valid_version";--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "valid_version" CHECK (version IS NULL OR version ~ $pattern$^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9\\-]+)?$$pattern$);
