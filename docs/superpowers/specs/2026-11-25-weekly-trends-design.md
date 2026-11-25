# Market trends digest, phase 1

Status: draft for approval. Date: 2026-11-25.

## Intent and why

Admins want to know what is rising in arts and crafts and in craft workshops, so each week they can pick sellers to nudge, plan new workshops, write blog posts, and ask workshop hosts whether they have run a trending workshop. Phase 1 builds only the digest those four jobs will read. The four jobs are later phases, each with its own design.

The site's existing `/trending` pages rank our own products and workshops by likes and views. This is different: outside market signals, researched on demand.

## Goals

- An admin presses "Fetch trends" and gets a digest with two sections: crafts (styles, materials, colors, products) and workshops (craft experiences people are booking or searching for).
- Every trend carries source links. A trend without a source is dropped.
- Each workshop trend is matched to our `workshop_topics` and marked "we have N listings" or "gap".
- Past digests are kept and can be reopened.
- The Gemini key is saved by an admin in settings, no redeploy.

## Non-goals (this phase)

- Any automation. No cron, no scheduler endpoint. Every trigger is manual, now and for the later phases (emails and drafts are also sent or published by an admin by hand).
- Seller and artist emails (phase 2 below) and blog drafts (phase 3).
- Showing trends to the public or to sellers.

## Anti-goals

- Invented trends. If search returns nothing usable, the digest says so rather than filling in.
- Anything that sends mail or publishes without an admin acting.

## Constraints

- Admin only. Existing role gates stay as they are.
- The Gemini key is encrypted in `app_settings` with `secret-box`, the way the mail key is. The admin screen shows only whether a key is saved and its last 4 characters. A blank save keeps the old key. A `GEMINI_API_KEY` env var is the fallback. The key never reaches the browser or logs.
- Local work uses the local DB (`.env.local`, :5434). Migrations run locally only. Tests run on Node 22.
- UI follows the `rang-rajasthan-design` skill: tokens, site type scale, light and dark.
- No Gemini SDK. Plain HTTPS to the Gemini API with the Google Search tool, behind one small function so the model can be swapped.

## Approaches considered

1. In-app job plus an outside cron calling a protected endpoint. Rejected: the user wants manual triggers only.
2. **Manual "Fetch trends" button, chosen.** Same fetch code, no scheduler. Cheap to build, and a scheduler can be added later without redoing anything.
3. A scheduled Claude Code routine outside the app. Rejected: harder to link results to our topics and sellers, and automated.

Research engine: Gemini with Google Search grounding (chosen by the user over the Claude API).

## Design

**Settings.** New "Trend research" box on `/dashboard/settings` beside the email box: Gemini key field, masked view, save and clear. New `src/lib/trend-settings.ts` mirroring `settings.ts`.

**Fetch.** `src/lib/trend-research.ts`: one function builds the prompt (India-wide with a regional lens read from settings or the cities in use, crafts and workshops, the current week), calls Gemini with the search tool, reads the answer and the grounding sources, validates the shape, and drops items with no source link. Failures return a clear message; the key is never echoed.

**Storage.** New table `trend_digests`: id, created_at, created_by, model, status (`ok`, `empty`, `failed`), error text, `published_at` and `published_by` (null while private), and `items` (jsonb, each with a `show` flag that is off until an admin switches it on): kind (`craft`, `art` or `workshop`; Gemini suggests it, an admin can correct it), title, why it is rising, region note, sources (title and url), and for workshops the matched topic id and our approved-listing count. Drizzle migration, run locally only.

**Topic match.** After the fetch, our code matches each workshop trend to `workshop_topics` by name (lowercase, simple contains) and counts approved workshops for that topic. No match means "gap". Gemini does not do this step.

**Admin page.** `/dashboard/market-trends`, added to the dashboard tabs. Named to avoid confusion with `/dashboard/trending`. Shows the latest digest in two sections, a history list, a "Fetch trends" button that is disabled while a fetch runs, and an empty state that points to settings when no key is saved. One fetch at a time per server, and a short minimum gap between fetches to guard cost.

**Tests.** Vitest with a mocked Gemini response: valid digest saved, item without a source dropped, empty result stored as `empty`, bad key gives a clear error, topic match and gap, admin gate, key never in a response. Page render test for the empty state and a populated digest.

## Left to the builder

- The exact Gemini model and request shape. Search plus strict JSON output may not combine on every model; if not, ask for JSON in the prompt and validate it.
- Prompt wording, item counts per section, the minimum gap between fetches.
- Visual layout, within the design skill.

## Added after review: sources, public page, wording

- **Sources.** Each trend item records where it came from: `web` (Gemini with Google Search, which may cite public Pinterest pages), `pinterest` (an admin reads Pinterest Trends and adds items by hand; the app never scrapes Pinterest or uses its private data), or `manual` (the team's own research, including what artists and fairs say). Admins can add and edit items by hand on `/dashboard/market-trends`, each with a source name and optional link. The public page credits sources by name, such as "Source: Pinterest Trends".
- **Public page.** `/trending` gets a new top block: rising crafts, then workshops on the rise. Only items an admin has switched on ("show on /trending") appear. Below it the page keeps today's favourite products and trending workshops. Cards link into our shop and workshops; where we have nothing, the card says so ("No artists listed yet", "Not offered yet"). No outside photos or copied text. Design: https://claude.ai/artifact/Nk4SeMErTTSBfEhn7HT1iq
- **Admin sees it first, then publishes.** A new digest is private: only admins see it, on `/dashboard/market-trends`. Preview works the same way as the existing theme preview in the dashboard: each digest is a card with a status badge (Draft or Published) and a **Preview on site** button. The button sets an admin-only, HttpOnly cookie (like `PREVIEW_COOKIE` for themes) through an admin-gated API route and shows a toast ("Previewing the 24 November digest. Open /trending while signed in."). While the cookie is set, `/trending` shows that admin the digest's switched-on items in the real public block, and a floating pill at the bottom reads "Previewing market trends, not public yet" with an **Exit** button that clears the cookie. Visitors and other admins never see a draft. Nothing reaches `/trending` until an admin presses **Publish for everyone** on that digest. The admin can still switch off single items first (the "show on /trending" switch), and **Unpublish** takes the whole block down again. Only one digest is published at a time: publishing a new one replaces the previous one, and the page records who published it and when. A digest with no items switched on cannot be published. The public page reads only the published digest's switched-on items, and never an admin-only field such as the raw model output or an error.
- **Headings follow the items.** The block heading on `/trending` is chosen from the kinds of the items shown: all `craft` gives "Crafts to look at", all `art` gives "Art to look at", a mix gives "Arts and crafts to look at". A block with no items is hidden, never shown empty. The workshops block works the same way and appears only when it has items.
- **Nothing hardcoded.** No heading, label, prompt or email may hardcode a place or brand name such as "Rajasthan". Page headings use the site's wording (`getCatalogWording`) and the site name (`SITE.name`). Where a fixed label is needed, it is "{site name} picks". The region for the Gemini prompt comes from settings or the data (cities in use), not from code. A test fails if a new page or lib string contains a hardcoded place name in a heading.

## Phase 2: emails ready for each seller and artist (added after review)

When a digest is saved, the app prepares a draft email for each matching recipient, so the admin only reviews and sends.

- **Sellers** get a nudge from the crafts trends that match their category ("buyers are looking for X; do you make it?").
- **Artists who host workshops** get "have you run this workshop before?" for the workshop trends that match their topics.
- Drafts are built by our code from two admin-editable templates (one for sellers, one for artists) with name and trend merged in. Gemini does not write them.
- Each draft is editable per recipient in the existing rich-text editor (`RichTextField`: bold, italic, underline, bullets, numbers). The template can be edited once and applied to drafts not yet edited.
- New table `trend_email_drafts`: digest id, recipient user id, kind (`seller` or `artist`), subject, body (the editor's plain-text markup), status (`draft`, `sent`, `skipped`), sent at, sent by.
- Sending is manual only: a Send button per draft, and "send selected" that still needs an admin to press it. Nothing sends when a digest is saved. Reply-to is the admin's address.
- The existing mailer sends plain text only. The body is converted to readable plain text on send (bullets and numbers stay, bold and underline marks are dropped). Sending formatted HTML would need a mailer change; not in this phase. This is a builder-visible call for the user to confirm.
- Replies are not read by the app. The admin notes "has run it" or "has not" on the artist's draft row by hand.
- Recipients with no matching trend get no draft. Inactive (soft-deleted) users never get one.
- Phase 1 ships first and stands on its own; this phase gets its own plan.

## Later phase

3. Blog drafts from a trend, saved as drafts for an admin to edit and publish by hand.
