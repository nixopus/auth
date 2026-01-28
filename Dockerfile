FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9090

# Install curl and wget for healthchecks
RUN apk add --no-cache curl wget

RUN addgroup -S nixopus && adduser -S nixopus -G nixopus

COPY --from=builder --chown=nixopus:nixopus /app/dist ./dist
COPY --from=builder --chown=nixopus:nixopus /app/node_modules ./node_modules
COPY --from=builder --chown=nixopus:nixopus /app/package.json ./package.json
COPY --from=builder --chown=nixopus:nixopus /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nixopus:nixopus /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nixopus:nixopus /app/src/config.ts ./src/config.ts
COPY --from=builder --chown=nixopus:nixopus /app/drizzle ./drizzle
COPY --from=builder --chown=nixopus:nixopus /app/scripts/entrypoint.js ./scripts/entrypoint.js
COPY --from=builder --chown=nixopus:nixopus /app/scripts/healthcheck.js ./scripts/healthcheck.js

RUN chmod +x /app/scripts/healthcheck.js

USER nixopus

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD /app/scripts/healthcheck.js

CMD ["bun", "run", "scripts/entrypoint.js"]
