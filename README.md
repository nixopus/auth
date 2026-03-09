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
| `AUTH_SERVICE_URL` | Base URL for auth service | `http://localhost:8080` | No |
| `AUTH_SERVICE_SECRET` | Secret key for auth service | - | Yes |
| `ALLOWED_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:3000,...` | No |
| `RESEND_API_KEY` | Resend API key for email | - | Yes (for email) |
| `RESEND_FROM_EMAIL` | Default sender email | `test@test.com` | No |
| `SECRET_MANAGER_ENABLED` | Enable secret manager | `false` | No |

### CORS Configuration

The service supports configurable CORS policies. Default allowed origins include:
- `http://localhost:3000` (development)
- `http://localhost:7443` (development)

To customize, set the `ALLOWED_ORIGIN` environment variable with comma-separated origins (e.g., `https://view.example.com,https://api.example.com`).

### Cookie Configuration

For production deployments with custom domains, configure cookie settings:

- `AUTH_COOKIE_DOMAIN`: Base domain for cross-subdomain cookies (e.g., `.example.com`). When set, cookies will be shared across all subdomains.
- `AUTH_SECURE_COOKIES`: Set to `true` to enable Secure flag on cookies (required for HTTPS).

Example:
```env
AUTH_COOKIE_DOMAIN=.example.com
AUTH_SECURE_COOKIES=true
```

This allows authentication to work across subdomains (e.g., `auth.example.com` to `view.example.com`).

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
