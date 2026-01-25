CREATE TYPE "public"."execution_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."extension_category" AS ENUM('Security', 'Containers', 'Database', 'Web Server', 'Maintenance', 'Monitoring', 'Storage', 'Network', 'Development', 'Other', 'Media', 'Game', 'Utility', 'Productivity', 'Social');--> statement-breakpoint
CREATE TYPE "public"."extension_type" AS ENUM('install', 'run');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('not_validated', 'valid', 'invalid');--> statement-breakpoint
CREATE TABLE "execution_steps" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"execution_id" uuid NOT NULL,
	"step_name" varchar(200) NOT NULL,
	"phase" varchar(20) NOT NULL,
	"step_order" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"status" "execution_status" DEFAULT 'pending',
	"exit_code" integer,
	"output" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_phase" CHECK (phase IN ('pre_install', 'install', 'post_install', 'run', 'validate'))
);
--> statement-breakpoint
CREATE TABLE "extension_executions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"extension_id" uuid NOT NULL,
	"server_hostname" varchar(255),
	"variable_values" jsonb,
	"status" "execution_status" DEFAULT 'pending',
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"exit_code" integer,
	"error_message" text,
	"execution_log" text,
	"log_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"execution_id" uuid NOT NULL,
	"step_id" uuid,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sequence" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extension_variables" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"extension_id" uuid NOT NULL,
	"variable_name" varchar(100) NOT NULL,
	"variable_type" varchar(20) NOT NULL,
	"description" text,
	"default_value" jsonb,
	"is_required" boolean DEFAULT false,
	"validation_pattern" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_variable_name" CHECK (variable_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'),
	CONSTRAINT "valid_variable_type" CHECK (variable_type IN ('string', 'integer', 'boolean', 'array'))
);
--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"extension_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"author" varchar(50) NOT NULL,
	"icon" varchar(10) NOT NULL,
	"category" "extension_category" NOT NULL,
	"extension_type" "extension_type" DEFAULT 'run' NOT NULL,
	"version" varchar(20),
	"is_verified" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"parent_extension_id" uuid,
	"yaml_content" text NOT NULL,
	"parsed_content" jsonb NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"validation_status" "validation_status" DEFAULT 'not_validated',
	"validation_errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "extensions_extension_id_unique" UNIQUE("extension_id"),
	CONSTRAINT "valid_extension_id" CHECK (extension_id ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
	CONSTRAINT "valid_version" CHECK (version IS NULL OR version ~ '^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?$'),
	CONSTRAINT "description_length" CHECK (LENGTH(description) BETWEEN 10 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_id_extension_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."extension_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_executions" ADD CONSTRAINT "extension_executions_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_logs" ADD CONSTRAINT "extension_logs_execution_id_extension_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."extension_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_logs" ADD CONSTRAINT "extension_logs_step_id_execution_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."execution_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_variables" ADD CONSTRAINT "extension_variables_extension_id_extensions_id_fk" FOREIGN KEY ("extension_id") REFERENCES "public"."extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_parent_extension_id_extensions_id_fk" FOREIGN KEY ("parent_extension_id") REFERENCES "public"."extensions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_execution_steps_execution" ON "execution_steps" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "idx_extension_executions_extension" ON "extension_executions" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "idx_extension_executions_status" ON "extension_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_extension_logs_exec_seq" ON "extension_logs" USING btree ("execution_id","sequence");--> statement-breakpoint
CREATE INDEX "idx_extension_logs_exec_created" ON "extension_logs" USING btree ("execution_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_extension_variables_extension" ON "extension_variables" USING btree ("extension_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_extension_variables_unique" ON "extension_variables" USING btree ("extension_id","variable_name");--> statement-breakpoint
CREATE INDEX "idx_extensions_category" ON "extensions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_extensions_verified" ON "extensions" USING btree ("is_verified");--> statement-breakpoint
CREATE INDEX "idx_extensions_validation_status" ON "extensions" USING btree ("validation_status");--> statement-breakpoint
CREATE INDEX "idx_extensions_created" ON "extensions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_extensions_extension_id" ON "extensions" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "idx_extensions_deleted_at" ON "extensions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_extensions_extension_type" ON "extensions" USING btree ("extension_type");--> statement-breakpoint
CREATE INDEX "idx_extensions_parent_extension_id" ON "extensions" USING btree ("parent_extension_id");--> statement-breakpoint
CREATE INDEX "idx_extensions_featured" ON "extensions" USING btree ("featured");