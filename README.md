# Nixopus Authentication Service

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd auth
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.sample .env
   ```

4. **Start the development server** (runs migrations automatically)
   ```bash
   bun run dev
   ```

The service will be available at `http://localhost:9090`

## Self-Hosted Mode

For single-user self-hosted deployments, use the self-hosted env template:

```bash
cp .env.self-hosted.sample .env
```

### How it works

1. Set `SELF_HOSTED=true` and `ADMIN_EMAIL=you@example.com`
2. On first startup, the admin user is seeded automatically
3. Registration closes after the first user — no one else can sign up
4. Organization invitations are disabled

### OTP without email

If `RESEND_API_KEY` is not set, OTP codes are logged to the server console:

```
{"level":"info","email":"you@example.com","type":"sign-in","msg":"self-hosted OTP generated (no email provider)"}
```

Check your server logs (`docker logs nixopus-auth`) to find the code.

### Troubleshooting

Set `LOG_LEVEL=debug` to get detailed logs for every decision point (user creation, org setup, SSH key provisioning, session creation). Attach these logs when reporting issues.

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `9090` | No |
| `HOST` | Server hostname | `0.0.0.0` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `LOG_LEVEL` | Log level (trace/debug/info/warn/error/fatal) | `info` (prod), `debug` (dev) | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `AUTH_SERVICE_URL` | Base URL for auth service | `http://localhost:9090` | No |
| `AUTH_SERVICE_SECRET` | Secret key for auth service | - | Yes |
| `ALLOWED_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:3000,...` | No |
| `RESEND_API_KEY` | Resend API key for email | - | No (OTPs logged to console if unset) |
| `RESEND_FROM_EMAIL` | Default sender email | `Nixopus <updates@updates.nixopus.com>` | No |
| `SELF_HOSTED` | Enable single-user self-hosted mode | `false` | No |
| `ADMIN_EMAIL` | Admin email seeded on first startup | - | No (self-hosted) |
| `AUTH_COOKIE_DOMAIN` | Base domain for cross-subdomain cookies | - | No |
| `AUTH_SECURE_COOKIES` | Enable Secure flag on cookies (HTTPS) | `false` | No |
| `PASSKEY_RP_ID` | WebAuthn relying party ID | Derived from `AUTH_SERVICE_URL` | No |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha key | - | No |
| `SECRET_MANAGER_ENABLED` | Enable Infisical secret manager | `false` | No |

### CORS Configuration

The service supports configurable CORS policies. Default allowed origins include:
- `http://localhost:3000` (development)
- `http://localhost:7443` (development)

To customize, set the `ALLOWED_ORIGIN` environment variable with comma-separated origins (e.g., `https://view.example.com,https://api.example.com`).

### Cookie Configuration

For production deployments with custom domains, configure cookie settings:

- `AUTH_COOKIE_DOMAIN`: Base domain for cross-subdomain cookies (e.g., `.example.com`). When set, cookies will be shared across all subdomains.
- `AUTH_SECURE_COOKIES`: Set to `true` to enable Secure flag on cookies (required for HTTPS).

```env
AUTH_COOKIE_DOMAIN=.example.com
AUTH_SECURE_COOKIES=true
```

This allows authentication to work across subdomains (e.g., `auth.example.com` to `view.example.com`).

## Development

### Available Scripts

```bash
bun run dev              # Start dev server (runs migrations + hot reload)
bun run build            # Compile TypeScript
bun run start            # Start production server
bun test                 # Run unit tests

bun run db:generate      # Generate migration files from schema changes
bun run db:migrate       # Run database migrations
bun run db:push          # Push schema changes directly (development only)

bun run auth:generate    # Generate Better Auth types and utilities
```

**Built with love for the Nixopus platform**
