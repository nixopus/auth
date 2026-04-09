import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  uniqueIndex,
  unique,
  foreignKey,
  varchar,
  integer,
  jsonb,
  pgEnum,
  check,
  bigint,
  numeric,
} from "drizzle-orm/pg-core";

/** User provisioning state: one-time LXD provision per user */
export const provisionStatusUserEnum = pgEnum("provision_status_user", [
  "NOT_STARTED",
  "PROVISIONING",
  "ACTIVE",
  "FAILED",
]);

/** Granular provisioning step for progress tracking */
export const provisionStepEnum = pgEnum("provision_step", [
  "INITIALIZING",
  "CREATING_CONTAINER",
  "SETUP_NETWORKING",
  "INSTALLING_DEPENDENCIES",
  "CONFIGURING_SSH",
  "SETUP_SSH_FORWARDING",
  "VERIFYING_SSH",
  "COMPLETED",
]);

export const provisionTypeEnum = pgEnum("provision_type", [
  "trial",
  "managed",
  "user_owned",
]);

export const user = pgTable("user", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  isOnboarded: boolean("is_onboarded").default(false).notNull(),
  provisionStatus: provisionStatusUserEnum("provision_status").default("NOT_STARTED"),
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

export const deviceCode = pgTable(
  "deviceCode",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    deviceCode: text("deviceCode").notNull().unique(),
    userCode: text("userCode").notNull().unique(),
    userId: uuid("userId").references(() => user.id, { onDelete: "cascade" }),
    clientId: text("clientId"),
    scope: text("scope"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastPolledAt: timestamp("lastPolledAt"),
    pollingInterval: integer("pollingInterval"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("deviceCode_deviceCode_idx").on(table.deviceCode),
    index("deviceCode_userCode_idx").on(table.userCode),
    index("deviceCode_userId_idx").on(table.userId),
  ],
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

export const jwks = pgTable("jwks", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
});

export const oauthClient = pgTable("oauth_client", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: boolean("disabled").default(false),
  skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"),
  subjectType: text("subject_type"),
  scopes: text("scopes").array(),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts").array(),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris").array().notNull(),
  postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  grantTypes: text("grant_types").array(),
  responseTypes: text("response_types").array(),
  public: boolean("public"),
  type: text("type"),
  requirePKCE: boolean("require_pkce"),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata"),
});

export const oauthRefreshToken = pgTable("oauth_refresh_token", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  token: text("token").notNull(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => session.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revoked: timestamp("revoked"),
  authTime: timestamp("auth_time"),
  scopes: text("scopes").array().notNull(),
});

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  token: text("token").unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => session.id, {
    onDelete: "set null",
  }),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  refreshId: uuid("refresh_id").references(() => oauthRefreshToken.id, {
    onDelete: "cascade",
  }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  scopes: text("scopes").array().notNull(),
});

export const oauthConsent = pgTable("oauth_consent", {
  id: uuid("id")
    .default(sql`pg_catalog.gen_random_uuid()`)
    .primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    configId: text("configId").notNull().default("default"),
    referenceId: text("referenceId").notNull(),
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: timestamp("lastRefillAt"),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("rateLimitEnabled").notNull().default(false),
    rateLimitTimeWindow: integer("rateLimitTimeWindow"),
    rateLimitMax: integer("rateLimitMax"),
    requestCount: integer("requestCount").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("lastRequest"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    permissions: text("permissions").$defaultFn(() => ""),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_configId_idx").on(table.configId),
  ],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull().unique(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

// Enums
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
  "cancelled",
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
    type: varchar("type", { length: 50 }).notNull().default("system"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    verificationToken: varchar("verification_token", { length: 255 }),
    dnsProvider: varchar("dns_provider", { length: 100 }),
    targetSubdomain: varchar("target_subdomain", { length: 255 }),
  },
  (table) => [
    index("idx_domains_user_id").on(table.userId),
    index("idx_domains_name").on(table.name),
    uniqueIndex("idx_domains_name_unique").on(table.name),
    index("idx_domains_type").on(table.type),
  ],
);

// Applications
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    port: integer("port").notNull(),
    environment: text("environment").notNull(),
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
    source: varchar("source", { length: 20 }).default("github").notNull(),
    routingStrategy: varchar("routing_strategy", { length: 20 }).notNull().default("single"),
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
    imageS3Key: text("image_s3_key").default(""),
    imageSize: bigint("image_size", { mode: "number" }).default(0),
    serverId: uuid("server_id").references(() => sshKeys.id),
    parentDeploymentId: uuid("parent_deployment_id"),
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
    foreignKey({
      columns: [table.parentDeploymentId],
      foreignColumns: [table.id],
      name: "application_deployment_parent_fk",
    }).onDelete("set null"),
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

export const composeServices = pgTable(
  "compose_services",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    serviceName: text("service_name").notNull(),
    port: integer("port").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_compose_services_application_id").on(table.applicationId),
    uniqueIndex("idx_compose_services_app_service_unique").on(
      table.applicationId,
      table.serviceName,
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
    composeServiceId: uuid("compose_service_id")
      .references(() => composeServices.id, { onDelete: "set null" }),
    port: integer("port"),
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
    index("idx_application_domains_compose_service_id").on(table.composeServiceId),
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
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
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
    index("idx_smtp_configs_organization_id").on(table.organizationId),
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

// Application context: cached Merkle root, simhash, and path→checksum t
export const applicationContext = pgTable(
  "application_context",
  {
    applicationId: uuid("application_id")
      .primaryKey()
      .references(() => applications.id, { onDelete: "cascade" }),
    rootHash: text("root_hash"),
    simhash: text("simhash"),
    paths: jsonb("paths").default(sql`'{}'::jsonb`).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// Application file chunks: semantic chunks per file for RAG/context
export const applicationFileChunks = pgTable(
  "application_file_chunks",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    content: text("content").notNull(),
    chunkHash: varchar("chunk_hash", { length: 64 }).notNull(),
    language: varchar("language", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_application_file_chunks_app_path").on(table.applicationId, table.path),
    index("idx_application_file_chunks_app_id").on(table.applicationId),
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
export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
  apiKeys: many(apiKeys),
  passkeys: many(passkey),
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
  userProvisionDetails: many(userProvisionDetails),
  aiUsageLogs: many(aiUsageLogs),
  oauthClients: many(oauthClient),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
  machineBackups: many(machineBackups),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
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
  sshKeys: many(sshKeys),
  userProvisionDetails: many(userProvisionDetails),
  creditAccounts: many(creditAccounts),
  creditTransactions: many(creditTransactions),
  aiUsageLogs: many(aiUsageLogs),
  machineBackups: many(machineBackups),
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
  composeServices: many(composeServices),
  healthChecks: many(healthChecks),
  liveDeploySessions: many(liveDeploySessions),
  applicationContext: one(applicationContext, {
    fields: [applications.id],
    references: [applicationContext.applicationId],
  }),
  applicationFileChunks: many(applicationFileChunks),
  servers: many(applicationServers),
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
    parent: one(applicationDeployment, {
      fields: [applicationDeployment.parentDeploymentId],
      references: [applicationDeployment.id],
      relationName: "deployment_parent",
    }),
    children: many(applicationDeployment, {
      relationName: "deployment_parent",
    }),
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

export const composeServicesRelations = relations(
  composeServices,
  ({ one, many }) => ({
    application: one(applications, {
      fields: [composeServices.applicationId],
      references: [applications.id],
    }),
    domains: many(applicationDomains),
  }),
);

export const applicationDomainsRelations = relations(
  applicationDomains,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationDomains.applicationId],
      references: [applications.id],
    }),
    composeService: one(composeServices, {
      fields: [applicationDomains.composeServiceId],
      references: [composeServices.id],
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
  organization: one(organization, {
    fields: [smtpConfigs.organizationId],
    references: [organization.id],
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

export const applicationContextRelations = relations(
  applicationContext,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationContext.applicationId],
      references: [applications.id],
    }),
  }),
);

export const applicationFileChunksRelations = relations(
  applicationFileChunks,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationFileChunks.applicationId],
      references: [applications.id],
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

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const oauthRefreshTokenRelations = relations(
  oauthRefreshToken,
  ({ one, many }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthRefreshToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthRefreshToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthRefreshToken.userId],
      references: [user.id],
    }),
    oauthAccessTokens: many(oauthAccessToken),
  }),
);

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthAccessToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthAccessToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
    oauthRefreshToken: one(oauthRefreshToken, {
      fields: [oauthAccessToken.refreshId],
      references: [oauthRefreshToken.id],
    }),
  }),
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
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
    icon: text("icon").notNull(),
    category: extensionCategoryEnum("category").notNull(),
    extensionType: extensionTypeEnum("extension_type")
      .default("run")
      .notNull(),
    version: varchar("version", { length: 20 }),
    isVerified: boolean("is_verified").default(false).notNull(),
    featured: boolean("featured").default(false).notNull(),
    parentExtensionId: uuid("parent_extension_id").references(
      (): any => extensions.id,
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

export const sshKeys = pgTable(
  "ssh_keys",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    host: varchar("host", { length: 255 }),
    proxyHost: varchar("proxy_host", { length: 255 }),
    user: varchar("user", { length: 255 }),
    port: integer("port").default(22),
    publicKey: text("public_key"),
    privateKeyEncrypted: text("private_key_encrypted"),
    passwordEncrypted: text("password_encrypted"),
    keyType: varchar("key_type", { length: 20 }).default("rsa"),
    keySize: integer("key_size").default(4096),
    fingerprint: varchar("fingerprint", { length: 255 }),
    authMethod: varchar("auth_method", { length: 20 }).default("key").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
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
    index("idx_ssh_keys_organization_id").on(table.organizationId),
    index("idx_ssh_keys_is_active").on(table.isActive),
    index("idx_ssh_keys_fingerprint").on(table.fingerprint),
    index("idx_ssh_keys_deleted_at").on(table.deletedAt),
    index("idx_ssh_keys_auth_method").on(table.authMethod),
    uniqueIndex("ssh_keys_one_default_per_org")
      .on(table.organizationId)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  ],
);

export const applicationServers = pgTable(
  "application_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    serverId: uuid("server_id")
      .notNull()
      .references(() => sshKeys.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("application_servers_one_primary_per_app")
      .on(table.applicationId)
      .where(sql`is_primary = true`),
    unique("application_servers_unique_app_server").on(
      table.applicationId,
      table.serverId,
    ),
    index("idx_application_servers_application_id").on(table.applicationId),
    index("idx_application_servers_server_id").on(table.serverId),
  ],
);

export const sshKeysRelations = relations(sshKeys, ({ one, many }) => ({
  organization: one(organization, {
    fields: [sshKeys.organizationId],
    references: [organization.id],
  }),
  applicationServers: many(applicationServers),
}));

export const applicationServersRelations = relations(applicationServers, ({ one }) => ({
  application: one(applications, {
    fields: [applicationServers.applicationId],
    references: [applications.id],
  }),
  server: one(sshKeys, {
    fields: [applicationServers.serverId],
    references: [sshKeys.id],
  }),
}));

export const userProvisionDetails = pgTable(
  "user_provision_details",
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
    lxdContainerName: varchar("lxd_container_name", { length: 255 }),
    sshKeyId: uuid("ssh_key_id")
      .references(() => sshKeys.id, { onDelete: "set null" }),
    subdomain: varchar("subdomain", { length: 255 }),
    domain: varchar("domain", { length: 255 }),
    step: provisionStepEnum("step"),
    error: text("error"),
    type: provisionTypeEnum("type").default("trial").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_user_provision_details_user_id").on(table.userId),
    index("idx_user_provision_details_organization_id").on(table.organizationId),
    index("idx_user_provision_details_ssh_key_id").on(table.sshKeyId),
    uniqueIndex("idx_user_provision_details_user_org_trial_unique")
      .on(table.userId, table.organizationId)
      .where(sql`type = 'trial'`),
  ],
);

export const userProvisionDetailsRelations = relations(
  userProvisionDetails,
  ({ one }) => ({
    user: one(user, {
      fields: [userProvisionDetails.userId],
      references: [user.id],
    }),
    organization: one(organization, {
      fields: [userProvisionDetails.organizationId],
      references: [organization.id],
    }),
    sshKey: one(sshKeys, {
      fields: [userProvisionDetails.sshKeyId],
      references: [sshKeys.id],
    }),
  }),
);

export const creditAccounts = pgTable(
  "credit_accounts",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    planCredits: integer("plan_credits").default(0).notNull(),
    purchasedCredits: integer("purchased_credits").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_credit_accounts_organization_unique").on(table.organizationId),
  ],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    referenceId: varchar("reference_id", { length: 255 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_credit_transactions_org_created").on(table.organizationId, table.createdAt),
  ],
);

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    modelTier: varchar("model_tier", { length: 20 }).notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    creditsConsumed: integer("credits_consumed").default(0).notNull(),
    requestType: varchar("request_type", { length: 50 }),
    agentId: varchar("agent_id", { length: 100 }),
    workflowId: varchar("workflow_id", { length: 100 }),
    sessionId: varchar("session_id", { length: 255 }),
    latencyMs: integer("latency_ms"),
    status: varchar("status", { length: 20 }).default("success").notNull(),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_ai_usage_logs_org_created").on(table.organizationId, table.createdAt),
    index("idx_ai_usage_logs_user_created").on(table.userId, table.createdAt),
  ],
);

export const creditModelTiers = pgTable(
  "credit_model_tiers",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    modelPattern: varchar("model_pattern", { length: 255 }).notNull().unique(),
    tier: varchar("tier", { length: 20 }).notNull(),
    multiplier: numeric("multiplier", { precision: 5, scale: 2 }).default("1.0").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const creditAccountsRelations = relations(creditAccounts, ({ one }) => ({
  organization: one(organization, {
    fields: [creditAccounts.organizationId],
    references: [organization.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    organization: one(organization, {
      fields: [creditTransactions.organizationId],
      references: [organization.id],
    }),
  }),
);

export const aiUsageLogsRelations = relations(aiUsageLogs, ({ one }) => ({
  organization: one(organization, {
    fields: [aiUsageLogs.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [aiUsageLogs.userId],
    references: [user.id],
  }),
}));

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    entryType: varchar("entry_type", { length: 10 }).notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    reason: varchar("reason", { length: 255 }),
    referenceId: varchar("reference_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_wallet_tx_org").on(table.organizationId, table.createdAt),
    uniqueIndex("idx_wallet_tx_ref").on(table.referenceId),
  ],
);

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  organization: one(organization, {
    fields: [walletTransactions.organizationId],
    references: [organization.id],
  }),
}));

export const autoTopupSettings = pgTable(
  "auto_topup_settings",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    thresholdCents: integer("threshold_cents").default(200).notNull(),
    amountCents: integer("amount_cents").default(1000).notNull(),
    subscriptionId: varchar("subscription_id", { length: 255 }),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_auto_topup_org_unique").on(table.organizationId),
  ],
);

export const autoTopupSettingsRelations = relations(autoTopupSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [autoTopupSettings.organizationId],
    references: [organization.id],
  }),
}));

export const machineBillingStatusEnum = pgEnum("machine_billing_status", [
  "active",
  "grace_period",
  "suspended",
  "cancelled",
]);

export const machinePlans = pgTable("machine_plans", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  tier: varchar("tier", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  ramMb: integer("ram_mb").notNull(),
  vcpu: integer("vcpu").notNull(),
  storageMb: integer("storage_mb").notNull(),
  monthlyCostCents: integer("monthly_cost_cents").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const orgMachineBilling = pgTable(
  "org_machine_billing",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sshKeyId: uuid("ssh_key_id")
      .references(() => sshKeys.id, { onDelete: "set null" }),
    machinePlanId: uuid("machine_plan_id")
      .notNull()
      .references(() => machinePlans.id),
    status: machineBillingStatusEnum("status").default("active").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    graceDeadline: timestamp("grace_deadline", { withTimezone: true }),
    lastChargedAt: timestamp("last_charged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_org_machine_billing_org").on(table.organizationId),
    index("idx_org_machine_billing_status").on(table.status),
  ],
);

export const machinePlansRelations = relations(machinePlans, ({ many }) => ({
  orgMachineBillings: many(orgMachineBilling),
}));

export const orgMachineBillingRelations = relations(orgMachineBilling, ({ one }) => ({
  organization: one(organization, {
    fields: [orgMachineBilling.organizationId],
    references: [organization.id],
  }),
  sshKey: one(sshKeys, {
    fields: [orgMachineBilling.sshKeyId],
    references: [sshKeys.id],
  }),
  machinePlan: one(machinePlans, {
    fields: [orgMachineBilling.machinePlanId],
    references: [machinePlans.id],
  }),
}));

export const machineBackupStatusEnum = pgEnum("machine_backup_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const machineBackups = pgTable(
  "machine_backups",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provisionId: uuid("provision_id")
      .references(() => userProvisionDetails.id, { onDelete: "set null" }),
    machineName: varchar("machine_name", { length: 255 }).notNull(),
    status: machineBackupStatusEnum("status").default("pending").notNull(),
    trigger: varchar("trigger", { length: 50 }).notNull(),
    snapshotPath: text("snapshot_path"),
    s3Path: text("s3_path"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).default(0).notNull(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_machine_backups_user_id").on(table.userId),
    index("idx_machine_backups_organization_id").on(table.organizationId),
    index("idx_machine_backups_provision_id").on(table.provisionId),
    index("idx_machine_backups_machine_name").on(table.machineName),
    index("idx_machine_backups_status").on(table.status),
    index("idx_machine_backups_created_at").on(table.createdAt),
  ],
);

export const machineBackupsRelations = relations(machineBackups, ({ one }) => ({
  user: one(user, {
    fields: [machineBackups.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [machineBackups.organizationId],
    references: [organization.id],
  }),
  provisionDetails: one(userProvisionDetails, {
    fields: [machineBackups.provisionId],
    references: [userProvisionDetails.id],
  }),
}));

export const cliInstallations = pgTable(
  "cli_installations",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    os: varchar("os", { length: 50 }).notNull().default("unknown"),
    arch: varchar("arch", { length: 10 }).notNull().default("unknown"),
    version: varchar("version", { length: 20 }).notNull(),
    duration: integer("duration").notNull().default(0),
    error: varchar("error", { length: 200 }),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_cli_installations_created_at").on(table.createdAt),
    index("idx_cli_installations_ip_hash").on(table.ipHash),
    index("idx_cli_installations_event_type").on(table.eventType),
  ],
);
