#!/usr/bin/env bun
// Healthcheck script for Docker
const port = process.env.PORT || '9090';
const url = `http://127.0.0.1:${port}/health`;

try {
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });
  
  if (!response.ok) {
    console.error(`Healthcheck failed: HTTP ${response.status}`);
    process.exit(1);
  }
  
  const data = await response.json();
  if (data.status === 'ok') {
    process.exit(0);
  } else {
    console.error(`Healthcheck failed: Invalid response`, data);
    process.exit(1);
  }
} catch (error) {
  console.error(`Healthcheck failed: ${error.name}: ${error.message}`);
  process.exit(1);
}
