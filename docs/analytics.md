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

## 5. Category-page events
| Event | When | Parameters |
|---|---|---|
| `category_click` | a link to a category page is clicked | `category_slug`, `source` (`home` block or `index` list) |
| `view_item_list` | a category page is shown (once per page of the list) | `item_list_id` and `item_list_name` (the category slug), `page` |
| `select_item` | a product is opened from a category page | `item_id`, `item_list_id`, `item_list_name` |
| `contact_seller` and `contact_<method>` | unchanged, plus `item_category` (the product's category) when the contact is about a product | |

To report on `category_slug`, `source`, `item_list_name`, `item_category` and `page`, register each as an **event-scoped custom dimension** in GA4 (Admin, Custom definitions). They only fill from the day they are registered.

## 6. Share event
The Share button (product, workshop, artist and category pages) sends one GA4 event, `share`, when a visitor picks a way to share.

| Parameter | Value |
|---|---|
| `method` | `whatsapp`, `sms` (Messages), `email`, `copy_link`, `instagram`, `facebook`, or `native` (the phone's own share sheet, where Instagram and other apps are) |
| `content_type` | `product`, `workshop`, `artist` or `category` |
| `item_id` | the product or workshop id (not sent for artist and category pages) |

Links shared to WhatsApp, Messages, Email, Instagram, Facebook and the phone's share sheet carry `?utm_source=<method>&utm_medium=share`, so visits that come from shares appear in Reports, Acquisition, Traffic acquisition (Session source / medium). Copy adds nothing, because we cannot know where the link is pasted. The address is built from the hostname the page is open on.

Register `method` and `content_type` as event-scoped custom dimensions to report on them. Who sees the button is set under Dashboard, Settings, Sharing (admins only, or everyone).

## 7. Key events checklist
GA4 does not mark any event as a key event on its own, so **Key events** reads 0 until someone does it in GA4 (nothing to change in code). The site already sends every event below.

In GA4: Admin, Data display, **Events**, then switch on **Mark as key event** for each row. An event is listed only after it has fired once. If it is missing, go to Admin, Key events, **New key event** and type the exact name. Key events count from the day they are marked; earlier days stay at 0.

| Mark as key event | Event | Sent when |
|---|---|---|
| Yes | `contact_seller` | a real contact action on a product, artist page or workshop (call, WhatsApp, email, Instagram, YouTube, website). Not when the contact sheet is merely opened. Parameters `seller_id` or `workshop_id`, `contact_method` |
| Optional (see note) | `workshop_inquiry` | a real contact action on a workshop or online class (WhatsApp, call, Instagram, website, copied number). Same parameters as `contact_seller` (`workshop_id`, `contact_method`, `content_type`, `placement`). Never sent for products |
| Yes | `reserve_complete` | a workshop reservation was saved |
| Yes | `sign_up` | the server confirmed a new account |
| Yes | `listing_submit` | the server confirmed a new listing |
| Optional | `host_form_submit` | the host-a-workshop form was accepted |

Do not also mark `contact_whatsapp`, `contact_call`, `contact_email`, `contact_instagram`, `contact_youtube` or `contact_website`. Each contact click sends `contact_seller` and the method's own event, so marking both counts one click twice. Use the method events in reports (or the `contact_method` parameter, once registered as an event-scoped custom dimension) to split contacts by channel.

Names that sometimes appear in suggestions but are **not** sent by this site: `seller_registration` and `listing_submission`. Use `sign_up` and `listing_submit` instead.

`workshop_inquiry` is sent together with `contact_seller` for workshops. If both are marked, one workshop contact counts twice in the Key events total. Mark `contact_seller` for all contacts, and read `workshop_inquiry` as a report column; mark it as a key event only if you prefer to leave `contact_seller` unmarked.

### Check it works
1. Open the site, click **Accept** on the cookie banner, click a contact button.
2. Admin, DebugView (or Reports, Realtime) shows `contact_seller`.
3. After about a day the event shows a key-event flag and Home, Key events counts it.

The dashboard's Seller engagement page counts contacts from product and workshop pages only. Contacts made from an artist's own page are in GA4 only, so GA4's number is the higher one.
