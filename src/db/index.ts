// Wait for secrets to be loaded before initializing database connection
import '../init-secrets';
import { waitForSecrets } from '../init-secrets';
await waitForSecrets();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

// Lazy initialization of database pool to ensure secrets are loaded first
let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    // Read directly from process.env to ensure we get the latest value after secrets are loaded
    const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured. Please set it in your environment variables or secret manager. If using a secret manager, ensure SECRET_MANAGER_ENABLED=true, INFISICAL_TOKEN is set, and DATABASE_URL exists in your secret manager.');
    }
    poolInstance = new Pool({
      connectionString: databaseUrl,
    });
  }
  return poolInstance;
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

// Export lazy getters that initialize on first access
export const db = getDb();
export const pool = getPool();
