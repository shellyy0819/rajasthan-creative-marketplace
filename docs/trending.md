# Trending products and likes

## What trends
Only **published** products. The window is the last **7 days** (events by UTC day, likes by time).

Per product, four signals are counted:

| Signal | Counted as | Weight |
|---|---|---|
| Product views | unique visitors who opened the product page | 35% |
| Contact clicks | unique visitors who clicked phone, email, Instagram or YouTube | 25% |
| Artist-profile visits | unique visitors who went from the product to the artist page | 20% |
| Likes | likes in the window | 20% |

Each signal is divided by the highest value of that signal across products (so it is 0 to 1), then multiplied by its weight and summed.
Example: product A has 10 views and nothing else, product B has 5 views, 4 contact clicks, 2 artist visits and 10 likes.
A = 0.35. B = 0.35 x 0.5 + 0.25 + 0.20 + 0.20 = 0.825. B ranks first.
Products with no signal in the window are left out. Ties: more likes first, then the newer product.
After ranking, at most **one product per artist** is kept (their best), then the first 6 are shown (24 on `/trending`).
Weights live in `WEIGHTS` in `src/lib/trending.ts`; the maths is covered by `tests/trending-score.test.ts`.

## What is stored
- **Likes** (`product_likes`): one row per product and actor. A signed-in visitor is `u:<email>`; everyone else is `v:<random id>` from the `rr_vid` cookie (HttpOnly, one year, set only when liking). Anonymous likes are per browser.
- **Events** (`product_events`): one row per product, type, visitor and UTC day. The visitor is `h:` plus a salted hash of day, IP and user agent. The IP and user agent are never stored and the hash changes every day. Known bots are ignored.
- Events are counted without the GA4 consent banner because nothing stored can be linked across days. GA4 itself still loads only after consent (see `docs/analytics.md`).

## Settings
`ANALYTICS_SALT`: long random value for production (falls back to `NEXTAUTH_SECRET`). Changing it only resets today's unique-visitor identity.

## Abuse limits
Writes need `Content-Type: application/json` (blocks cross-site form posts). Likes: 30 per minute per actor. Events: 120 per minute per IP. The limiter is in memory, per process; use a shared store if you run several containers.
Clearing cookies lets a visitor like again, so anonymous likes can be inflated slowly; the rate limit and normalised scoring limit the effect.

## Reverse proxy requirement
Event and like limits and the daily visitor hash use the client address from `X-Forwarded-For` (first entry), then `X-Real-IP`. Run the app behind a proxy that sets it from the real connection and does not pass a client-supplied value through (Caddy's `reverse_proxy` does this by default, see `docs/subdomains.md`). Without a proxy header every visitor shares one address and the limits are shared by the whole site.

## Housekeeping
`product_events` grows by one row per product, type, visitor and day. Trending reads only 7 days, so old rows can be deleted safely:
```sql
delete from product_events where day < current_date - 90;
```
