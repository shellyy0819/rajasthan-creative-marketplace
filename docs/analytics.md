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
