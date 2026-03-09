// Wait for secrets to be loaded before initializing database connection
import '../init-secrets.js';
import { waitForSecrets } from '../init-secrets.js';
await waitForSecrets();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import { logger } from '../logger.js';
import * as schema from './schema.js';

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured. Please set it in your environment variables or secret manager. If using a secret manager, ensure SECRET_MANAGER_ENABLED=true, INFISICAL_TOKEN is set, and DATABASE_URL exists in your secret manager.');
    }
    poolInstance = new Pool({
      connectionString: databaseUrl,
    });
    poolInstance.on('error', (err) => {
      logger.error({ err }, 'unexpected database pool error');
    });
    logger.debug('database pool initialized');
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
