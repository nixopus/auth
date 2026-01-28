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

RUN addgroup -S nixopus && adduser -S nixopus -G nixopus

COPY --from=builder --chown=nixopus:nixopus /app/dist ./dist
COPY --from=builder --chown=nixopus:nixopus /app/node_modules ./node_modules
COPY --from=builder --chown=nixopus:nixopus /app/package.json ./package.json
COPY --from=builder --chown=nixopus:nixopus /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nixopus:nixopus /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nixopus:nixopus /app/src/config.ts ./src/config.ts
COPY --from=builder --chown=nixopus:nixopus /app/drizzle ./drizzle
COPY --from=builder --chown=nixopus:nixopus /app/scripts/entrypoint.js ./scripts/entrypoint.js

USER nixopus

# Default to 9090, but can be overridden via PORT env var
ENV PORT=9090

EXPOSE 9090

CMD ["bun", "run", "scripts/entrypoint.js"]
