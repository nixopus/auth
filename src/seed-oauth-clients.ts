import './init-secrets.js';
import { waitForSecrets } from './init-secrets.js';

await waitForSecrets();

import { auth } from './auth/index.js';

const nixopusApi = await auth.api.adminCreateOAuthClient({
  headers: new Headers(),
  body: {
    client_name: 'nixopus-api',
    redirect_uris: ['https://localhost'],
    grant_types: ['client_credentials'],
    token_endpoint_auth_method: 'client_secret_post',
    skip_consent: true,
    require_pkce: false,
  },
});

console.log('=== nixopus-api ===');
console.log(`  client_id:     ${nixopusApi.client_id}`);
console.log(`  client_secret: ${nixopusApi.client_secret}`);
console.log();

const agent = await auth.api.adminCreateOAuthClient({
  headers: new Headers(),
  body: {
    client_name: 'agent',
    redirect_uris: ['https://localhost'],
    grant_types: ['client_credentials'],
    token_endpoint_auth_method: 'client_secret_post',
    skip_consent: true,
    require_pkce: false,
  },
});

console.log('=== agent ===');
console.log(`  client_id:     ${agent.client_id}`);
console.log(`  client_secret: ${agent.client_secret}`);

process.exit(0);
