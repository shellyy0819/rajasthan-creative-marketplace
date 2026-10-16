# Rang Rajasthan — Creative Marketplace (Runnable Starter)

A small, runnable full-stack MVP for a Rajasthan handmade-products marketplace and local workshop discovery experience. Built with Next.js (App Router), Drizzle ORM and PostgreSQL (local Docker for development, [Neon](https://neon.tech) or any hosted Postgres for production). Sign-in is Google OAuth with buyer, seller and admin roles.

## Run it

Requirements: Node.js 20.9+ (22 recommended). Docker Desktop is needed for the local database and for the Docker backend; you can skip it by pointing `DATABASE_URL` at a hosted Postgres such as Neon.

```bash
npm install
cp .env.example .env.local   # fill in the auth values; DATABASE_URL is pre-filled for the Docker DB
npm run db:up                # Postgres 16 in Docker on localhost:5434 (your local Postgres on 5432 is untouched)
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000
npm run build && npm start   # production build (pages render on demand; the database must be reachable and migrated when the app runs)
npm test                     # unit tests (in-process PGlite, no Docker needed)
npm run test:pg              # concurrency tests against the Docker Postgres
BASE_URL=http://localhost:3000 npm run seo:check   # against a running server
```

### Using Neon instead of the local Docker database

1. In the Neon dashboard open **Connect**, copy the **pooled** string (host contains `-pooler`) and remove `&channel_binding=require` (the driver does not support it); keep `sslmode=require`.
2. Put it in `.env.local` as `DATABASE_URL="..."` (quoted).
3. Run migrations and seed with the **direct** string (pooling off in the dialog, no `-pooler`): `DATABASE_URL='<direct string>' npm run db:migrate` and `... npm run db:seed`.
4. Restart `npm run dev`. Next.js reads `.env.local` only at start and the app caches its connection, so an old dev server keeps using the old database. Check `http://localhost:3000/api/health` shows `"db":true`.

`npm run db:up` is not needed when `DATABASE_URL` points at Neon.

## Environment variables

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Postgres connection string (required) |
| `NEXTAUTH_URL` | public URL of the app, e.g. `http://localhost:3000`; Google redirect URI is `{NEXTAUTH_URL}/api/auth/callback/google` |
| `NEXTAUTH_SECRET` | signs session cookies (required; generate with `openssl rand -base64 48`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `ADMIN_EMAILS` | comma-separated Google emails that get the admin role |
| `NEXT_PUBLIC_SITE_URL` | canonical URL for SEO, sitemap and OG images |
| `MIGRATE_DATABASE_URL` | Docker backend only: direct (non-pooler) string for the migrate step |
| `API_PORT` | Docker backend only: host port (default 3001) |

`.env.local` and `.env.backend` are git-ignored. Never commit them or paste connection strings that contain the password.

## Run the backend in Docker

Builds the app as a production image and runs it against a hosted Postgres such as [Neon](https://neon.tech) (frontend deployment is planned separately).

```bash
cp .env.backend.example .env.backend   # fill in DATABASE_URL, NEXTAUTH_SECRET, Google and admin values
npm run docker:up                      # migrate (one-shot) -> api on 127.0.0.1:${API_PORT} (default 3001)
curl localhost:3001/api/health         # {"ok":true,"db":true,...}
npm run docker:seed                    # optional, manual only: idempotent import of data/db.json
npm run docker:logs                    # tail the api
npm run docker:down                    # stop the containers (the database lives in Neon and is untouched)
```

- `DATABASE_URL` is the **pooled** Neon string (host contains `-pooler`). Remove `&channel_binding=require` from it (the driver does not support it); keep `sslmode=require`. Optionally set `MIGRATE_DATABASE_URL` to the **direct** string (no `-pooler`) for the migrate step; it defaults to `DATABASE_URL`.
- Re-running `docker:up` after a code change rebuilds the image; migrations re-run and are idempotent. Seeding is never automatic.
- Only the API is published, on `127.0.0.1:${API_PORT:-3001}` (put a reverse proxy with TLS in front). The container has no `.env.local`: all settings come from `.env.backend` (see the table above; `docker compose` refuses to start if `DATABASE_URL` or `NEXTAUTH_SECRET` is empty).
- Google sign-in needs `NEXTAUTH_URL` to match the port you open and a matching redirect URI in Google Cloud. To test sign-in locally, stop `npm run dev` and set `API_PORT=3000` with `NEXTAUTH_URL=http://localhost:3000`.
- The image build downloads Google Fonts; if a build fails on a font fetch, re-run it.
- Deploying the frontend (Vercel) is planned separately: pages read the database directly today, so the frontend cannot yet be split from the backend.
- `/api/health` returns 503 when the database is unreachable (used by the container `HEALTHCHECK`).
- `next build` no longer needs a database: `/` and `/cities/*` render on demand.

## SEO

Server-rendered pages; per-page metadata + canonical; JSON-LD (Organization, WebSite + SearchAction, Product + Offer, Event, BreadcrumbList); `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`; dynamic OG images; filtered views are `noindex,follow` with canonical to the base list page; unknown slugs return real 404s. Pages: `/`, `/shop`, `/workshops`, `/products/[slug]`, `/workshops/[slug]`, `/cities/[city]`.

## Database

All data lives in PostgreSQL (schema in `src/db/schema.ts`, SQL migrations in `drizzle/`).

| Table | Purpose |
|---|---|
| `roles` | reference data: `seller` (1), `admin` (2). *Customer* is implicit (every signed-in user can buy and read) |
| `users` | one row per person (email unique case-insensitively, `google_sub` filled at first sign-in, `active` flag) |
| `user_roles` | **many-to-many** users ↔ roles (a user can be seller and admin), with who assigned it |
| `seller_profiles` | public name and contact (phone, email, Instagram, YouTube) shown on a seller's product pages |
| `products` | listing owned by `seller_id`; optional `workshop_id` (one workshop can feature many products), `pickup_location` (admin/seller only), `published_by`/`published_at` |
| `workshops` | hosted sessions (`starts_at` is stored as a timestamp; the API still shows `date` and `time` in India time) |
| `orders`, `order_items`, `bookings` | demo checkout; orders/bookings point at `users`; items and bookings keep a copy of names with no foreign key so history survives deletes |
| `categories` | product categories (user-creatable, unique ignoring case, max 100); `products.category` references the name |
| `id_counters` | `p`/`w` id counters (ids are never reused) |

| Command | What it does |
|---|---|
| `npm run db:up` / `db:down` / `db:logs` | start / stop / tail the local dev Postgres container (data stays in the `rr_pgdata` volume; `docker compose down -v` deletes it). Not needed when using Neon |
| `npm run docker:up` / `docker:down` / `docker:logs` / `docker:seed` | build/run, stop, tail and seed the production backend container (see above) |
| `npm run db:migrate` | apply migrations (also installs the `pg_trgm` extension used by search) |
| `npm run db:generate` | create a new migration after editing `src/db/schema.ts` |
| `npm run db:seed` | idempotent import of `data/db.json` (creates a seller user + profile per seller name) |
| `npm run db:reset` | wipe all tables (including users and role assignments, but not the `roles` list) and re-seed |

The credentials in `docker-compose.yml` / `.env.example` (`rr` / `rr_dev_password`) are for local development only; in production use a managed Postgres (Neon) and a secret `DATABASE_URL`. Use the pooled Neon string for the running app and the direct string for migrations and seeding. The container publishes `127.0.0.1:5434` (not 5432) so it never collides with a locally installed Postgres. Stock and workshop seats are changed inside transactions with row locks, and role/admin changes take an advisory lock; `npm run test:pg` proves both against the real database. `data/db.json` is only the seed source and is never written by the app.

## Roles

| Role | Can do |
|---|---|
| Buyer (any signed-in user) | read the catalog; demo orders and bookings |
| Seller | create, read, edit and archive **their own** products (always Draft or Archived, never published); edit their public profile (`My profile`). Editing a published product returns it to Draft for admin review. Cannot delete products or touch workshops |
| Admin | everything: publish products, delete products/workshops, manage users and roles at `/admin/users`, edit any seller's profile, assign a product's seller |

Admins come from `ADMIN_EMAILS` (bootstrap, never locked out) or an `admin` row in `user_roles`. Roles are looked up on every request, so granting, revoking or deactivating takes effect immediately. A user who owns products, workshops, orders or bookings cannot be deleted; deactivate them instead. The last active admin cannot be removed. Deleting a workshop keeps its products (they just lose the link).

## Pickup-location suggestions

The product form's **Pickup location** field suggests places as you type (areas, cities, landmarks across India, Rajasthan first), like a map search box: `udai` offers *Udaipur, Rajasthan*, `ambra` offers *Ambrai Ghat, Udaipur*. Any text is still accepted. Suggestions come from [Photon](https://photon.komoot.io) (free, no API key, OpenStreetMap data © OpenStreetMap contributors) through `GET /api/places?q=`, which is limited to signed-in sellers and admins, capped at 60 lookups a minute per user, and cached for 10 minutes. Photon is fair-use with no uptime promise: if it is down the field simply works as plain text. For heavy traffic, self-host Photon or swap the one function in `src/lib/places.ts`.

## Search

`GET /api/products?q=` and `GET /api/workshops?q=` (and the admin list) are typo-tolerant: an exact substring match always counts, and queries with a word of 4+ letters also match by trigram similarity (`pg_trgm`), so `crochat` finds *Crochet*. Exact matches rank first; unrelated text returns nothing.

## Included and working

- Responsive storefront with sample handmade products.
- Google sign-in with buyer, seller and admin roles (admin UI for users and artists' posts; sellers manage their own products).
- Product search (typo-tolerant), city filter, user-created category filter.
- Pickup-location suggestions, product detail dialog in the admin list.
- Docker production image and compose stack running against a hosted Postgres.
- Bag/cart with quantities and subtotal.
- Demo order creation via API; stock decrements transactionally in Postgres.
- Workshop discovery with search, city filter, free/paid filter.
- Demo workshop reservations; capacity is checked and updated under a row lock.
- Basic API error handling and Postgres persistence.

## Important limitations — not production-ready

This is a **working prototype**, not a production marketplace. It intentionally does not process payments. Paid orders and paid workshop reservations are marked as demo records only. There is no payment provider integration, shipping workflow, tax handling or email delivery, and operations such as backups and monitoring are still basic (rely on your Postgres host, e.g. Neon branches and backups). The seller CTA is a mailto placeholder. The frontend is not yet deployable separately from the backend (see "Run the backend in Docker").

Before public launch, add seller/venue/organizer approvals, implement inventory and booking holds, integrate a marketplace-approved payment/settlement provider, verify webhooks, add refunds/financial ledger/audit logs, and complete security, legal, privacy, tax, backup, and operational checks.

## API endpoints and auth

Sign-in is Google OAuth through NextAuth v4 (`/api/auth/*`). Copy `.env.example` to `.env.local` and set the auth variables from the table above. Emails listed in `ADMIN_EMAILS` get the `admin` role; any other verified Google account is a `customer`.

| Endpoint | Access |
|---|---|
| `GET /api/health` | public |
| `GET /api/products?city=&category=&q=` | public |
| `GET /api/workshops?city=&type=&q=` | public |
| `POST /api/products`, `PATCH /api/products/:id` | admin or seller (sellers: own products, never publish) |
| `DELETE /api/products/:id` | admin only |
| `GET /api/categories` | public: the category names |
| `POST /api/categories` `{ name }` | admin or seller: creates a category (201), or returns the existing one (200) |
| `POST /api/workshops`, `PATCH` / `DELETE /api/workshops/:id` | admin only |
| `POST /api/orders` `{ customerName, email, items:[{productId,quantity}] }` | signed in (owner = session email) |
| `GET /api/orders` | signed in: own orders; admin: all |
| `POST /api/bookings` `{ workshopId, attendeeName, email, quantity }` | signed in |
| `GET /api/bookings` | signed in: own; admin: all |
| `GET /api/admin/summary` | admin only |
| `GET /api/admin/artists` | admin or seller (sellers: own products only) |
| `GET /api/admin/products` (`?artist=&status=APPROVED\|DRAFT\|ARCHIVED&q=`) | admin or seller (sellers: own products only), includes drafts, `no-store` |
| `GET /api/admin/products/:id` | admin or seller (own) |
| `GET\|PUT /api/profile` | seller or admin: own public profile |
| `GET /api/admin/users`, `POST /api/admin/users` | admin only |
| `PATCH\|DELETE /api/admin/users/:id` | admin only (roles, active; delete blocked when the user owns data) |
| `GET\|PUT /api/admin/users/:id/profile` | admin only |

Errors: `401 {"error":"Authentication required."}`, `403 {"error":"Admin access required."}`. The API is same-origin only (no CORS); cookies are SameSite=Lax.

## Admin: artists' posts

Signed in as an admin (email in `ADMIN_EMAILS`) or a seller, open **/admin/posts** (the header shows an **Admin** link; sellers see **My products**). Anonymous visitors are redirected to sign-in; other users get a 404. `/admin/users` (user and role management) is admin only.

- A *post* is a product listing; an *artist* is the product's seller name (case-insensitive, so `Shauk and Stuff` and `shauk  and stuff` are one artist). Renaming the seller on a post moves it to another artist.
- New posts default to **Draft**. **Published** posts are public; **Draft** and **Archived** posts are visible only in the admin view and the admin APIs. Only admins can publish.
- Click a row to see all of a post's details. Create/edit/delete use the product APIs (`POST /api/products`, `PATCH`/`DELETE /api/products/:id`); delete is admin only and asks for confirmation.
- The cover image is a URL field (**https only**); if it fails to load the card falls back to the illustrated placeholder.

## Reset sample data

`npm run db:reset` wipes the database and re-imports `data/db.json`.

## Suggested next build

Build the production foundation in increments: (1) deploy the backend (Docker image + Neon, done) and the frontend (Vercel, to be planned), backups and monitoring, (2) finer-grained role/resource guards, (3) seller onboarding and admin moderation, (4) product/order lifecycle, (5) approved marketplace payment flow and ledger, (6) workshop capacity and bookings, (7) shipping, emails, audit trail, monitoring and deployment.
