# Nixopus Authentication Service


## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd auth
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.sample .env
   ```
4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The service will be available at `http://localhost:8080`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `8080` | No |
| `HOST` | Server hostname | `0.0.0.0` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes (production) |
| `BETTER_AUTH_URL` | Base URL for Better Auth | `http://localhost:8080` | No |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth | - | Yes |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:3000,...` | No |
| `RESEND_API_KEY` | Resend API key for email | - | Yes (for email) |
| `RESEND_FROM_EMAIL` | Default sender email | `test@test.com` | No |
| `SECRET_MANAGER_ENABLED` | Enable secret manager | `false` | No |
| `SECRET_MANAGER_TYPE` | Secret manager type (`infisical`, `none`) | `none` | No |
| `INFISICAL_URL` | Infisical API URL | `https://app.infisical.com` | No |
| `INFISICAL_TOKEN` | Infisical API token | - | No |

### CORS Configuration

The service supports configurable CORS policies. Default allowed origins include:
- `http://localhost:3000` (development)
- `http://localhost:7443` (development)
- `https://app.nixopus.com` (production)
- `https://view.nixopus.com` (production)

To customize, set the `CORS_ALLOWED_ORIGINS` environment variable with comma-separated origins.

### Cross-Subdomain Cookies

In production, the service automatically enables cross-subdomain cookies for the `.nixopus.com` domain, allowing authentication to work across subdomains (e.g., `auth.nixopus.com` → `app.nixopus.com`).

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Build
npm run build            # Compile TypeScript to JavaScript

# Production
npm start                # Start production server

# Database
npm run db:generate       # Generate migration files from schema changes
npm run db:migrate       # Run database migrations
npm run db:push          # Push schema changes directly (development only)

# Authentication
npm run auth:generate    # Generate Better Auth types and utilities
```

**Built with ❤️ for the Nixopus platform**
