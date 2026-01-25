import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  uniqueIndex,
  varchar,
  integer,
  jsonb,
  pgEnum,
  check,
  bigint,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);

export const member = pgTable(
  "member",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

// Migration 018: api_keys table
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),
    prefix: varchar("prefix", { length: 20 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_api_keys_user_id").on(table.userId),
    index("idx_api_keys_organization_id").on(table.organizationId),
    index("idx_api_keys_key_hash").on(table.keyHash),
    index("idx_api_keys_prefix").on(table.prefix),
  ],
);

// Enums
export const environmentEnum = pgEnum("environment", [
  "development",
  "staging",
  "production",
]);

export const buildPackEnum = pgEnum("build_pack", [
  "dockerfile",
  "docker-compose",
  "static",
]);

export const statusEnum = pgEnum("status", [
  "draft",
  "started",
  "running",
  "stopped",
  "failed",
  "cloning",
  "building",
  "deploying",
  "deployed",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "access",
]);

export const auditResourceTypeEnum = pgEnum("audit_resource_type", [
  "user",
  "organization",
  "role",
  "permission",
  "application",
  "deployment",
  "domain",
  "github_connector",
  "smtp_config",
]);


// Domains
export const domains = pgTable(
  "domains",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_domains_user_id").on(table.userId),
    index("idx_domains_name").on(table.name),
    uniqueIndex("idx_domains_name_unique").on(table.name),
  ],
);

// Applications
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    port: integer("port").notNull(),
    environment: environmentEnum("environment").notNull(),
    proxyServer: varchar("proxy_server", { length: 50 })
      .default("caddy")
      .notNull(),
    buildVariables: text("build_variables").notNull(),
    environmentVariables: text("environment_variables").notNull(),
    buildPack: buildPackEnum("build_pack").notNull(),
    repository: text("repository").notNull(),
    branch: text("branch").notNull(),
    preRunCommand: text("pre_run_command").notNull(),
    postRunCommand: text("post_run_command").notNull(),
    dockerfilePath: text("dockerfile_path").default("Dockerfile").notNull(),
    basePath: text("base_path").default("/").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    familyId: uuid("family_id"),
    labels: text("labels").array(),
    isLiveDeployment: boolean("is_live_deployment").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_applications_domain_id").on(table.organizationId),
    index("idx_applications_user_id").on(table.userId),
  ],
);

export const applicationStatus = pgTable(
  "application_status",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    status: statusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_status_application_id").on(table.applicationId),
  ],
);

export const applicationDeployment = pgTable(
  "application_deployment",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    commitHash: text("commit_hash"),
    containerId: text("container_id"),
    containerName: text("container_name"),
    containerImage: text("container_image"),
    containerStatus: text("container_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_deployment_application_id").on(
      table.applicationId,
    ),
  ],
);

export const applicationDeploymentStatus = pgTable(
  "application_deployment_status",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    applicationDeploymentId: uuid("application_deployment_id")
      .notNull()
      .references(() => applicationDeployment.id, { onDelete: "cascade" }),
    status: statusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_deployment_status_deployment_id").on(
      table.applicationDeploymentId,
    ),
  ],
);

export const applicationLogs = pgTable(
  "application_logs",
  {
    id: uuid("id").primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    applicationDeploymentId: uuid("application_deployment_id").references(
      () => applicationDeployment.id,
      { onDelete: "set null" },
    ),
    log: text("log").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_logs_application_id").on(table.applicationId),
    index("idx_application_logs_deployment_id").on(
      table.applicationDeploymentId,
    ),
  ],
);

export const applicationDomains = pgTable(
  "application_domains",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_domains_application_id").on(table.applicationId),
    uniqueIndex("idx_application_domains_domain_unique").on(table.domain),
    uniqueIndex("idx_application_domains_unique").on(
      table.applicationId,
      table.domain,
    ),
  ],
);

// Audit logs
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id").references(() => user.id),
    organizationId: uuid("organization_id").references(() => organization.id),
    action: auditActionEnum("action").notNull(),
    resourceType: auditResourceTypeEnum("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: uuid("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_user_id").on(table.userId),
    index("idx_audit_logs_org_id").on(table.organizationId),
    index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_logs_created_at").on(table.createdAt),
    index("idx_audit_logs_request_id").on(table.requestId),
  ],
);

// GitHub connectors
export const githubConnectors = pgTable(
  "github_connectors",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    appId: varchar("app_id", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    pem: text("pem").notNull(),
    clientId: varchar("client_id", { length: 255 }).notNull(),
    clientSecret: varchar("client_secret", { length: 255 }).notNull(),
    webhookSecret: varchar("webhook_secret", { length: 255 }).notNull(),
    installationId: varchar("installation_id", { length: 255 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_github_connectors_user_id").on(table.userId),
    index("idx_github_connectors_slug").on(table.slug),
    index("idx_github_connectors_app_id").on(table.appId),
  ],
);

// Notification preferences
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_notification_preferences_user_id").on(table.userId)],
);

export const preferenceItem = pgTable(
  "preference_item",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    preferenceId: uuid("preference_id")
      .notNull()
      .references(() => notificationPreferences.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 50 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_preference_item_preference_id").on(table.preferenceId),
    index("idx_preference_item_category").on(table.category),
    index("idx_preference_item_type").on(table.type),
  ],
);

export const smtpConfigs = pgTable(
  "smtp_configs",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    host: varchar("host", { length: 255 }).notNull(),
    port: integer("port").notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    fromName: varchar("from_name", { length: 255 }).notNull(),
    security: varchar("security", { length: 50 }).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_smtp_configs_user_id").on(table.userId),
    index("idx_smtp_configs_is_active").on(table.isActive),
  ],
);

export const webhookConfigs = pgTable(
  "webhook_configs",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    type: varchar("type", { length: 50 }).notNull(),
    webhookUrl: text("webhook_url").notNull(),
    channelId: varchar("channel_id", { length: 100 }).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    webhookSecret: text("webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_webhook_configs_user_id").on(table.userId),
    index("idx_webhook_configs_organization_id").on(table.organizationId),
    index("idx_webhook_configs_type").on(table.type),
  ],
);

// Live deploy sessions
export const liveDeploySessions = pgTable("live_deploy_sessions", {
  id: uuid("id").primaryKey(),
  applicationId: uuid("application_id").references(() => applications.id),
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),
  status: varchar("status", { length: 50 }),
  clientIp: varchar("client_ip", { length: 50 }),
  startedAt: timestamp("started_at"),
  lastSyncAt: timestamp("last_sync_at"),
  config: jsonb("config"),
  domain: text("domain"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Feature flags
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    featureName: varchar("feature_name", { length: 50 }).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_feature_flags_organization_id").on(table.organizationId),
    index("idx_feature_flags_feature_name").on(table.featureName),
    uniqueIndex("idx_feature_flags_unique").on(
      table.organizationId,
      table.featureName,
    ),
  ],
);

// Health checks
export const healthChecks = pgTable(
  "health_checks",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    endpoint: text("endpoint").default("/").notNull(),
    method: text("method").default("GET").notNull(),
    expectedStatusCodes: integer("expected_status_codes").array().default([200]).notNull(),
    timeoutSeconds: integer("timeout_seconds").default(30).notNull(),
    intervalSeconds: integer("interval_seconds").default(60).notNull(),
    failureThreshold: integer("failure_threshold").default(3).notNull(),
    successThreshold: integer("success_threshold").default(1).notNull(),
    headers: jsonb("headers").default("{}"),
    body: text("body"),
    consecutiveFails: integer("consecutive_fails").default(0).notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    retentionDays: integer("retention_days").default(30).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_health_checks_application_id").on(table.applicationId),
    index("idx_health_checks_organization_id").on(table.organizationId),
    index("idx_health_checks_enabled").on(table.enabled),
    index("idx_health_checks_last_checked_at").on(table.lastCheckedAt),
    uniqueIndex("idx_health_checks_application_unique").on(table.applicationId),
  ],
);

export const healthCheckResults = pgTable(
  "health_check_results",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    healthCheckId: uuid("health_check_id")
      .notNull()
      .references(() => healthChecks.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    responseTimeMs: integer("response_time_ms"),
    statusCode: integer("status_code"),
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_health_check_results_health_check_id").on(table.healthCheckId),
    index("idx_health_check_results_checked_at").on(table.checkedAt),
  ],
);

// User settings and preferences
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fontFamily: varchar("font_family", { length: 50 })
      .default("system")
      .notNull(),
    fontSize: integer("font_size").default(14).notNull(),
    theme: varchar("theme", { length: 20 }).default("light").notNull(),
    language: varchar("language", { length: 10 }).default("en").notNull(),
    autoUpdate: boolean("auto_update").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_user_settings_user_id").on(table.userId),
    uniqueIndex("idx_user_settings_user_unique").on(table.userId),
  ],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    preferences: jsonb("preferences").default("{}").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_user_preferences_user_id").on(table.userId),
    uniqueIndex("idx_user_preferences_user_unique").on(table.userId),
  ],
);

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    settings: jsonb("settings")
      .default(
        sql`'{"websocket_reconnect_attempts": 5, "websocket_reconnect_interval": 3000, "api_retry_attempts": 1, "disable_api_cache": false}'::jsonb`,
      )
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_organization_settings_org_id").on(table.organizationId),
    uniqueIndex("idx_organization_settings_org_unique").on(
      table.organizationId,
    ),
  ],
);

// Relations
export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
  apiKeys: many(apiKeys),
  domains: many(domains),
  applications: many(applications),
  auditLogs: many(auditLogs),
  githubConnectors: many(githubConnectors),
  notificationPreferences: many(notificationPreferences),
  smtpConfigs: many(smtpConfigs),
  webhookConfigs: many(webhookConfigs),
  liveDeploySessions: many(liveDeploySessions),
  userSettings: one(userSettings, {
    fields: [user.id],
    references: [userSettings.userId],
  }),
  userPreferences: one(userPreferences, {
    fields: [user.id],
    references: [userPreferences.userId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  applications: many(applications),
  webhookConfigs: many(webhookConfigs),
  liveDeploySessions: many(liveDeploySessions),
  featureFlags: many(featureFlags),
  organizationSettings: many(organizationSettings),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(user, {
    fields: [apiKeys.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [apiKeys.organizationId],
    references: [organization.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  user: one(user, {
    fields: [domains.userId],
    references: [user.id],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(user, {
    fields: [applications.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [applications.organizationId],
    references: [organization.id],
  }),
  status: one(applicationStatus, {
    fields: [applications.id],
    references: [applicationStatus.applicationId],
  }),
  logs: many(applicationLogs),
  deployments: many(applicationDeployment),
  domains: many(applicationDomains),
  healthChecks: many(healthChecks),
  liveDeploySessions: many(liveDeploySessions),
}));

export const applicationStatusRelations = relations(
  applicationStatus,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationStatus.applicationId],
      references: [applications.id],
    }),
  }),
);

export const applicationDeploymentRelations = relations(
  applicationDeployment,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [applicationDeployment.applicationId],
      references: [applications.id],
    }),
    status: one(applicationDeploymentStatus, {
      fields: [applicationDeployment.id],
      references: [applicationDeploymentStatus.applicationDeploymentId],
    }),
    logs: many(applicationLogs),
  }),
);

export const applicationDeploymentStatusRelations = relations(
  applicationDeploymentStatus,
  ({ one }) => ({
    deployment: one(applicationDeployment, {
      fields: [applicationDeploymentStatus.applicationDeploymentId],
      references: [applicationDeployment.id],
    }),
  }),
);

export const applicationLogsRelations = relations(
  applicationLogs,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationLogs.applicationId],
      references: [applications.id],
    }),
    deployment: one(applicationDeployment, {
      fields: [applicationLogs.applicationDeploymentId],
      references: [applicationDeployment.id],
    }),
  }),
);

export const applicationDomainsRelations = relations(
  applicationDomains,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationDomains.applicationId],
      references: [applications.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(user, {
    fields: [auditLogs.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [auditLogs.organizationId],
    references: [organization.id],
  }),
}));

export const githubConnectorsRelations = relations(
  githubConnectors,
  ({ one }) => ({
    user: one(user, {
      fields: [githubConnectors.userId],
      references: [user.id],
    }),
  }),
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one, many }) => ({
    user: one(user, {
      fields: [notificationPreferences.userId],
      references: [user.id],
    }),
    preferenceItems: many(preferenceItem),
  }),
);

export const preferenceItemRelations = relations(preferenceItem, ({ one }) => ({
  preference: one(notificationPreferences, {
    fields: [preferenceItem.preferenceId],
    references: [notificationPreferences.id],
  }),
}));

export const smtpConfigsRelations = relations(smtpConfigs, ({ one }) => ({
  user: one(user, {
    fields: [smtpConfigs.userId],
    references: [user.id],
  }),
}));

export const webhookConfigsRelations = relations(webhookConfigs, ({ one }) => ({
  user: one(user, {
    fields: [webhookConfigs.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [webhookConfigs.organizationId],
    references: [organization.id],
  }),
}));

export const liveDeploySessionsRelations = relations(
  liveDeploySessions,
  ({ one }) => ({
    application: one(applications, {
      fields: [liveDeploySessions.applicationId],
      references: [applications.id],
    }),
    user: one(user, {
      fields: [liveDeploySessions.userId],
      references: [user.id],
    }),
    organization: one(organization, {
      fields: [liveDeploySessions.organizationId],
      references: [organization.id],
    }),
  }),
);

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  organization: one(organization, {
    fields: [featureFlags.organizationId],
    references: [organization.id],
  }),
}));

export const healthChecksRelations = relations(healthChecks, ({ one, many }) => ({
  application: one(applications, {
    fields: [healthChecks.applicationId],
    references: [applications.id],
  }),
  results: many(healthCheckResults),
}));

export const healthCheckResultsRelations = relations(
  healthCheckResults,
  ({ one }) => ({
    healthCheck: one(healthChecks, {
      fields: [healthCheckResults.healthCheckId],
      references: [healthChecks.id],
    }),
  }),
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [userPreferences.userId],
      references: [user.id],
    }),
  }),
);

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationSettings.organizationId],
      references: [organization.id],
    }),
  }),
);

// ============================================
// Billing Tables
// ============================================

// Subscription status enum
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
]);

// Invoice status enum
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

// Billing accounts - links organizations to Stripe customers
export const billingAccounts = pgTable(
  "billing_accounts",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    freeDeploymentsLimit: integer("free_deployments_limit").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_billing_accounts_organization_id").on(table.organizationId),
    index("idx_billing_accounts_stripe_customer_id").on(table.stripeCustomerId),
    uniqueIndex("idx_billing_accounts_org_unique").on(table.organizationId),
  ],
);

// Subscriptions - tracks Stripe subscription state
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    billingAccountId: uuid("billing_account_id")
      .notNull()
      .references(() => billingAccounts.id, { onDelete: "cascade" }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).notNull().unique(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_subscriptions_billing_account_id").on(table.billingAccountId),
    index("idx_subscriptions_stripe_subscription_id").on(table.stripeSubscriptionId),
    index("idx_subscriptions_status").on(table.status),
  ],
);

// Invoices - stores invoice records from Stripe
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    billingAccountId: uuid("billing_account_id")
      .notNull()
      .references(() => billingAccounts.id, { onDelete: "cascade" }),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }).notNull().unique(),
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").notNull(),
    currency: varchar("currency", { length: 10 }).notNull(),
    status: invoiceStatusEnum("status").notNull(),
    invoiceUrl: text("invoice_url"),
    invoicePdf: text("invoice_pdf"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_invoices_billing_account_id").on(table.billingAccountId),
    index("idx_invoices_stripe_invoice_id").on(table.stripeInvoiceId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_created_at").on(table.createdAt),
  ],
);

// Payment events - idempotent webhook event log
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    payload: jsonb("payload"),
  },
  (table) => [
    index("idx_payment_events_stripe_event_id").on(table.stripeEventId),
    index("idx_payment_events_event_type").on(table.eventType),
    index("idx_payment_events_processed_at").on(table.processedAt),
  ],
);

// Billing relations
export const billingAccountsRelations = relations(billingAccounts, ({ one, many }) => ({
  organization: one(organization, {
    fields: [billingAccounts.organizationId],
    references: [organization.id],
  }),
  subscriptions: many(subscriptions),
  invoices: many(invoices),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  billingAccount: one(billingAccounts, {
    fields: [subscriptions.billingAccountId],
    references: [billingAccounts.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  billingAccount: one(billingAccounts, {
    fields: [invoices.billingAccountId],
    references: [billingAccounts.id],
  }),
}));

// Extension enums
export const extensionCategoryEnum = pgEnum("extension_category", [
  "Security",
  "Containers",
  "Database",
  "Web Server",
  "Maintenance",
  "Monitoring",
  "Storage",
  "Network",
  "Development",
  "Other",
  "Media",
  "Game",
  "Utility",
  "Productivity",
  "Social",
]);

export const validationStatusEnum = pgEnum("validation_status", [
  "not_validated",
  "valid",
  "invalid",
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const extensionTypeEnum = pgEnum("extension_type", ["install", "run"]);

// Extensions table
export const extensions = pgTable(
  "extensions",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    extensionId: varchar("extension_id", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    author: varchar("author", { length: 50 }).notNull(),
    icon: varchar("icon", { length: 10 }).notNull(),
    category: extensionCategoryEnum("category").notNull(),
    extensionType: extensionTypeEnum("extension_type")
      .default("run")
      .notNull(),
    version: varchar("version", { length: 20 }),
    isVerified: boolean("is_verified").default(false).notNull(),
    featured: boolean("featured").default(false).notNull(),
    parentExtensionId: uuid("parent_extension_id").references(
      () => extensions.id,
      { onDelete: "set null" },
    ),
    yamlContent: text("yaml_content").notNull(),
    parsedContent: jsonb("parsed_content").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    validationStatus: validationStatusEnum("validation_status").default(
      "not_validated",
    ),
    validationErrors: jsonb("validation_errors"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_extensions_category").on(table.category),
    index("idx_extensions_verified").on(table.isVerified),
    index("idx_extensions_validation_status").on(table.validationStatus),
    index("idx_extensions_created").on(table.createdAt),
    index("idx_extensions_extension_id").on(table.extensionId),
    index("idx_extensions_deleted_at").on(table.deletedAt),
    index("idx_extensions_extension_type").on(table.extensionType),
    index("idx_extensions_parent_extension_id").on(table.parentExtensionId),
    index("idx_extensions_featured").on(table.featured),
    check("valid_extension_id", sql`extension_id ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'`),
    check(
      "valid_version",
      sql`version IS NULL OR version ~ '^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?$'`,
    ),
    check(
      "description_length",
      sql`LENGTH(description) BETWEEN 10 AND 2000`,
    ),
  ],
);

// Extension variables table
export const extensionVariables = pgTable(
  "extension_variables",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    extensionId: uuid("extension_id")
      .notNull()
      .references(() => extensions.id, { onDelete: "cascade" }),
    variableName: varchar("variable_name", { length: 100 }).notNull(),
    variableType: varchar("variable_type", { length: 20 }).notNull(),
    description: text("description"),
    defaultValue: jsonb("default_value"),
    isRequired: boolean("is_required").default(false),
    validationPattern: varchar("validation_pattern", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_extension_variables_extension").on(table.extensionId),
    uniqueIndex("idx_extension_variables_unique").on(
      table.extensionId,
      table.variableName,
    ),
    check(
      "valid_variable_name",
      sql`variable_name ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'`,
    ),
    check(
      "valid_variable_type",
      sql`variable_type IN ('string', 'integer', 'boolean', 'array')`,
    ),
  ],
);

// Extension executions table
export const extensionExecutions = pgTable(
  "extension_executions",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    extensionId: uuid("extension_id")
      .notNull()
      .references(() => extensions.id, { onDelete: "cascade" }),
    serverHostname: varchar("server_hostname", { length: 255 }),
    variableValues: jsonb("variable_values"),
    status: executionStatusEnum("status").default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    exitCode: integer("exit_code"),
    errorMessage: text("error_message"),
    executionLog: text("execution_log"),
    logSeq: bigint("log_seq", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_extension_executions_extension").on(table.extensionId),
    index("idx_extension_executions_status").on(table.status),
  ],
);

// Execution steps table
export const executionSteps = pgTable(
  "execution_steps",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => extensionExecutions.id, { onDelete: "cascade" }),
    stepName: varchar("step_name", { length: 200 }).notNull(),
    phase: varchar("phase", { length: 20 }).notNull(),
    stepOrder: integer("step_order").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: executionStatusEnum("status").default("pending"),
    exitCode: integer("exit_code"),
    output: text("output"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_execution_steps_execution").on(table.executionId),
    check(
      "valid_phase",
      sql`phase IN ('pre_install', 'install', 'post_install', 'run', 'validate')`,
    ),
  ],
);

// Extension logs table
export const extensionLogs = pgTable(
  "extension_logs",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => extensionExecutions.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => executionSteps.id, {
      onDelete: "set null",
    }),
    level: text("level").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").default(sql`'{}'::jsonb`).notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_extension_logs_exec_seq").on(table.executionId, table.sequence),
    index("idx_extension_logs_exec_created").on(
      table.executionId,
      table.createdAt,
    ),
  ],
);

// Extension relations
export const extensionsRelations = relations(extensions, ({ one, many }) => ({
  parentExtension: one(extensions, {
    fields: [extensions.parentExtensionId],
    references: [extensions.id],
    relationName: "parent",
  }),
  childExtensions: many(extensions, {
    relationName: "parent",
  }),
  variables: many(extensionVariables),
  executions: many(extensionExecutions),
}));

export const extensionVariablesRelations = relations(
  extensionVariables,
  ({ one }) => ({
    extension: one(extensions, {
      fields: [extensionVariables.extensionId],
      references: [extensions.id],
    }),
  }),
);

export const extensionExecutionsRelations = relations(
  extensionExecutions,
  ({ one, many }) => ({
    extension: one(extensions, {
      fields: [extensionExecutions.extensionId],
      references: [extensions.id],
    }),
    steps: many(executionSteps),
    logs: many(extensionLogs),
  }),
);

export const executionStepsRelations = relations(
  executionSteps,
  ({ one, many }) => ({
    execution: one(extensionExecutions, {
      fields: [executionSteps.executionId],
      references: [extensionExecutions.id],
    }),
    logs: many(extensionLogs),
  }),
);

export const extensionLogsRelations = relations(extensionLogs, ({ one }) => ({
  execution: one(extensionExecutions, {
    fields: [extensionLogs.executionId],
    references: [extensionExecutions.id],
  }),
  step: one(executionSteps, {
    fields: [extensionLogs.stepId],
    references: [executionSteps.id],
  }),
}));
