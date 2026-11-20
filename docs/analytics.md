# Google Analytics 4 (GA4)

The public shop sends page views to GA4, but only after the visitor accepts the cookie banner. The dashboard is never tracked.

## 1. Create the property
1. analytics.google.com, Admin, Create property.
2. Add a **Web** data stream with the site URL.
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`).

## 2. Configure
Set `GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env.local` (development) or `.env.backend` (production).
It is a runtime variable: restart the server or run `docker compose -f docker-compose.prod.yml --env-file .env.backend up -d`. No rebuild is needed.
Empty or malformed value: no banner is shown and nothing is loaded.

## 2b. Turn off history-based page views in GA4
The site sends its own `page_view` on every page change. In GA4: Admin, Data streams, your web stream, Enhanced measurement, the gear icon, and **switch off "Page changes based on browser history events"**. Left on, GA4 can count each client-side navigation twice and can also record page changes inside the dashboard.

## 3. Verify
- Open the site, click **Accept**. The Realtime report shows you within a minute. DebugView shows the events in detail.
- Before Accept, or after Decline, there are no requests to `googletagmanager.com` or `google-analytics.com` and no `_ga*` cookies.
- The footer link **Cookie settings** reopens the banner. Choosing Decline switches GA off at once and deletes the `_ga` cookies.

## 4. What "unique views" means in GA4
GA4 has no "unique pageviews" metric. Use:
- **Views**: every page view.
- **Users / Active users**: unique visitors.

Both are per page in Reports, Engagement, Pages and screens. Custom events (`like`, `contact_click`, ...) appear under Events after about 24 hours.

## Notes
- Visitors who decline or block cookies are not counted.
- Never tracked: the dashboard host (`DASHBOARD_URL`) and any path under `/dashboard` or `/admin`.
- Page views are sent once per distinct URL, query string included.
- GA4 anonymises IP addresses by default.
- Consent is stored in the browser (`localStorage`, key `rr_consent`), not per account.

## 5. Share event
The Share button (product, workshop, artist and category pages) sends one GA4 event, `share`, when a visitor picks a way to share.

| Parameter | Value |
|---|---|
| `method` | `whatsapp`, `sms` (Messages), `email`, `copy_link`, `instagram`, `facebook`, or `native` (the phone's own share sheet, where Instagram and other apps are) |
| `content_type` | `product`, `workshop`, `artist` or `category` |
| `item_id` | the product or workshop id (not sent for artist and category pages) |

Links shared to WhatsApp, Messages, Email, Instagram, Facebook and the phone's share sheet carry `?utm_source=<method>&utm_medium=share`, so visits that come from shares appear in Reports, Acquisition, Traffic acquisition (Session source / medium). Copy adds nothing, because we cannot know where the link is pasted. The address is built from the hostname the page is open on.

Register `method` and `content_type` as event-scoped custom dimensions to report on them. Who sees the button is set under Dashboard, Settings, Sharing (admins only, or everyone).
