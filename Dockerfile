# syntax=docker/dockerfile:1
# Targets: runner (the API/app, standalone output) and tooling (migrations + seed).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# public/ is empty (untracked) in a fresh checkout; the runner copies it, so make sure it exists.
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1 DOCKER_BUILD=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# Runs drizzle-kit migrate by default; seed with: npx tsx scripts/db-seed.ts
FROM deps AS tooling
ENV NODE_ENV=development
COPY package.json tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/db ./src/db
COPY scripts ./scripts
COPY data ./data
USER node
CMD ["npx", "drizzle-kit", "migrate"]
