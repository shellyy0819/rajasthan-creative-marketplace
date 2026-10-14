# Rang Rajasthan — Creative Marketplace (Runnable Starter)

A small, runnable full-stack MVP for a Rajasthan handmade-products marketplace and local workshop discovery experience. It uses Node.js built-ins only, so no dependency installation or database service is required for the demo.

## Run it

Requirements: Node.js 18 or newer.

```bash
cd rajasthan-creative-marketplace
npm start
```

Open **http://localhost:3000**. The API health check is **http://localhost:3000/api/health**.

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

Stop the server and restore `data/db.json` from the original zip, or copy the JSON shown in the initial `data/db.json` file before testing orders/bookings. The server writes inventory, booking capacity, orders and bookings to that file.

## Suggested next build

Build the production foundation in increments: (1) Next.js + NestJS + PostgreSQL/Prisma, (2) auth and role/resource guards, (3) seller onboarding and admin moderation, (4) product/order lifecycle, (5) approved marketplace payment flow and ledger, (6) workshop capacity and bookings, (7) shipping, emails, audit trail, monitoring and deployment.
