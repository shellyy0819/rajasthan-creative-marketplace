# Maker concierge: listing Udaipur makers in person, and sending visitors to them

## Intent
Craftofy wants more people to discover Udaipur's craft and art through it: more Udaipur makers listed, and more visitors contacting them. Paid ads are out. Listing is already free, so price is not what stops makers.

What stops them, from the owner's own experience asking friends and makers: they say yes and then never find the time, and many Shilpgram stall artisans do not read English. The sign-up path today (Google account, English forms, `/sell` onboarding) is harder for them than "free" suggests. So the owner will go to Shilpgram Utsav (about 21 to 30 Dec 2026, dates unconfirmed) in person and list makers on the spot, doing the typing for them, and leave each maker with a printed QR card for their stall. Visitors scan the card, land on the maker's Craftofy page and contact the maker directly. Success is a maker who is listed with a real published product and a visitor who contacts them; page views alone are not the goal.

## Goals
- A phone-friendly admin screen that adds a maker and a first product in a couple of minutes, with no email needed from the maker.
- A printable card per maker with a QR code to their artist page, readable in Hindi and English.
- A short field kit (what to say, what to photograph, how to follow up) so the visit is repeatable and a helper could do it too.
- A list of free ways to bring visitors to those makers, ranked by effort, for the weeks around the event.
- Ready before the event: the owner is at the stalls on the first days (21 Dec), so the tool and cards must work by about 18 Dec.

## Non-goals
- No Hindi translation of the whole site and no phone/WhatsApp sign-in. That is the "make self-signup easy" approach, deliberately deferred until the field visit shows what makers actually get stuck on.
- No maker login for these makers and no "claim your page later" flow in this piece. The owner edits their pages as admin.
- No payments, no ticketing, no claim of being run or endorsed by WZCC, Shilpgram or the Ministry (same rule as `2026-11-16-shilpgram-udaipur-fair-design.md`).
- The Shilpgram Utsav page itself is a separate, already-specced piece; this design links to it but does not build it.

## Anti-goals (a failure even if it works)
- A maker listed, photographed, or shown with a public phone number without having agreed. Consent is recorded at the stall.
- Placeholder emails that receive or send real mail, or that someone could later claim by signing in.
- Thin, copy-pasted or half-finished maker pages (no photo, no craft, no story) going live.
- Cards that point at pages which are still hidden or empty.

## Constraints (from the code, checked 2026-11-24)
- Every user needs a unique, non-null email (`users.email`, unique on `lower(email)`). Makers without one cannot exist today.
- A seller is a user with the seller role plus a `seller_profiles` row (`ensureUser`, `grantRole`, `ensureSellerProfile` in `src/db/people.ts`). `confirmListingRequest` in `src/lib/listing-requests.ts` is the existing example of making a seller from a request.
- An admin may create and edit a product for any seller by passing `sellerId` (`src/lib/admin.ts`); a seller's products stay hidden until an admin publishes. The owner is the admin, so they can publish on the spot once the maker has seen the page.
- Artist pages live at `/artists/[slug]` and already show phone, Instagram and the like. Contact clicks are already counted as product events (`contact_call` and so on).
- There is no QR code generation in the repo (only a drawing in `HeroStall`).
- The site is English only today; Hindi appears only in the class-language list.
- Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing routes or pages. Tests need Node 22; local DB on :5434; the dev server on :3000 belongs to the user.

## Approaches
1. **We list them, in person (chosen, recommended by me, chosen by the owner).** The maker does nothing; the owner collects photos and a few facts at the stall and enters them. Highest sign-up rate for makers with little time or English. Cost: a person on the ground for a few days and an admin quick-add screen.
2. Make self-signup easy (Hindi-first onboarding, phone or WhatsApp sign-in, photo and voice first). Scales without the owner, but is real build work and makers still have to find the time. Deferred.
3. Pull from the demand side only (Shilpgram page, shareable maker cards, tourist-facing partners linking in). Slowest, and weak while there are few makers listed. Kept only as the visitor-side half of this design.

## Decided by the owner
- Approach 1; the owner will be at Shilpgram in person.
- Makers with no email get a generated placeholder email (no schema change, no maker login).
- Both sides matter: makers listing and visitors contacting them.

## Design
**Quick-add maker (admin only, phone-first).** One screen under the dashboard. Fields: maker's name, phone (Indian mobile, reuse `normalizePhone`), craft or category, city (defaults to Udaipur), one-line story, 1 to 4 photos taken from the phone camera (reuse the existing upload path), optional Instagram, and two consent ticks: "maker agreed to be listed" and "maker agreed to show phone number publicly" (the second controls the public phone; without it the page shows no phone and contact falls to Instagram or the owner as intermediary, builder to decide the exact fallback). Submit creates the user, seller role and seller profile, plus one draft product with the photos; it returns the artist-page URL and a "print card" action. Re-entering the same phone finds the existing maker instead of creating a duplicate.

**Placeholder email (my calls, for review).** Format `maker-<10-digit-phone>@maker.invalid`. The `.invalid` TLD is reserved and can never receive mail or be a real Google account, so nothing can be claimed or sent. The mailer must skip any address on that domain, and the sign-in path must never match one. The admin users list should show these makers clearly as "added by admin, no login".

**QR card.** A print page (A4 sheet of small cards, cut by hand): maker name, craft, a QR to `/artists/<slug>`, the short address in text, and a Hindi line ("संपर्क करें" or similar, copy is the builder's) beside the English. QR is generated server-side as SVG so it prints sharply. The URL carries a source tag for stall-card scans so they can be told apart from other traffic (how it is counted is the builder's call within the existing consent-free events model; see `docs/trending.md`).

**Field kit (a document, not code).** One page: the 30-second pitch in Hindi ("free, your own page, customers call you directly"), a photo checklist (the maker with the craft, three products, one close-up of the work), the facts to ask for, the consent wording, and what happens next (page live today, owner follows up in a week). Also a log sheet: name, phone, what was promised.

**Free ways to bring visitors (ranked by effort, no spend).**
1. The Shilpgram Utsav page, once built, with the Udaipur makers shown at its end (already specced).
2. Content from the same visit: short videos or photos of makers at work posted on Craftofy's Instagram, tagging the maker with their agreement.
3. A WhatsApp-ready share link and card per maker, so makers and friends spread their own page.
4. Local partners who send tourists to craft: homestays, guides, cab drivers, college art and design clubs, Udaipur Instagram and travel pages, each given the Shilpgram page or a maker's QR.
5. Answers and listicles that rank for "what to buy in Udaipur" and "Udaipur handicrafts", using real makers from the visit (blog exists at `/blogs`).

**Success measures (owner to set targets; my starting suggestion, not agreed: 25 makers with a published product by the end of the event).** Makers added with a published product; contact clicks from stall-card scans; enquiries reaching makers.

## Left to the builder
Screen layout and form flow; the exact fallback when a maker declines a public phone; card layout, size and Hindi copy; how the source tag is counted; QR library choice; whether the quick-add reuses `PostForm` pieces or the listing-request admin code; tests; how to mark and show admin-added makers in the users list.

## Calls I made (mine, marked for review)
- `.invalid` as the placeholder domain, rather than a Craftofy-owned domain.
- No "claim later" flow in this piece.
- QR via SVG generated server-side.
- Ready-by date of about 18 Dec, from the 21 Dec event start; the event dates themselves are unconfirmed.
- The 25-maker target.
