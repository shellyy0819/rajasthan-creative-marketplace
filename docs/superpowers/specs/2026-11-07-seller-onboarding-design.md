# Seller self-signup onboarding: design

Date: 2026-11-07. Status: draft for approval. Visual reference: Design canvas "Seller Onboarding Screens" (claude.ai/artifact/FNKqzec7x2GTnskZSWb5b5, boards 1 to 5) and entry-point mock (claude.ai/artifact/KcYZpjEFKoq41JrBoFtjXo, option B).

## Intent

Today a maker becomes a seller only after submitting the "List your craft" request and an admin confirming it. Craftofy wants makers to sign themselves up: sign in with Google, give a few details, and start listing. The admin still decides what goes live, because every new product stays hidden until an admin publishes it.

## Goals

- A signed-out visitor sees "Are you a seller? Login here" in the top navbar and can reach Google sign-in from it.
- A Google account with no seller role goes through a short two-step onboarding (about three minutes), then becomes a seller immediately, with no admin approval to join.
- After finishing, the maker lands on `/dashboard/posts` with the existing product form open, to add their first product.
- Existing sellers and admins who sign in go straight to the dashboard, as today.
- Inline, field-level error handling on every onboarding field, on the client and the server.

## Non-goals

- No customer accounts or customer sign-in. Only makers sign in, so Google sign-in always means seller onboarding.
- No SMS or OTP verification of the mobile number (the design says "We do not send a code").
- No new product form. The first-product step reuses `PostForm` and `PostsAdmin` unchanged apart from opening the form on arrival.
- No change to any seller-versus-admin restriction (see Constraints).
- No payments, KYC, GST or PAN capture.

## Anti-goals

- A seller who can publish, delete, or see other sellers' data because onboarding bypassed an existing gate.
- A role granted to a deactivated user, or to an account with an unverified Google email.
- A half-created seller (role granted, profile empty) with no way back into onboarding.
- Any visible regression for signed-in sellers and admins in the navbar, dashboard or footer.

## Constraints

- Reuse the existing UI and components. Match the look of what is built (DM Sans, existing tokens in `src/app/globals.css`, existing form, button and error styles). Use the `rang-rajasthan-design` skill rules for any new UI.
- Seller-versus-admin restrictions stay exactly as they are unless the user says otherwise: sellers cannot set APPROVED, cannot delete, see no seller picker, never see seller emails. New products by sellers stay DRAFT.
- This Next.js version has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing routing, proxy or page code. Routing interception is `src/proxy.ts`, not `middleware.ts`.
- Google is the only sign-in provider. Roles are re-resolved on every session read (`resolveAccess`), so a new seller role works on the next request without re-login.
- Sign-in must start on the public host, which owns the OAuth cookies. In split-host mode the dashboard lives on `hostConfig().dashboardOrigin`, so redirects to `/dashboard/*` must be absolute there.
- Schema changes go through drizzle: edit `src/db/schema.ts`, run `npm run db:generate`, add migration 0013. Tests use PGlite with all migrations.

## Decisions made by the user

1. Self-signup replaces the "List your craft" request form. The button sends makers into the Google sign-in flow.
2. Finishing onboarding makes the person a seller immediately. No admin approval to join. Products stay hidden until an admin publishes them.
3. The first-product step reuses the existing `/dashboard/posts` UI and `PostForm`. Seller-versus-admin restrictions remain.
4. No customer sign-in exists. Google sign-in equals seller onboarding.
5. Entry point is the navbar, signed out only: "Are you a seller? Login here". On phones it shortens to a "Seller login" button. The green strip keeps "Handmade, direct from the maker". Signed-in navbar is unchanged.
6. Step 2 reuses the existing city picker (state filled from the city), categories list, image uploader and phone and Instagram validation.

## Flow

1. **Entry.** Signed-out navbar link calls `signIn('google', { callbackUrl: <start route> })`. A signed-out visitor who opens the start route directly sees board 1 (Welcome) with "Continue with Google" (same call).
2. **Start route (server).** After Google, a server page decides: admin or seller goes to the dashboard (absolute dashboard origin in split-host mode); anyone else continues to onboarding. A deactivated user is refused at sign-in as today.
3. **Step 1 of 2, "You".** Full name (prefilled from Google, required), email (read-only, "Verified by Google"), mobile number (+91, 10 digits, required, no code sent). Stored privately; customers do not see it unless Phone is chosen as a contact method.
4. **Step 2 of 2, "Your craft".** Business or brand name, category, short description (max 200 characters, counter), city (pick from list, state fills in read-only), Instagram handle and website (at least one required), logo or profile photo (optional; square, at least 400 by 400, JPG or PNG), and how customers reach you (WhatsApp, Instagram, Website, Phone; at least one; WhatsApp number defaults to the mobile number via a "Same as my mobile number" checkbox; Instagram and Website reuse the values entered above).
5. **Finish and add my first product.** First an information dialog appears (user request): new products first go into draft state, and once an admin reviews them they are published automatically; the maker confirms to continue (cancel returns to the form, nothing is submitted). Then one server call validates everything and, in a single transaction, grants the seller role and saves the profile. Then redirect to `/dashboard/posts` with the "New post" form already open. Board 5 ("You are in") is a short interstitial before that redirect or the page the maker sees if they choose "Go to my dashboard" instead of adding a product at once.
6. **Returning visitors.** A roleless account that stops midway and signs in again restarts onboarding (draft answers kept in `sessionStorage` for the session). A seller created another way (for example by an admin) is never forced through onboarding or blocked from the dashboard. If they open onboarding themselves, the endpoint runs in "complete profile" mode (see Server behaviour).

## Data

Existing: `users` (name, phone unused so far), `user_roles` (seller, admin), `seller_profiles` (display_name, public_phone, public_email, instagram, youtube, bio, city_id). City state lives on the `cities` row.

Mapping of onboarding fields:

| Field | Stored in |
|---|---|
| Full name | `users.name` |
| Mobile number (private) | `users.phone` (existing, unused) |
| Business or brand name | `seller_profiles.display_name` (this is the public seller name shown on posts) |
| Short description | `seller_profiles.bio` (onboarding caps it at 200; profile dialog keeps 500) |
| City, state | `seller_profiles.city_id` (state comes from the city) |
| Instagram | `seller_profiles.instagram` |
| Website | new `seller_profiles.website` |
| Category | new `seller_profiles.category` (name from the categories list) |
| Logo | new `seller_profiles.logo_url` (public image URL) |
| WhatsApp number | new `seller_profiles.whatsapp` |
| Contact methods | new `seller_profiles.contact_methods` (subset of whatsapp, instagram, website, phone) |
| Phone contact method | sets `seller_profiles.public_phone` from the mobile number when "Phone" is chosen |
| Completion | new `seller_profiles.onboarded_at` (null until Finish succeeds) |

Existing sellers get `onboarded_at` backfilled to now in the migration so they are never forced through onboarding. The seller-profile dialog ("My profile") should expose the new fields so they remain editable later (kept minimal: it is the same dialog, extended).

## Server behaviour

- New endpoint (for example `POST /api/onboarding`), signed-in required, not staff-gated. It re-checks: verified Google email, user active, deactivated users refused. If the user already holds seller or admin, it skips the role grant and saves the profile fields only ("complete profile" mode, sets `onboarded_at` if null); if the profile is already complete it returns ok without changes. It validates every field with the existing `validate.ts` helpers (`text`, `optionalPhone`, `oneOf`), phone via `phone.ts` (`PHONE_RE`, normalised), city via `resolveCityInput`, category via `canonicalCategory`, description at most 200. Failure returns field-keyed errors so the client can show each next to its field. On success, one transaction: `ensureUser`, update name and phone, `grantRole(tx, userId, 'seller', userId)`, `ensureSellerProfile`, save the profile, set `onboarded_at`.
- Endpoints that onboarding needs before the role exists must work for a signed-in non-seller: city search (`/api/places`, currently staff-gated) and logo upload (the product-image upload route is staff-gated). Relax city search to signed-in. Add a separate logo upload route (signed-in, per-email rate limit, same type and size limits as product images) rather than loosening the product-image route.
- `requireStaffPage` for a signed-in roleless user redirects to the start route instead of `/seller-access`. `/seller-access` redirects to the start route (page kept so old links do not 404).
- Rate-limit the onboarding endpoint per email and per IP (existing `rate-limit.ts` patterns).

## Entry point and other UI changes

- `AuthButton` signed-out state: "Are you a seller? Login here" on laptop widths, "Seller login" button on phones. Signed-in rendering is untouched.
- Pass `dashboardUrl` from `Header` into `AuthButton`. Currently `Header` omits it, so "My products" and "Admin" links break in split-host mode. Fix as part of this work because the post-onboarding redirect depends on the same origin handling.
- Home page maker call-to-action: replace `ListingRequestButton` with a link into the start route. Footer "Seller login" link keeps working. Footer "For makers" mailto stays.
- Listing requests: the table, API and admin tab stay so existing records remain readable. The public form is no longer reachable from the UI. Update `listing-requests-admin.test.tsx:84` and `listing-request-form.test.tsx`, which assert the button.
- `PostsAdmin` accepts an "open new product on arrival" signal (query param such as `?new=1` or a prop from the page) so the first-product form opens without extra clicks.

## Error handling (every field)

Errors appear next to the field, say how to fix it, clear as soon as the field is valid, and the page scrolls to the first error. Fields have `aria-invalid` and `aria-describedby`. Same messages client and server.

| Field | Errors |
|---|---|
| Full name | required, max 100 |
| Mobile | required, must be a valid 10-digit Indian mobile ("Enter a 10-digit mobile number.") |
| Brand name | required, max 100 |
| Category | required, must be a listed category |
| Description | required, max 200 with live counter |
| City | required, must be picked from the list |
| Instagram or website | at least one ("Add an Instagram handle or a website."); handle format; website must be a valid http or https URL, max 200 |
| Logo | optional; when provided: JPG or PNG; at least 400 by 400; max 5 MiB; upload failure and storage-unavailable (503) shown with retry, and never block Finish |
| Contact methods | at least one ("Choose at least one way for customers to reach you."); WhatsApp needs a valid number; Phone needs the mobile number; Instagram and Website need their value |
| Submit | network failure, server field errors, rate limit, deactivated account (message, no role granted), session expired (back to sign-in) |

## Testing

Vitest, matching existing conventions (PGlite DB tests, node-environment component tests). Cover: onboarding endpoint success, each validation error, idempotency for an existing seller, deactivated and unverified refusals, role plus profile saved atomically, `onboarded_at` backfill; start-route redirects for roleless, seller and admin; `AuthButton` signed-out and signed-in rendering; `requireStaffPage` redirect target; logo upload route limits; `PostsAdmin` opening the form on arrival; existing seller-versus-admin gates unchanged (reuse `posts-admin.test.tsx` and `seller-products.test.ts`).

## Left to the builder

Route names and file layout, the exact component structure of the wizard (client state, step transitions, draft persistence), the migration name, how the start-route decision is wired (page versus route handler), copy for board 5 beyond what the design shows, visual details of the navbar link on mid-width screens, and the exact rate-limit numbers.

## Calls made without the user (check these)

- Role is granted at Finish, not at Step 1. This matches "finishes onboarding becomes a seller" but needs the two relaxed endpoints (city search, logo upload) for signed-in non-sellers.
- Brand name becomes `display_name` (public seller name); the person's full name stays on `users.name`.
- Mobile number stored on the existing unused `users.phone`.
- Existing listing requests are kept read-only for admins; the public form is removed from the UI but the API is left in place.
- `/seller-access` stays as a redirect, not deleted.
- Onboarding description limit is 200 while the profile dialog keeps 500.
- Public display: the new fields (logo, website, WhatsApp, category, contact methods) are stored only in this release. Public pages keep rendering only today's seller fields (name, city, Instagram, bio, public phone). Showing the new fields and contact buttons publicly is a follow-up. Safe default, so unreviewed names, logos and links do not reach the public site yet.
- Admin-created sellers are never forced into onboarding; the endpoint has a "complete profile" mode for them.
- The listing-requests admin tab keeps working fully (view, confirm, and confirm still grants the seller role). Only the public form is removed from the UI.
- Abuse limits: per-email and per-IP rate limits on the onboarding endpoint and the logo upload route, no other caps. Product drafts and uploads by new sellers keep today's limits.
