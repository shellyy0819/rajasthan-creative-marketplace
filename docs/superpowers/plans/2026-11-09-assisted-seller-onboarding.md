# Assisted seller onboarding: plan

Date: 2026-11-09. Status: draft for approval. Separate from `2026-11-07-seller-onboarding.md`, which covers self-signup. This plan covers what happens around and after it, so artisans with low digital confidence reach a first live listing instead of abandoning a form.

Design reference: Design canvas "Assisted Seller Onboarding", https://claude.ai/artifact/HCxuRiefKhyLJXMDptP8zz (five boards: get-started checklist, photo-first draft, agent adds a maker, optional compliance, admin funnel). Hindi text needs a Devanagari fallback font, which DM Sans lacks; `tests/typography.test.ts` blocks a second family, so the owner must approve one before Phase 2 ships.

## Why

Research run on 2026-11-08 (deep-research workflow, 25 claims verified, 22 held). What held up:

- Amazon Karigar, Flipkart Samarth and Etsy with Samhita all pair the marketplace with partner-led onboarding, cataloguing help and fee incentives. They do not hand over a bare form. These describe offers, not measured outcomes.
- A small Kenyan BFA pilot (directional only): low-confidence makers needed field agents or digital helpers for profile, photos and uploads, even with AI tools.
- Photo-first AI listing (Amazon Seller Assistant, BharatGen e-vikrAI) and WhatsApp support (ONDC Sahayak) are established patterns.
- Unregistered intra-state e-commerce selling is possible with PAN plus an enrolment ID under conditions. The 2017 handicraft exemption is Rs 20 lakh inter-state (Rs 10 lakh special category). Notification texts were not checked directly.

Refuted, do not cite: "20% trained in digital selling", "Rs 40 lakh threshold" as worded, "PAN plus e-way bill" as unconditional.

No verified activation, time-to-first-listing or retention benchmarks exist. We measure our own from day one.

## Goals

- A maker who finishes self-signup reaches a first submitted product without needing to know what to do next.
- A maker who cannot or will not self-serve can be onboarded by a person (agent or partner) acting on their behalf, with the maker's consent.
- Every step is usable in Hindi and on a low-end phone.
- We can see where makers drop off.

## Non-goals

- No change to seller-versus-admin restrictions: sellers cannot set APPROVED, cannot delete, new products stay DRAFT. Agents get no admin powers.
- No Aadhaar eKYC (not covered by verified research; legal and cost unknown).
- No payments, payouts, UPI or bank details. Craftofy does not accept or send money today.
- No public display of new profile fields (still the follow-up noted in the 2026-11-07 spec).

## Anti-goals

- An agent who can see or edit another maker's data outside the makers they onboarded.
- Profile lock bypassed: after `onboarded_at` is set, the profile stays locked for the seller. Agent edits go through a defined path only (see Phase 5).
- Tax rules hard-coded without CA review.
- AI-drafted text published without the maker or an admin seeing it. Everything stays DRAFT.

## Phases

Each phase ships on its own and is testable on its own. Build in order. Phases 1 to 3 are the recommended first build.

### Phase 1: Funnel instrumentation

Record onboarding events so the metrics the research could not give us become ours.

- Events: `onboarding_started`, `step1_done`, `step2_done`, `onboarded`, `first_photo_uploaded`, `first_product_saved`, `first_product_published` (admin action), `assisted_flag` (self vs agent).
- New table `onboarding_events` (user_id, event, created_at, meta jsonb). Insert from the existing onboarding endpoint, the product create route and the admin publish route. Migration via drizzle (`npm run db:generate`).
- Admin view: simple funnel counts and median time-to-first-listing, behind the existing admin gate.
- Derived metrics: activation = first product saved within 7 days of `onboarded`; time-to-first-listing; 30 and 90 day retention (any product or profile activity).
- Tests: events written once per user per event, no PII in `meta`, admin view gated.

### Phase 2: Guided checklist in Hindi and English

- Persistent "Get started" checklist card on `/dashboard/posts` for sellers without a published product: Profile done, Add first photo, Add product details, Wait for review.
- Progress indicator (3 of 4 steps) and one primary next action at a time.
- Language toggle (English / हिन्दी) with copy in one dictionary file, so Rajasthani or other languages can be added later. Preference stored per user.
- Help text per field in plain words; a "Need help? WhatsApp us" button on every onboarding and first-product screen (Phase 5 wires the number).
- Short video or illustrated step guide slot, loaded lazily and optional. Content owner to supply the assets.
- Tests: checklist state derived from real data, language toggle persists, no checklist for sellers with a published product.

### Phase 3: Photo-first listing draft

- On the first-product form: pick or take a photo first, then a draft title, description and category are suggested. Maker edits and saves as DRAFT, as today.
- Use a vision-capable model server-side (route handler, per-email rate limit, size and type limits matching the existing image route). Output in the maker's selected language, plus English for the catalogue.
- Never auto-save or auto-publish. If the service is down or the output fails validation, the form works as it does now.
- Open question to decide before building: model and cost per listing, and whether to store the AI draft for review. Check `node_modules/next/dist/docs/` for the current route handler conventions first.
- Tests: validation of AI output through existing `validate.ts` helpers, rate limit, failure fallback, DRAFT status enforced.

### Phase 4: Light compliance capture (needs legal review first)

Do not start until a CA or lawyer confirms the rules. The 2026-11-07 spec lists KYC, GST and PAN as non-goals, so this is a scope change that needs the owner's approval.

- Optional, deferrable fields after onboarding: PAN and GST enrolment ID or GSTIN. No UPI or bank details: Craftofy does not accept or send money today, so nothing is collected for payouts. Revisit only if payments are added.
- Open question: with no money moving through Craftofy, check with the CA whether PAN and GST are needed at all yet. If not, drop this whole phase.
- Rules engine kept as data (state, turnover bracket, intra versus inter-state) so rule changes do not need a deploy. Rules text comes from the CA, not from this plan.
- Links and help for Udyam and PM Vishwakarma registration instead of collecting those documents ourselves.
- Sensitive fields encrypted at rest, never in logs or events, never shown to other sellers. Admin view masked.
- Tests: masking, access control, rules table behaviour.

### Phase 5: Assisted channel (agents and partners)

- New role `agent` in `user_roles`, grantable by admin only. Optional `partner_org` label (for example a Rajasthan craft body or NGO, to be agreed with owners).
- An agent creates or completes a seller on a maker's behalf: records the maker's phone, the maker's explicit consent (checkbox plus timestamp, stored), and which agent acted. A maker later signs in with Google to claim the account.
- Profile lock rule: while a profile is unclaimed, the creating agent can edit it. After the maker claims or `onboarded_at` is set by the maker, agent edit access ends. Agents see only makers they onboarded.
- Agents can submit DRAFT products for their makers. They cannot publish, delete or set APPROVED.
- WhatsApp help number (config, not hard-coded) wired into Phase 2 buttons. A bot is out of scope; a staffed number is the starting point.
- Open question: agent economics and partner list (Rajeevika, RSLDC, craft clusters). Business decision, not engineering.
- Tests: agent scope isolation, consent required, lock rules, no privilege escalation, existing seller and admin gates unchanged.

### Phase 6: First-listing incentive

- Configurable campaign: fee waiver or featured placement for a maker's first N published products in the first X days. Values set by admin, not code.
- Depends on whether the marketplace charges fees today. If not, this phase becomes a featured slot or a "New maker" badge. Owner decision.

## Metrics and success checks

Targets are not set because no verified benchmark exists. After Phase 1 has two to four weeks of data, the owner sets targets for: activation within 7 days, median time-to-first-listing, assisted versus self-serve activation, 90 day retention.

## Constraints carried over

- Next.js here has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before routing, proxy or route handler code. Interception is `src/proxy.ts`.
- UI follows the `rang-rajasthan-design` skill: existing tokens, DM Sans only, controls as siblings, required-field pattern, `Toast`, `PageLoader`, breadcrumbs on new pages, mobile at 600px.
- Schema changes go through drizzle with a new migration. Tests use PGlite with all migrations.
- Roles are re-resolved on every session read (`resolveAccess`).

## Decisions needed from the owner

1. Approve Phases 1 to 3 as the first build.
2. Phase 4 scope change (KYC and tax fields were a non-goal). Needs a CA opinion first, including whether it is needed at all while no money moves through Craftofy.
3. Phase 5: who the first partners and agents are, and who staffs the WhatsApp number.
4. Phase 6: do we charge fees today, or is the incentive a badge or featured slot?
5. Model and budget for the Phase 3 vision draft.

## Sources

- Amazon Karigar: aboutamazon.in/news/small-business/how-amazon-karigar-is-reshaping-the-future-of-handmade-products
- Flipkart Samarth: stories.flipkart.com/flipkart-samarth-indian-artisans-weavers-craftsmen
- Etsy and Samhita: cxotoday.com/media-coverage/etsy-partners-with-samhita-social-ventures-to-enable-thousands-of-artisans-across-india
- BFA Kenyan makers: bfaglobal.com (what-it-takes-to-sell-online-three-lessons-on-digital-market-access-for-kenyan-handicraft-makers)
- Amazon Seller Assistant: aboutamazon.in/md/news/small-business/amazon-seller-assistant-ai-tool-india
- BharatGen e-vikrAI: cvit.iiit.ac.in/news-updates/blog/bharatgen-multilingual-ai-of-an-e-commerce-tool-for-indian-languages
- ONDC Sahayak: domain-b.com (ondc-launches-whatsapp-bot-sahayak)
- GST: razorpay.com/learn/how-to-sell-online-without-gst-number, abcaus.in handicraft exemption page (secondary; verify against notification text)
- MSME and Amazon MoU: newsonair.gov.in/msme-ministry-signs-mou-with-amazon
