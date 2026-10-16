# Dockerize the Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the backend (Next.js API routes + Drizzle + Postgres) as a production Docker image with a compose stack that migrates the database and serves the API, without changing local `npm run dev` behaviour.

**Architecture:** One multi-stage `Dockerfile` with two runtime targets: `runner` (Next `output: 'standalone'`, non-root, health-checked) and `tooling` (full deps, runs `drizzle-kit migrate` and the seed script). `docker-compose.prod.yml` wires `db` → `migrate` (one-shot) → `api`; Postgres is never published to the host. The image is the whole Next app (pages included, harmless); only `/api/*` is meant to be addressed.

**Tech Stack:** Docker multi-stage on `node:22-alpine`, docker compose, Postgres 16, Next.js 16.4 standalone output, Drizzle/drizzle-kit, Vitest (PGlite).

**Spec:** none; requirement = user message "we need to dockerize backend". **Out of scope (planned later, do not add here):** Vercel/frontend deployment, API proxying/rewrites, cross-origin auth, remote data layer, CORS, CI, TLS/reverse proxy, hosting choice. Next docs read: `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`, `.../01-getting-started/17-deploying.md` (Docker section).

## Current-state facts (verified)

- `/api/health` does not touch the database. `src/db/client.ts` builds the `postgres` pool lazily from `DATABASE_URL` (max 10).
- Existing `docker-compose.yml` is the dev database (`rr-postgres`, `127.0.0.1:5434`); it must not change.
- Migrations: `drizzle/` + `drizzle.config.ts` (`drizzle-kit migrate`, reads `DATABASE_URL`, loads `.env.local` if present). Seed: `scripts/db-seed.ts` (reads `data/db.json`, run with `tsx`).
- `app/page.tsx` and `app/cities/[city]/page.tsx` are prerendered at build and read the DB, so `next build` currently needs a live database (README says so) and their data is frozen at build time.
- Secrets in the repo dir (git-ignored; must stay out of images): `.env.local`, `client_secret_*.json`.
- Env the app reads: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `NEXT_PUBLIC_SITE_URL`.
- Local Node is v18; use Node 22 for builds (`export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`). The user's `next dev` may be on port 3000; do not kill it or `rm -rf .next`.

## Global Constraints

- Local mode unchanged: all existing tests pass; `npm run dev` / `db:up` flows work as before; dev `docker-compose.yml` untouched.
- Image: runs as non-root `node`; contains no `.env*`, no `client_secret_*.json`, no `.git`, no `tests/`, no `docs/`; `HEALTHCHECK` on `GET /api/health`; `PORT=3000`, `HOSTNAME=0.0.0.0`.
- Production compose: Postgres has no published port; `POSTGRES_PASSWORD` is required (`${POSTGRES_PASSWORD:?...}`), no default password; data in named volume `rr_pgdata_prod`; API bound to `127.0.0.1:${API_PORT:-3001}` (a reverse proxy to be chosen later terminates TLS).
- Secrets come only from an env file / environment at run time, never baked into an image layer or build arg.
- `DATABASE_URL` missing or database unreachable → clear error / HTTP 503, never a hang.
- `standalone` output only when `DOCKER_BUILD=1` so non-Docker builds are unaffected.
- Commits use the repo identity and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Database down or not yet migrated when the API starts: `/api/health` answers 503 (no hang, no leaked connection string) and compose does not start `api` before `migrate` succeeded. (Tasks 1, 3)
2. Secrets leaking into the image: `.env.local`, `client_secret_*.json`, `.git` present in any layer or in the build context. (Task 2)
3. Missing `POSTGRES_PASSWORD` / `NEXTAUTH_SECRET`: compose refuses to start with a readable message rather than running with an empty or default secret. (Task 3)
4. Re-running `docker compose up` after a restart or image upgrade: migrations are idempotent and seed is never run automatically (no duplicate data, no wipe). (Task 3)
5. Container stop signal and restart: `api` exits promptly on `SIGTERM` (docker stop) and comes back healthy under `restart: unless-stopped` with data intact in the volume. (Task 3)

---

## File Structure

```
src/app/api/health/route.ts        # + DB ping, 503 on failure
src/app/page.tsx                   # dynamic = 'force-dynamic' (build without DB)
src/app/cities/[city]/page.tsx     # dynamic = 'force-dynamic' (build without DB)
next.config.ts                     # output: 'standalone' when DOCKER_BUILD=1
Dockerfile                         # stages: deps, build, runner, tooling
.dockerignore
docker-compose.prod.yml            # db, migrate, api
.env.backend.example               # env contract for the compose stack
README.md                          # "Run the backend in Docker" section
package.json                       # docker:* convenience scripts
tests/api.test.ts                  # health cases
```

---

### Task 1: Health endpoint checks the database

**Files:** Modify `src/app/api/health/route.ts`; Test `tests/api.test.ts` (extend the existing `health` case).

**Interfaces:** Produces `GET /api/health` → 200 `{ ok: true, db: true, service, timestamp }`, or 503 `{ ok: false, db: false, error: 'Database unavailable.' }` (no error details or connection string). Consumed by the Docker `HEALTHCHECK` (Task 2).

- [ ] **Step 1: Write failing tests** — `health returns 200 with db:true when the database answers`; `health returns 503 {ok:false,db:false,error:'Database unavailable.'} when the query rejects` (install `setDb({ execute: () => Promise.reject(new Error('secret-host:5432')) } as never)`, restore with `setDb(null)` in `afterEach`); assert the response text does not contain `secret-host`.
- [ ] **Step 2:** Run `npx vitest run tests/api.test.ts -t health` → FAIL (503 case).
- [ ] **Step 3: Implement** the route: ``await getDb().execute(sql`select 1`)`` in try/catch, `json()` from `@/lib/api`, keep `dynamic = 'force-dynamic'`; log the real error server-side with `console.error`.
- [ ] **Step 4:** Run `npx vitest run` → all PASS.
- [ ] **Step 5:** `git add src/app/api/health tests/api.test.ts && git commit -m "feat: /api/health checks the database (503 when down)"`

### Task 2: Backend image (`runner` + `tooling`)

**Files:** Create `Dockerfile`, `.dockerignore`; Modify `next.config.ts`, `src/app/page.tsx`, `src/app/cities/[city]/page.tsx`, `package.json`.

**Interfaces:**
- `next.config.ts`: add `output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined`; existing headers untouched.
- `.dockerignore` entries: `node_modules`, `.next`, `.git`, `.env*`, `client_secret_*.json`, `.superpowers`, `.claude`, `tests`, `docs`, `*.tsbuildinfo`, `Dockerfile`, `docker-compose*.yml`.
- `Dockerfile` targets: `deps` (`npm ci`) → `build` (`DOCKER_BUILD=1 npm run build`, no database available) → `runner` (copies `.next/standalone`, `.next/static`, `public`; `USER node`; `ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0`; `EXPOSE 3000`; `CMD ["node","server.js"]`; `HEALTHCHECK` running `node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"` with `--interval=10s --timeout=5s --start-period=20s --retries=3`) and `tooling` (from `deps`: adds `src/db`, `drizzle/`, `drizzle.config.ts`, `scripts/`, `data/`, `tsconfig.json`, `package.json`; `USER node`; default `CMD ["npx","drizzle-kit","migrate"]`). Pages `/` and `/cities/[city]` get `export const dynamic = 'force-dynamic'` so the image builds without a database (this also fixes their data being frozen at build); `cities` keeps `generateStaticParams` and `dynamicParams = false`.
- `package.json` scripts: `"docker:build": "docker build --target runner -t rr-api ."`.

- [ ] **Step 1: Write the files** above (Dockerfile, `.dockerignore`, `next.config.ts` toggle, the two `dynamic` exports, script).
- [ ] **Step 2: Verify non-Docker build unaffected:** `npm test` and `npx tsc --noEmit` → PASS; `/cities/jaipur`-style routes still 404 for unknown cities (existing tests).
- [ ] **Step 3: Build the image** (start Docker Desktop first: `open -a Docker`, wait for `docker info`): `docker build --target runner -t rr-api .` → success **with no database running**. If `next build` still fails on a prerender, the failing page gets `dynamic = 'force-dynamic'`; no `DATABASE_URL` build arg is allowed (Global Constraints).
- [ ] **Step 4: Build tooling:** `docker build --target tooling -t rr-tooling .` → success.
- [ ] **Step 5: Inspect for leaks:** `docker run --rm --entrypoint sh rr-api -c 'id -u; ls -a /app; find / -name ".env*" -o -name "client_secret_*" 2>/dev/null | grep -v node_modules'` → uid ≠ 0 and no matches. `docker history --no-trunc rr-api | grep -i -E 'secret|password'` → no matches.
- [ ] **Step 6:** `git add Dockerfile .dockerignore next.config.ts package.json src/app/page.tsx "src/app/cities/[city]/page.tsx" && git commit -m "feat: backend Docker image (standalone runner + migrate/seed tooling)"`

### Task 3: Production compose stack, env contract and docs

**Files:** Create `docker-compose.prod.yml`, `.env.backend.example`; Modify `README.md`, `package.json`, `.gitignore` (add `.env.backend`).

**Interfaces:**
- Services: `db` (`postgres:16-alpine`, `POSTGRES_USER: rr`, `POSTGRES_DB: rajasthan`, `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env.backend}`, volume `rr_pgdata_prod`, `pg_isready` healthcheck, no `ports`); `migrate` (`build: {context: ., target: tooling}`, `depends_on: db: condition: service_healthy`, `restart: "no"`, env `DATABASE_URL`); `api` (`build: {context: ., target: runner}`, `depends_on: migrate: condition: service_completed_successfully`, `env_file: .env.backend`, `DATABASE_URL: postgres://rr:${POSTGRES_PASSWORD}@db:5432/rajasthan`, `ports: ["127.0.0.1:${API_PORT:-3001}:3000"]`, `restart: unless-stopped`, `stop_grace_period: 20s`).
- `.env.backend.example`: `POSTGRES_PASSWORD`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `API_PORT`; placeholders only, comment `generate secrets with: openssl rand -base64 48`; `NEXTAUTH_URL` documented as "the public URL users will visit; set when the frontend plan is decided".
- `package.json` scripts: `docker:up` = `docker compose -f docker-compose.prod.yml --env-file .env.backend up -d --build`, `docker:down` = `docker compose -f docker-compose.prod.yml --env-file .env.backend down`, `docker:logs`, `docker:seed` = `docker compose -f docker-compose.prod.yml --env-file .env.backend run --rm migrate npx tsx scripts/db-seed.ts` (manual only).
- README section "Run the backend in Docker": prerequisites, `cp .env.backend.example .env.backend`, `npm run docker:up`, health check `curl localhost:3001/api/health`, seed command, upgrade (`docker:up` rebuilds; migrations re-run idempotently), `down` keeps data (`down -v` deletes it), and that `next build` no longer needs a database. Frontend deployment is stated as planned separately.

- [ ] **Step 1: Write compose, env example, scripts, README, `.gitignore` entry.**
- [ ] **Step 2: Config checks:** `POSTGRES_PASSWORD= docker compose -f docker-compose.prod.yml config` → fails with the "set POSTGRES_PASSWORD" message; with a throwaway env file in the scratchpad dir (`POSTGRES_PASSWORD=test-pass-123`, `NEXTAUTH_SECRET=$(openssl rand -base64 48)`, dummy Google values) → config valid, `db` has no `ports`.
- [ ] **Step 3: Bring it up:** `docker compose -f docker-compose.prod.yml --env-file <scratch env> up -d --build` → `migrate` exits 0, `api` becomes `healthy` (`docker compose ... ps`), `curl -s localhost:3001/api/health` → `{"ok":true,"db":true,...}`, `curl -s localhost:3001/api/products` → `[]`.
- [ ] **Step 4: Seed + persistence:** run the seed command → `curl -s localhost:3001/api/products` returns the 4 seeded products; run it again → still 4; `docker compose ... restart api` and `down` then `up -d` (no `-v`) → still 4 products.
- [ ] **Step 5: Failure modes:** `docker compose ... stop db` → within ~30 s `curl -i localhost:3001/api/health` returns 503 without connection details; `start db` → health returns 200 again without restarting `api`; `time docker compose ... stop api` completes in < 20 s.
- [ ] **Step 6: Clean up:** `docker compose ... down` (keep scratch volume or remove with `-v` for the throwaway project), remove scratch env file; confirm dev DB (`rr-postgres`) and any user `next dev` untouched; `npm test` → PASS.
- [ ] **Step 7:** `git add docker-compose.prod.yml .env.backend.example README.md package.json .gitignore && git commit -m "feat: production compose stack (db, migrate, api) and docs"`

---

## Self-Review

- **Coverage:** image (T2), health/readiness (T1), migrations ordering and persistence (T3), secrets handling (T2 step 5, T3 step 2), docs (T3). All frontend/Vercel work removed per user instruction.
- **Types/names:** `rr-api` / `rr-tooling` tags, `rr_pgdata_prod` volume, `.env.backend`, `API_PORT` used consistently across tasks.
- **Risk:** T2 step 3 (build without a DB) has a defined fix (`force-dynamic` on any page that still prerenders); if `generateStaticParams` conflicts with `force-dynamic` on the cities page, drop `force-dynamic` there and make it ISR-free by keeping only `generateStaticParams` data that needs no DB (`CITIES` is static, but the page body calls `listProducts`, so `force-dynamic` is required, verify the build accepts it).
- **Not included (YAGNI):** frontend/Vercel, proxy, CORS, CI publishing, TLS, managed-Postgres variant.
