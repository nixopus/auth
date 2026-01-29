CREATE TABLE "ssh_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"public_key" text,
	"private_key_encrypted" text,
	"password_encrypted" text,
	"key_type" varchar(20) DEFAULT 'rsa',
	"key_size" integer DEFAULT 4096,
	"fingerprint" varchar(255),
	"auth_method" varchar(20) DEFAULT 'key' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ssh_keys" ADD CONSTRAINT "ssh_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ssh_keys_organization_id" ON "ssh_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_ssh_keys_is_active" ON "ssh_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ssh_keys_fingerprint" ON "ssh_keys" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_ssh_keys_deleted_at" ON "ssh_keys" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_ssh_keys_auth_method" ON "ssh_keys" USING btree ("auth_method");