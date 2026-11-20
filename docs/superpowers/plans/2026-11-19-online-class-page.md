# Online class detail page (mosaic) — plan

Spec: the "Daily Yoga class page" design (claude.ai artifact WsUrS9n1Y36njym6Ck483q), mosaic boards, light and dark.

**Goal:** online classes (kind class or mode online) get their own detail layout; other workshops keep the current page.

**Data rules:** only fields a class already stores. No invented bio, "what an hour looks like" or "good to know". The private phone is shown only through `publicPhone`.

- [ ] `src/lib/class-page.ts`: `nextSession`, `weekStrip`, `describeNext`, `contactChannels` (pure, India time) + `tests/class-page-lib.test.ts`
- [ ] `PhotoMosaic` (client; cover + 2, opens the existing photo viewer; 1 or 2 photos degrade; 0 photos show the illustration)
- [ ] `ClassIllustration` (yoga group scene for the yoga topic, plain arch and sun otherwise)
- [ ] `ClassDetail` (hero with instructor card and main contact button, facts strip, this week, plans, join steps, sticky contact card) + `ClassDetail.css` on the site tokens (light and dark)
- [ ] `workshops/[slug]/page.tsx` uses it for classes; ended notice and JSON-LD unchanged
- [ ] Tests for the component (photo counts, fallbacks, contact rules, no private data) and the page
