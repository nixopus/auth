FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache wget && \
    addgroup -S nixopus && adduser -S nixopus -G nixopus

COPY --from=builder --chown=nixopus:nixopus /app/dist ./dist
COPY --from=builder --chown=nixopus:nixopus /app/node_modules ./node_modules
COPY --from=builder --chown=nixopus:nixopus /app/package.json ./package.json
COPY --from=builder --chown=nixopus:nixopus /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nixopus:nixopus /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nixopus:nixopus /app/src/config.ts ./src/config.ts
COPY --from=builder --chown=nixopus:nixopus /app/drizzle ./drizzle
COPY --from=builder --chown=nixopus:nixopus /app/scripts/entrypoint.js ./scripts/entrypoint.js

USER nixopus

EXPOSE 8080

CMD ["node", "scripts/entrypoint.js"]
