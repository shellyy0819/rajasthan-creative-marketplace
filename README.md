# Rang Rajasthan — Creative Marketplace (Runnable Starter)

A small, runnable full-stack MVP for a Rajasthan handmade-products marketplace and local workshop discovery experience. Built with Next.js (App Router), Drizzle ORM and PostgreSQL running in Docker.

## Run it

Requirements: Node.js 20.9+ (22 recommended) and Docker Desktop.

```bash
npm install
cp .env.example .env.local   # fill in the auth values; DATABASE_URL is pre-filled for the Docker DB
npm run db:up                # Postgres 16 in Docker on localhost:5434 (your local Postgres on 5432 is untouched)
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000
npm run build && npm start   # production (the database must be running and migrated)
npm test                     # unit tests (in-process PGlite, no Docker needed)
npm run test:pg              # concurrency tests against the Docker Postgres
BASE_URL=http://localhost:3000 npm run seo:check   # against a running server
```

## Run the backend in Docker

Builds the app as a production image and runs it with Postgres (frontend deployment is planned separately).

```bash
cp .env.backend.example .env.backend   # fill in POSTGRES_PASSWORD, NEXTAUTH_SECRET, Google and admin values
npm run docker:up                      # db -> migrate (one-shot) -> api on 127.0.0.1:3001
curl localhost:3001/api/health         # {"ok":true,"db":true,...}
npm run docker:seed                    # optional, manual only: idempotent import of data/db.json
npm run docker:logs                    # tail the api
npm run docker:down                    # stop; data stays in the rr_pgdata_prod volume (`down -v` deletes it)
```

- Re-running `docker:up` after a code change rebuilds the image; migrations re-run and are idempotent. Seeding is never automatic.
- Postgres is not published to the host; only the API is, on `127.0.0.1:${API_PORT:-3001}` (put a reverse proxy with TLS in front).
- `/api/health` returns 503 when the database is unreachable (used by the container `HEALTHCHECK`).
- `next build` no longer needs a database: `/` and `/cities/*` render on demand. This is separate from the dev database below (`npm run db:up`, port 5434).

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
| `npm run db:up` / `db:down` / `db:logs` | start / stop / tail the container (data stays in the `rr_pgdata` volume; `docker compose down -v` deletes it) |
| `npm run db:migrate` | apply migrations (also installs the `pg_trgm` extension used by search) |
| `npm run db:generate` | create a new migration after editing `src/db/schema.ts` |
| `npm run db:seed` | idempotent import of `data/db.json` (creates a seller user + profile per seller name) |
| `npm run db:reset` | wipe all tables (including users and role assignments, but not the `roles` list) and re-seed |

The credentials in `docker-compose.yml` / `.env.example` (`rr` / `rr_dev_password`) are for local development only; in production use a managed Postgres and a secret `DATABASE_URL`. The container publishes `127.0.0.1:5434` (not 5432) so it never collides with a locally installed Postgres. Stock and workshop seats are changed inside transactions with row locks, and role/admin changes take an advisory lock; `npm run test:pg` proves both against the real database. `data/db.json` is only the seed source and is never written by the app. Pages render from the database on demand, so it must be up and migrated when the app runs.

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
- Product search, city filter, category filter.
- Bag/cart with quantities and subtotal.
- Demo order creation via API; stock decrements transactionally in Postgres.
- Workshop discovery with search, city filter, free/paid filter.
- Demo workshop reservations; capacity is checked and updated under a row lock.
- Basic API error handling and Postgres persistence.

## Important limitations — not production-ready

This is a **working local prototype**, not a production marketplace. It intentionally does not process payments. Paid orders and paid workshop reservations are marked as demo records only. There is no real user authentication, seller dashboard, admin moderation UI, payment provider integration, shipping workflow, tax handling, email delivery, or hardened production operations (backups, pooling, monitoring). The seller CTA is a mailto placeholder.

Before public launch, add seller/venue/organizer approvals, implement inventory and booking holds, integrate a marketplace-approved payment/settlement provider, verify webhooks, add refunds/financial ledger/audit logs, and complete security, legal, privacy, tax, backup, and operational checks.

## API endpoints and auth

Sign-in is Google OAuth through NextAuth v4 (`/api/auth/*`). Copy `.env.example` to `.env.local` and set `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `{NEXTAUTH_URL}/api/auth/callback/google`). Emails listed in `ADMIN_EMAILS` get the `admin` role; any other verified Google account is a `customer`.

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

Signed in as an admin (email in `ADMIN_EMAILS`), open **/admin/posts** (the header shows an **Admin** link). Anonymous visitors are redirected to sign-in; non-admins get a 404.

- A *post* is a product listing; an *artist* is the product's seller name (case-insensitive, so `Shauk and Stuff` and `shauk  and stuff` are one artist). Renaming the seller on a post moves it to another artist.
- **Published** posts are public; **Draft** posts are visible only in the admin view and the admin APIs.
- Create/edit/delete use the admin product APIs (`POST /api/products`, `PATCH`/`DELETE /api/products/:id`). Delete asks for confirmation.
- The cover image is a URL field (**https only**); if it fails to load the card falls back to the illustrated placeholder.

## Reset sample data

`npm run db:reset` wipes the database and re-imports `data/db.json`.

## Suggested next build

Build the production foundation in increments: (1) managed Postgres, backups and connection pooling for production, (2) finer-grained role/resource guards, (3) seller onboarding and admin moderation, (4) product/order lifecycle, (5) approved marketplace payment flow and ledger, (6) workshop capacity and bookings, (7) shipping, emails, audit trail, monitoring and deployment.
