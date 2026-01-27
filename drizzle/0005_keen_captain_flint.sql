-- valid_version constraint regex pattern for version strings like '1.2.3' or '1.2.3-alpha'
ALTER TABLE "extensions" DROP CONSTRAINT IF EXISTS "valid_version";--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "valid_version" CHECK (version IS NULL OR version ~ $pattern$^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9\\-]+)?$$pattern$);