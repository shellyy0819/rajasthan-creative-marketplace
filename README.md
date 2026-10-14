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

## API endpoints

- `GET /api/health`
- `GET /api/products?city=Udaipur&category=Crochet%20%26%20Textiles&q=flower`
- `GET /api/workshops?city=Jaipur&type=PAID&q=paint`
- `POST /api/orders` — `{ "customerName": "Demo", "email": "demo@example.com", "items": [{ "productId": "p1", "quantity": 1 }] }`
- `POST /api/bookings` — `{ "workshopId": "w1", "attendeeName": "Demo", "email": "demo@example.com", "quantity": 1 }`
- `GET /api/admin/summary` — demo metrics only; not protected

## Reset sample data

Orders and bookings write `data/db.json`. Restore the seed with `git checkout data/db.json`.

## Suggested next build

Build the production foundation in increments: (1) PostgreSQL/Prisma behind the existing repository layer (Next route handlers or NestJS), (2) auth and role/resource guards, (3) seller onboarding and admin moderation, (4) product/order lifecycle, (5) approved marketplace payment flow and ledger, (6) workshop capacity and bookings, (7) shipping, emails, audit trail, monitoring and deployment.
