ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "cost_usd" numeric DEFAULT 0;
ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "cached_tokens" integer DEFAULT 0;
ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "reasoning_tokens" integer DEFAULT 0;
ALTER TABLE "ai_usage_logs" ALTER COLUMN "model_tier" DROP NOT NULL;
ALTER TABLE "ai_usage_logs" ALTER COLUMN "credits_consumed" DROP NOT NULL;
ALTER TABLE "ai_usage_logs" ALTER COLUMN "user_id" DROP NOT NULL;
