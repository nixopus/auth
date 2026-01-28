#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load secrets BEFORE running migrations
async function loadSecrets() {
  try {
    // Import the built init-secrets module
    const { initializeSecrets } = await import('../dist/init-secrets.js');
    await initializeSecrets();
  } catch (error) {
    console.warn('[Entrypoint] ⚠ Warning: Failed to load secrets:', error.message);
    // Continue anyway - secrets might be in .env file
  }
}

// Load secrets first
console.log('[Entrypoint] Loading secrets...');
await loadSecrets();

// Run migrations with secrets loaded
console.log('[Entrypoint] Running database migrations...');
try {
  execSync('bun run db:migrate', { 
    stdio: 'inherit', 
    env: process.env,
    cwd: '/app'
  });
  console.log('[Entrypoint] ✓ Migrations completed successfully');
} catch (error) {
  console.error('[Entrypoint] ✗ Migrations failed:', error.message);
  process.exit(1);
}

// Start the server
console.log('[Entrypoint] Starting auth server...');
import { spawn } from 'child_process';

const serverProcess = spawn('bun', ['run', 'dist/server.js'], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
  cwd: '/app'
});

serverProcess.on('error', (error) => {
  console.error('[Entrypoint] Failed to start auth server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});
