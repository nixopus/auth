/**
 * Initialize secrets from secret manager before application starts
 * This should be imported at the very beginning of the application entry point
 */
import { loadSecretManagerConfig, createSecretManager, loadSecretsIntoEnv } from './secrets';

let secretsInitialized = false;
let secretsInitPromise: Promise<void> | null = null;

export async function initializeSecrets(): Promise<void> {
  if (secretsInitialized) {
    return;
  }

  try {
    const secretConfig = loadSecretManagerConfig('auth');
    
    if (secretConfig.enabled) {
      const secretManager = await createSecretManager(secretConfig);
      await loadSecretsIntoEnv(secretManager, ['AUTH_', 'NIXOPUS_AUTH_', '']);
    }
    secretsInitialized = true;
  } catch (error: any) {
    console.warn(
      `[Secrets] ⚠ Warning: Failed to load secrets from secret manager: ${error.message}. Falling back to .env files`
    );
    secretsInitialized = true; // Mark as initialized to prevent retries
  }
}

// Auto-initialize secrets when this module is imported
// This runs before config.ts is evaluated, ensuring secrets are loaded into process.env
if (typeof window === 'undefined') {
  secretsInitPromise = initializeSecrets().catch((error) => {
    console.error('[Secrets] Failed to initialize secrets:', error);
  });
}

// Export promise so other modules can wait for secrets to load
export function waitForSecrets(): Promise<void> {
  return secretsInitPromise || Promise.resolve();
}
