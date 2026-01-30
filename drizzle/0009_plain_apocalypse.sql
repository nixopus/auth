CREATE TABLE "deviceCode" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"deviceCode" text NOT NULL,
	"userCode" text NOT NULL,
	"userId" uuid,
	"clientId" text,
	"scope" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"lastPolledAt" timestamp,
	"pollingInterval" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deviceCode_deviceCode_unique" UNIQUE("deviceCode"),
	CONSTRAINT "deviceCode_userCode_unique" UNIQUE("userCode")
);
--> statement-breakpoint
ALTER TABLE "deviceCode" ADD CONSTRAINT "deviceCode_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deviceCode_deviceCode_idx" ON "deviceCode" USING btree ("deviceCode");--> statement-breakpoint
CREATE INDEX "deviceCode_userCode_idx" ON "deviceCode" USING btree ("userCode");--> statement-breakpoint
CREATE INDEX "deviceCode_userId_idx" ON "deviceCode" USING btree ("userId");