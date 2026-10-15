# Rang Rajasthan — Creative Marketplace (Runnable Starter)

A small, runnable full-stack MVP for a Rajasthan handmade-products marketplace and local workshop discovery experience. Built with Next.js (App Router) and a JSON-file store, so no database service is required for the demo.

## Run it

Requirements: Node.js 20.9+ (required by current Next.js).

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL to your real origin in production
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm test                     # unit tests
BASE_URL=http://localhost:3000 npm run seo:check   # against a running server
```

## SEO

Server-rendered pages; per-page metadata + canonical; JSON-LD (Organization, WebSite + SearchAction, Product + Offer, Event, BreadcrumbList); `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`; dynamic OG images; filtered views are `noindex,follow` with canonical to the base list page; unknown slugs return real 404s. Pages: `/`, `/shop`, `/workshops`, `/products/[slug]`, `/workshops/[slug]`, `/cities/[city]`.

## Deploy note

Orders and bookings write `data/db.json`, so deploy on a host with a persistent writable disk (single Node process). Serverless or read-only filesystems need the PostgreSQL step below first.

## Included and working

- Responsive storefront with sample handmade products.
- Product search, city filter, category filter.
- Bag/cart with quantities and subtotal.
- Demo order creation via API; stock decrements and persists to `data/db.json`.
- Workshop discovery with search, city filter, free/paid filter.
- Demo workshop reservations; capacity updates and persists.
- Basic API error handling and JSON-backed local persistence.

## Important limitations — not production-ready

This is a **working local prototype**, not a production marketplace. It intentionally does not process payments. Paid orders and paid workshop reservations are marked as demo records only. There is no real user authentication, seller dashboard, admin moderation UI, payment provider integration, shipping workflow, tax handling, email delivery, or hardened concurrency protection. The JSON file is suitable for local demonstration only and can be corrupted by concurrent writes. The seller CTA is a mailto placeholder.

Before public launch, replace the demo persistence with PostgreSQL + Prisma, add authenticated roles and seller/venue/organizer approvals, implement inventory and booking holds with transactional locking, integrate a marketplace-approved payment/settlement provider, verify webhooks, add refunds/financial ledger/audit logs, and complete security, legal, privacy, tax, backup, and operational checks.

## API endpoints and auth

Sign-in is Google OAuth through NextAuth v4 (`/api/auth/*`). Copy `.env.example` to `.env.local` and set `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `{NEXTAUTH_URL}/api/auth/callback/google`). Emails listed in `ADMIN_EMAILS` get the `admin` role; any other verified Google account is a `customer`.

| Endpoint | Access |
|---|---|
| `GET /api/health` | public |
| `GET /api/products?city=&category=&q=` | public |
| `GET /api/workshops?city=&type=&q=` | public |
| `POST /api/products`, `PATCH` / `DELETE /api/products/:id` | admin only |
| `POST /api/workshops`, `PATCH` / `DELETE /api/workshops/:id` | admin only |
| `POST /api/orders` `{ customerName, email, items:[{productId,quantity}] }` | signed in (owner = session email) |
| `GET /api/orders` | signed in: own orders; admin: all |
| `POST /api/bookings` `{ workshopId, attendeeName, email, quantity }` | signed in |
| `GET /api/bookings` | signed in: own; admin: all |
| `GET /api/admin/summary` | admin only |
| `GET /api/admin/artists` | admin only (artists grouped by seller name, with published/draft counts) |
| `GET /api/admin/products` (`?artist=&status=APPROVED\|DRAFT&q=`) | admin only, includes drafts, `no-store` |
| `GET /api/admin/products/:id` | admin only |

Errors: `401 {"error":"Authentication required."}`, `403 {"error":"Admin access required."}`. The API is same-origin only (no CORS); cookies are SameSite=Lax.

## Admin: artists' posts

Signed in as an admin (email in `ADMIN_EMAILS`), open **/admin/posts** (the header shows an **Admin** link). Anonymous visitors are redirected to sign-in; non-admins get a 404.

- A *post* is a product listing; an *artist* is the product's seller name (case-insensitive, so `Shauk and Stuff` and `shauk  and stuff` are one artist). Renaming the seller on a post moves it to another artist.
- **Published** posts are public; **Draft** posts are visible only in the admin view and the admin APIs.
- Create/edit/delete use the admin product APIs (`POST /api/products`, `PATCH`/`DELETE /api/products/:id`). Delete asks for confirmation.
- The cover image is a URL field (**https only**); if it fails to load the card falls back to the illustrated placeholder.

## Reset sample data

Orders and bookings write `data/db.json`. Restore the seed with `git checkout data/db.json`.

## Suggested next build

Build the production foundation in increments: (1) PostgreSQL/Prisma behind the existing repository layer (Next route handlers or NestJS), (2) auth and role/resource guards, (3) seller onboarding and admin moderation, (4) product/order lifecycle, (5) approved marketplace payment flow and ledger, (6) workshop capacity and bookings, (7) shipping, emails, audit trail, monitoring and deployment.
