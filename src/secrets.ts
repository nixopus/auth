/**
 * Secret Manager Integration for TypeScript/Node.js services
 * Supports Infisical secret manager
 */

export type SecretManagerType = 'none' | 'infisical';

export interface SecretManagerConfig {
  type: SecretManagerType;
  enabled: boolean;
  projectId?: string;
  environment: string;
  secretPath?: string; // Path where secrets are stored in Infisical (e.g., "/" or "/api")
  serviceName: string;
  infisicalUrl?: string;
  infisicalToken?: string;
}

export interface SecretManager {
  getSecret(key: string): Promise<string>;
  getSecrets(prefix?: string): Promise<Record<string, string>>;
}

/**
 * Load secret manager configuration from environment variables
 */
export function loadSecretManagerConfig(serviceName: string): SecretManagerConfig {
  const managerType = (process.env.SECRET_MANAGER_TYPE?.toLowerCase() || 'none') as SecretManagerType;
  const enabled = process.env.SECRET_MANAGER_ENABLED === 'true';

  if (!enabled && managerType === 'none') {
    return {
      type: 'none',
      enabled: false,
      environment: 'prod',
      serviceName,
    };
  }

  return {
    type: managerType,
    enabled,
    projectId: process.env.SECRET_MANAGER_PROJECT_ID,
    environment: process.env.SECRET_MANAGER_ENVIRONMENT || 'prod',
    secretPath: process.env.SECRET_MANAGER_SECRET_PATH || '/',
    serviceName,
    infisicalUrl: process.env.INFISICAL_URL || 'https://app.infisical.com',
    infisicalToken: process.env.INFISICAL_TOKEN,
  };
}

/**
 * Create a secret manager instance based on configuration
 */
export async function createSecretManager(
  config: SecretManagerConfig
): Promise<SecretManager> {
  if (!config.enabled || config.type === 'none') {
    return new NoOpSecretManager();
  }

  switch (config.type) {
    case 'infisical':
      if (!config.infisicalToken) {
        throw new Error('INFISICAL_TOKEN is required when using Infisical');
      }
      return new InfisicalManager(config);
    default:
      return new NoOpSecretManager();
  }
}

/**
 * No-op secret manager that doesn't fetch any secrets
 */
class NoOpSecretManager implements SecretManager {
  async getSecret(key: string): Promise<string> {
    throw new Error('Secret manager not configured');
  }

  async getSecrets(prefix?: string): Promise<Record<string, string>> {
    return {};
  }
}

/**
 * Infisical secret manager implementation
 */
class InfisicalManager implements SecretManager {
  private config: SecretManagerConfig;
  private baseUrl: string;

  constructor(config: SecretManagerConfig) {
    this.config = config;
    this.baseUrl = config.infisicalUrl || 'https://app.infisical.com';
  }

  async getSecret(key: string): Promise<string> {
    const secrets = await this.getSecrets();
    const value = secrets[key];
    if (!value) {
      throw new Error(`Secret ${key} not found`);
    }
    return value;
  }

  async getSecrets(prefix?: string): Promise<Record<string, string>> {
    const url = new URL(`${this.baseUrl}/api/v3/secrets/raw`);

    // Add query parameters
    if (this.config.projectId) {
      url.searchParams.append('workspaceId', this.config.projectId);
    }
    // Environment is required by Infisical API
    if (!this.config.environment) {
      throw new Error('Environment is required but not set in SECRET_MANAGER_ENVIRONMENT');
    }
    
    // Normalize common environment names to Infisical slug format
    const envSlug = normalizeEnvironmentName(this.config.environment);
    url.searchParams.append('environment', envSlug);
    
    // Add secret path (defaults to "/" for root)
    const secretPath = this.config.secretPath || '/';
    url.searchParams.append('secretPath', secretPath);
    
    // Set recursive to true to fetch secrets from subfolders if needed
    url.searchParams.append('recursive', 'true');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.infisicalToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      // Handle 404 gracefully - secrets might not exist yet
      if (response.status === 404) {
        console.warn(
          `Warning: No secrets found at path '${secretPath}' in environment '${envSlug}'. This is normal if secrets haven't been created yet.`
        );
        return {};
      }
      throw new Error(
        `Failed to fetch secrets from Infisical: ${response.status} ${body}`
      );
    }

    const data = await response.json();
    const secrets: Record<string, string> = {};

    // Handle structured response with secrets array
    if (data.secrets && Array.isArray(data.secrets)) {
      for (const secret of data.secrets) {
        const key = secret.secretKey || secret.key;
        const value = secret.secretValue || secret.value;
        if (key && (!prefix || key.startsWith(prefix))) {
          secrets[key] = value;
        }
      }
    } 
    // Handle flat key-value object response
    else if (typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        // Skip metadata fields
        if (key === 'secrets' || key === 'imports') continue;
        if (!prefix || key.startsWith(prefix)) {
          secrets[key] = String(value);
        }
      }
    }

    return secrets;
  }
}

/**
 * Normalize environment name to Infisical slug format
 * Note: Infisical uses "prod" not "production", "dev" not "development"
 */
function normalizeEnvironmentName(env: string): string {
  const normalized = env.toLowerCase().trim();
  // Map common variations to Infisical slug format
  switch (normalized) {
    case 'dev':
    case 'development':
      return 'dev';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'prod':
    case 'production':
      return 'prod';
    default:
      return normalized;
  }
}

/**
 * Load secrets from secret manager into process.env
 * This is useful for services that expect environment variables
 */
export async function loadSecretsIntoEnv(
  manager: SecretManager,
  prefixes: string[] = []
): Promise<void> {
  if (!manager) {
    return;
  }

  try {
    // Load secrets with each prefix
    for (const prefix of prefixes) {
      const secrets = await manager.getSecrets(prefix);
      for (const [key, value] of Object.entries(secrets)) {
        process.env[key] = value;
      }
    }

    // Also load all secrets without prefix
    const allSecrets = await manager.getSecrets();
    for (const [key, value] of Object.entries(allSecrets)) {
      // Only set if not already set (prefixes take precedence)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.error('Failed to load secrets:', error);
    throw error;
  }
}
