# Festive theming: design

An admin page that changes how the whole Craftofy site looks for a festival, on a schedule, without a developer.

Reference mockup (open it in a browser; it is the source of truth for the look, colours and sticker artwork): `docs/superpowers/specs/2026-11-01-festive-theming-mockup.html`. Hosted copy: https://claude.ai/artifact/FyfgfZFrHMFuq59ziiA7jn. The base stall illustration comes from the owner's artifact https://claude.ai/artifact/DwUkKTpS9HqArxNrgTtNqC (its SVG is already inside the mockup file).

## Intent and why

The site launches around Dhanteras (Nov 2026). The owner wants the site to look festive for that and for later festivals, switched by an admin from `/dashboard/theme`, and to switch itself on and off by date. Making the site feel alive for the festival is part of the launch pitch.

## What it is

- **Base look.** The "Maker's Row" stall illustration (an SVG with a striped awning, shelves, makers and shoppers) becomes the hero artwork. Every colour in it is a CSS variable, so a palette change recolours the stall and the rest of the site together. `src/components/HeroStall.tsx` already renders this SVG in the home hero (classes `st-*`, variables `--stall-*`); build on it. The hero's two-column layout and copy (`src/components/Hero.tsx`) stay as they are; only the art box becomes themeable. With no festival active, visitors see this stall as it is ("Everyday").
- **A theme** is a festival preset the admin has adjusted and scheduled. It has four layers: a palette (behind everything), the stall illustration, stickers (drawn above the stall), and wording (above that).
- **Stickers.** Small SVG illustrations placed on the stall (diyas, lights, a tree, Santa and so on). The admin moves them, resizes them and shows or hides them.
- **Wording the admin can edit:** the banner line above the nav, the signboard text, and the three chalkboard lines. Each has a character limit.
- **Primary colour override.** One colour picker changes the site's main colour (buttons, links, awning roof, counter front, banner). Text on top flips light or dark automatically so it stays readable, and the editor shows the contrast ratio.
- **Schedule.** Each theme has a start and an end, each a date plus a time, always India time (IST, UTC+05:30). The site switches itself.
- **Presets, all in the first version:** Dhanteras, Diwali, Govardhan Pooja, Bhai Dooj, Chhath Puja, Guru Nanak Jayanti, Thanksgiving, Christmas. Each ships with a palette, a sticker set and sample wording, and is editable. Sample 2026 dates from the owner's calendar: Diwali 8 Nov, Govardhan Pooja 9 Nov, Bhai Dooj 11 Nov, Chhath Puja 15 Nov, Guru Nanak Jayanti 24 Nov, Thanksgiving 26 Nov, Christmas 25 Dec. Dhanteras is not in the calendar screenshot; use a sample date and let the admin set it. Festival dates move every year, so the admin always confirms dates. "Optional" in the owner's calendar only means the admin decides whether to theme that day.
- **Drawn in the mockup:** Everyday, Dhanteras, Diwali, Christmas. Their palettes, sticker sets and wording are in the mockup file; lift them. The other five presets are still to be drawn and written in the same style (see Left to the builder).
- **Mixing:** every sticker is available in every theme; each festival's set is just the starting selection.

## Goals

- An admin can pick a preset, adjust wording, stickers, primary colour and dates, preview it, and schedule it, all from `/dashboard/theme`.
- Visitors see the right theme from the first byte of the page, and it applies to every public page.
- The theme turns on at its start time and off at its end time with no manual step and no deploy.

## Non-goals

- Uploading new sticker artwork. The sticker library is code, not user content.
- Theming the dashboard itself. Only the public site is themed.
- Changing how the existing light/dark toggle works (see "Light and dark" below).
- Per-page themes, A/B tests, multi-language wording, or computing festival dates automatically.

## Anti-goals (a failure even if it technically works)

- **Layout shift.** Switching or editing a theme must never move or resize anything on the page. This is a hard rule (see Constraints).
- A flash of the normal look before the festive look appears.
- An admin choosing colours that make text unreadable, or wording that overflows its board.
- A theme that fails to end, or that cannot be switched off quickly in an emergency.
- A theme bug taking a page down.

## Constraints

- Next.js in this repo has breaking changes from standard Next.js: read the relevant guide in `node_modules/next/dist/docs/` before writing code (see AGENTS.md).
- Styling is plain CSS with variables in `src/app/globals.css`. Follow the `rang-rajasthan-design` skill for admin UI. The stall artwork uses its own variable names (`--terra`, `--mustard`, `--indigo`, `--sage`, `--sand`, `--board` and others, see the mockup); reconcile them with the site's tokens (the site's primary is `--green`, its accent is `--orange`).
- **The site already has a light/dark mode:** `ThemeToggle`, a `data-theme` attribute on `<html>` (set before paint by `themeInitScript`), `prefers-color-scheme`, and about 60 tokens in `:root` with dark overrides in `src/app/globals.css`. A festival theme must work in both (see "Light and dark" below).
- Public pages read the database per request (`force-dynamic`). Drizzle and Postgres; migrations live in `drizzle/`.
- The dashboard is admin-only and may be served from a separate host (`DASHBOARD_URL`, see `src/lib/hosts.ts`); all theme APIs check the admin role with `requireAdmin` from `src/lib/authz.ts`.
- **No layout shift, concretely:**
  - A theme can only change colours and the stickers/wording drawn inside fixed boxes. It never sets fonts, spacing, sizes or heights.
  - The hero scene lives in a box with a fixed aspect ratio (the SVG's 600x720 viewBox). Stickers are placed inside it in viewBox units, so they cannot affect surrounding layout.
  - The banner strip above the nav is always present at a fixed height (38px in the mockup). With no festival it shows a plain default line, so nothing is added or removed when a festival starts.
  - Wording sits in fixed-size boards with character limits and shrink-to-fit; text never grows a board.
  - The theme is applied on the server in the first HTML, so there is no swap after load. Fonts the stall uses (DM Sans, Fraunces italic, Caveat) must be loaded the same way as the site's fonts (`next/font`) so a late font swap does not move anything.
  - An automated test must render the public layout under several themes and fail if any block changes position or size between them.
- Times are stored as absolute instants (timestamps with time zone) and entered and shown as IST regardless of the admin's or visitor's timezone.
- Stickers are decorative: hidden from screen readers on the public site. Motion respects `prefers-reduced-motion`. The editor works with the keyboard (arrow keys move, + and − resize a selected sticker).

## Decided by the owner

- Admin page at `/dashboard/theme`; changes reflect throughout the website.
- Base look is the stall illustration; festival changes layer on top of it.
- Admin can edit the signboard and chalkboard wording, drag and resize stickers, and change the primary colour.
- Start and end date and time, in IST; the site switches itself.
- Ready-made presets for the eight festivals above, each with palette, stickers and sample wording.
- Christmas includes a big Santa Claus, resizable.
- Layout must never shift because of a theme.

## My calls (the author's; please check)

- **Overlaps:** if two scheduled themes overlap, the one that started later wins.
- **Nothing active:** the site shows Everyday.
- **Status:** a theme is a draft until the admin schedules it; drafts never go live. The theme list has an "End now" button.
- **Preview:** the editor preview and a "preview this theme on the real site" mode that works only for a signed-in admin (no shareable link). A visible "Previewing, exit" bar shows while it is on.
- **Banner:** Everyday shows a neutral line ("Handmade, direct from the maker") in the same fixed-height strip.
- **Scope of the primary colour:** it is stored per theme and also available for Everyday as a site-wide base colour.
- **Move and resize only** in version one (no rotation). Positions and sizes are stored as numbers in viewBox units.
- **Data:** theme records in the database (preset key, status, start, end, primary colour, wording, sticker placements, bunting on or off, who last changed it and when). Sticker artwork and preset palettes are code constants with stable ids.
- **Fallback:** invalid theme data or a database error falls back to Everyday and logs; it never breaks a page.
- **Respectful artwork:** no depictions of deities; the admin reviews each festival's look before scheduling.
- **The dashboard UI is not themed.**
- **Where a theme shows:** the palette and the banner apply on every public page (set once in the root layout). The stall, stickers, signboard and chalkboard appear only in the home hero.
- **What a palette drives:** a small set of brand tokens, not every token. The primary colour drives `--green` (and what derives from it); the accent drives `--orange`; the stall's own colours drive `--stall-*`. Neutral surfaces (cards, chips, product tile backgrounds, borders) stay as they are. Brand-coloured solid surfaces that are hardcoded today (the header bar, hero and intro bands, the maker call-to-action, the footer) are changed to use tokens so they follow the palette.
- **Everyday is editable:** one settings record holds Everyday's primary colour, banner line, signboard and chalkboard wording, stickers and bunting. It has no schedule and is always the fallback.
- **Contrast is enforced, not advisory:** the server rejects a primary colour whose best text colour (white or near-black) gives under 4.5:1; the editor shows the ratio live and disables Save when it fails.
- **Layout-shift test viewports:** 1280x800 and 390x844, run for Everyday and every preset.

## Light and dark

Working decision (the owner did not choose; the recommended option is used and can be revisited): a festival changes only the brand tokens (primary, accent, the stall's colours), the stall, the stickers and the wording. Neutral surfaces keep following the visitor's light or dark mode. A theme's brand colours apply in both modes, and the primary colour must give at least 4.5:1 text contrast.

## Layout-shift test

Working decision (the owner did not choose; the recommended option is used): add `playwright` as a dev dependency and run a real-browser layout test (`npm run test:layout`, kept out of the default `vitest run` because it needs a downloaded browser). It renders the public top of the site (banner, header, hero) to static HTML under each theme and compares block positions and sizes at 1280x800 and 390x844. It needs no database or running server.

## Left to the builder

- Table schema, indexes, and how scheduling is resolved (how often the active theme is re-read; the requirement is that a theme starts and ends within a minute of its time with no manual step).
- File layout, how the SVG stall and sticker library are organised as components, and how presets are stored in code.
- The editor's implementation (a client component with drag, resize, selection, live preview), and sensible error messages.
- Drawing the five remaining presets in the mockup's style: Govardhan Pooja, Bhai Dooj, Chhath Puja, Guru Nanak Jayanti and Thanksgiving, each with a palette, a sticker set and sample wording. Reusing existing stickers is fine where it fits.
- Test strategy and the order of changes. Required tests: the layout-shift check across themes, IST boundary and overlap resolution, admin-only access, text and colour validation, and that the first server render already contains the active theme.
