import { spawn, execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists (before loading secrets)
try {
  const envPath = join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  // .env file is optional if using secret manager
}

// Load secrets BEFORE anything else (including migrations)
async function loadSecrets() {
  try {
    const { initializeSecrets } = await import('../src/init-secrets.ts');
    await initializeSecrets();
  } catch (error) {
    console.warn('[Dev] ⚠ Warning: Failed to load secrets:', error.message);
  }
}

// Load secrets first
await loadSecrets();

// Now run migrations with secrets loaded
try {
  execSync('bun run db:migrate', { stdio: 'inherit', env: process.env });
} catch (error) {
  console.error('[Dev] ✗ Migrations failed:', error.message);
  process.exit(1);
}

// Ensure secret manager env vars are passed to the process
const secretManagerVars = [
  'SECRET_MANAGER_ENABLED',
  'SECRET_MANAGER_TYPE',
  'SECRET_MANAGER_PROJECT_ID',
  'SECRET_MANAGER_ENVIRONMENT',
  'SECRET_MANAGER_SECRET_PATH',
  'INFISICAL_URL',
  'INFISICAL_TOKEN',
];

const authEnv = { ...process.env };
secretManagerVars.forEach((key) => {
  if (process.env[key]) {
    authEnv[key] = process.env[key];
  }
});

// Start the server
const serverProcess = spawn('bun', ['run', 'src/server.ts'], {
  stdio: 'inherit',
  shell: true,
  env: authEnv,
});

serverProcess.on('error', (error) => {
  console.error('[Dev] Failed to start auth server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});
