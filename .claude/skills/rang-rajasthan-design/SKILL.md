---
name: rang-rajasthan-design
description: Use when creating or changing any UI component, page layout, form, button, dropdown, card, dialog or CSS in the Rang Rajasthan marketplace, including turning a mockup or design artifact into code. Defines the design tokens, the site-wide type scale (new pages must match it), light and dark rules, content rules, control sizing, component patterns and a checklist so new UI matches the existing look.
---

# Rang Rajasthan design guidelines

Single stylesheet: `src/app/globals.css` (plain CSS, no Tailwind/CSS-in-JS). **One font family, DM Sans, everywhere** (loaded in `src/app/layout.tsx` as `--font-sans`). Headings and card titles use `--font-display`, which currently resolves to DM Sans; use `var(--font-sans)` for text and controls and `var(--font-display)` for headings, never a font name. Form controls inherit the page font. Do not add a second family, inline `fontFamily`, or a literal font name; `tests/typography.test.ts` fails if you do. A second family needs the owner's approval first: change the `--font-display` token and the layout import in one place. **Reuse existing classes before writing new CSS.** `globals.css` holds the tokens and the shared classes; a feature may keep its own stylesheet next to its component (`WorkshopListings.css`, `ClassDetail.css`), but only with tokens and sizes from this skill: never new hex values, never sizes that are not in the type scale below, no inline styles for theme values.

## Read this first when building a page from a mockup

A mockup or design artifact is a **layout reference, not a size reference**. Mockups use generic sizes (58px titles, 19px intro text, 34px prices) that are larger than this site's, and copying them made the online class page look out of step with every other page. For any new page or layout:

1. Open the CSS of two existing sibling pages (for a detail page: `.detail`, `.page-head`, `.workshop-card`) and list the sizes they use.
2. Take every font size, weight, letter-spacing, radius and colour from the **Type scale** and **Tokens** below, not from the mockup.
3. Check light **and** dark with the tokens only. Dark mode is just the token values changing; if a page needs a hex to look right in dark, the token is wrong.
4. Add a small source-contract test that pins the page's key sizes to the site's own rules (pattern: `tests/class-page-type-scale.test.ts`, which compares `ClassDetail.css` to `globals.css`).
5. Look at it at laptop, tablet (about 700 to 900px) and phone (390px) widths before calling it done.

## Tokens (use the variables, never new hex values)

| Token | Value | Use |
|---|---|---|
| `--ink` | #252a24 | text |
| `--muted` | #77796f | secondary text, hints |
| `--paper` | #f8f4ee | page background |
| `--cream` | #eee5d8 | placeholders, thumbs |
| `--green` | #405746 | primary buttons, links, success |
| `--orange` | #c66b43 | accents, eyebrows, focus ring |
| `--line` | #e5ddd1 | hairline borders of inputs/cards |
| `--white` | #fffdf9 | card/input surface |
| `--card-2` | #f9f7f0 (dark #212922) | the surface of cards on a page (workshop cards, detail cards) |
| `--muted-2` | #6e7068 (dark #b0b4a8) | secondary text on detail pages: intro, notes, small labels |
| `--ink-soft` | #575a4d (dark #cfd2c4) | softer body text where `--muted` is too faint |
| `--green-d` | #374a3b (dark #b9cdbd) | dark green text and strokes |
| `--chip-green`, `--chip-sand`, `--chip-sand-ink` | chip fills and their text | pills and status chips |
| `--sand`, `--sand-line` | warm floor and its edge | illustrations and soft panels |
| `--control-h` | 36px | height of every admin control |
| `--control-border` | #cfc5b7 | border of outline buttons **and selects** |
| danger | #a74d35 (border #e0b9ad) | destructive actions |
| required marker | #d0312d | red asterisk |

Radius is `3px` for controls, `4-6px` for cards/dialogs, `30px` only for pills/badges.

## Type scale (the whole site uses this; new pages must match it)

This site's text is **small**. Pages look consistent because nobody goes bigger than these sizes.

| Use | Size and weight | Where it already exists |
|---|---|---|
| Detail page title | `500 clamp(30px, 4vw, 44px)/1.1 var(--font-display)`, letter-spacing -1px | `.detail h1` |
| List page title | `500 clamp(34px, 4.5vw, 52px)/1.1`, letter-spacing -1.2px (phone workshops header: 32px) | `.page-head h1` |
| Big home section heading | `500 clamp(32px, 4vw, 45px)/1.15`, letter-spacing -1px | `.section h2` |
| Heading of a section inside a detail page | `500 clamp(22px, 2.4vw, 26px)/1.2 var(--font-display)` | online class page |
| Card, step or person title | `500 18px var(--font-display)` | `.workshop-card h3` |
| Intro (lead) text | 14px, line-height 1.8, `--muted-2` | `.detail .lead` |
| Body text in cards, lists and notes | 12px, line-height 1.6 | `.detail dl` |
| Small notes and hints | 11px, `--muted` | `.muted`, `.maker-note` |
| Price on a detail page | 22px | `.detail .price` |
| Field labels and small caps labels | 10px, 700, letter-spacing 1px | legends, `.lbl` |
| Eyebrow and meta line | 9px, 700, letter-spacing 2px, `--orange` | `.eyebrow`, `.product-meta` |
| Buttons | 12px, 600 (`.button`); admin controls 11px | `.button` |
| Pills and chips | 11 to 12px, 700 | `.ws-badges span`, `.detail-pills li`; `.badge` is 9px uppercase |

Never go larger than a 44px title or add a size that is not in this table without the owner's approval. Do not enlarge text on a phone to "fill the screen": phone sizes are the same or smaller.

## Colour rules

- **Text on an orange background is white** (`#fffdf9`). If the contrast is too low, use a deeper token for the background, never dark text.
- Use `--muted-2` (not `--muted`) for secondary text people must read; `--muted` is for hints.
- Each theme comes from the tokens above. A new surface needs `--card-2` or `--white`, a `--line` border and `--ink` text, nothing else.

## Say each thing once

Redundant information makes a page feel padded and was a repeated review comment. On any page:

- A fact (price, free trial, schedule, "no payment collected", language, level) appears in **one** place. If it needs to be reachable twice (a sticky bar), the second one is the same control, not new copy.
- A contact channel appears once per screen size: the main button, plus icons only for the channels that have no button. Never an icon next to the same channel's button.
- Show only data the record has. No invented bios, tips or sample copy, and no empty headings for missing data. A free listing gets a one-line price row, not a plans table.
- Private data stays private: a phone number is public only when the host chose "Show this number to the audience"; a meeting link, contact email and private phone never reach a public page or its HTML.

## Photos

- A seller's first photo is the cover; show up to three (cover large, the other two smaller). With one or two photos the layout degrades; with none, show the illustration.
- Wide screens fill each tile (`object-fit: cover`). On tablets and phones photos are shown whole (`object-fit: contain`) and the photo area is height-capped (`clamp(220px, 42vw, 340px)`) so the title and the next line of information are visible without scrolling past a huge image.
- Photos always open in the existing viewer (`PhotoViewer` in `PhotoButton.tsx`) and have alt text like "Title, photo 2 of 3".

## Responsive

Breakpoints are 900px and 700/600px (see the existing `@media` blocks). At 900px and below a page becomes one column. On phones a main action stays reachable at the bottom of the screen (a fixed bar) and is hidden where the page already shows the same button. Check 390px, about 700px and 1280px.

## Controls must look like siblings

Buttons, selects and inputs that sit on the same row share **height (`--control-h`), radius (3px), border colour (`--control-border`), font (`600 11px` DM Sans) and horizontal padding (`9px 13px`)**. A bare `<select>` is wrong: the browser default looks nothing like our buttons.

- `select` is globally restyled (no native arrow, our chevron, right padding for it). Never set `appearance`, `background-image` or arrow styles per component, and never use the `background:` shorthand on a select (it wipes the chevron); use `background-color`.
- Button variants: `.button` (outline), `.button.primary` (green fill), `.button.danger` / `.danger-outline` (destructive). Edit = outline, Delete = `danger-outline`, Save/New = `primary`.
- Row of actions: `.admin-row-actions` (flex, gap 8px, wraps). Put a dropdown next to Edit/Delete with `className="admin-status-select"` so it gets the same size and border as the buttons.
- Toolbar filters: `.admin-toolbar` (input flex:1, selects and primary button on the same line). Public filters: `.filters`.
- Forms: `.admin-form` with `label > span.lbl + control`. Two or three fields per line with `.admin-form-row`. Group optional contact info in a `fieldset`+`legend`.

## Required fields

Every mandatory control has the HTML `required` attribute **and** its label text wrapped as `<label><span className="lbl">Name</span><input required …/></label>`. CSS (`label:has(> :required)>.lbl::after`) then draws the red `*` automatically. Show `<p className="form-note"><b>*</b> Required</p>` at the top of long forms. Never put the asterisk in the text itself (it would break label queries and screen readers).

## Breadcrumbs

Every page except the home page renders `<Breadcrumbs items={crumbs} />` (Home › … › current). Public pages also emit `breadcrumbJsonLd(crumbs)`; admin pages do not (they are noindex). `tests/breadcrumbs.test.tsx` fails if a new `page.tsx` lacks breadcrumbs; add it to the exempt list only for redirects/the root.

## Loaders

Whenever an API call is pending the user must see it. A **button** that triggers the call gets `disabled` and `aria-busy={pending}`: CSS draws a spinner on its right side, so never swap the label for a spinner. Anything **not tied to one button** (refreshing a list, a row dropdown, opening a record) shows `<PageLoader show={…} label="…" />`, a centred overlay; use `blocking={false}` for background fetches like live search so typing keeps working. Typeahead fields show a small ring inside the field (`.place-field.busy`). Always clear the pending state in `finally`.

## Feedback toasts

Use `<Toast toast={toast} onClose={…} />` from `src/components/Toast.tsx` for the outcome of an action (never an inline banner for page-level results). Success is green (`role="status"`), error is red (`role="alert"`), both close themselves after 3 seconds (`TOAST_MS`), have a ✕ button, and a new toast restarts the timer. Errors that belong next to form fields stay inline in the form (not duplicated as a toast).

## Row detail views

A list row opens a read-only detail dialog on click (`ProductDetail`): the title is a real `<button>` for keyboard users, clicks on the row's own controls (select, Edit, Delete, links) keep their meaning, Escape/Done/✕/backdrop close it, Tab is trapped, focus returns to the title. Empty values show `—`. Admin-only data (account email, publisher, timestamps) comes from `toAdminProduct`, never the public mapper.

## Lists that users can extend (categories)

A select whose options live in the database (categories) ends with a `＋ Add a new…` entry that reveals an inline name box (Enter adds, Cancel closes) and posts to the API; the new value is selected immediately and the parent list is updated. Never hard-code such a list in a client component; pass it from the server page.

## Place and address inputs

Use `<PlaceInput name="…" />` (`src/components/PlaceInput.tsx`) for any location field: debounced type-ahead (3+ characters), keyboard navigation, `role="combobox"`, free text always allowed, silent when the service is down. Never call a geocoding service from the browser; go through `/api/places`.

## Validation

Validate on the server (source of truth, 400 with a specific message) **and** mirror it in the input (`pattern`, `type`, `min`/`max`, `maxLength`, a `title` hint). Keep shared rules in `src/lib/*` (e.g. `src/lib/phone.ts` exports the regex for the server and the matching `pattern` string for the form) and test that both agree.

## States and accessibility

- Focus: the global `:focus-visible` orange outline; do not remove it.
- Disabled: `opacity:.6` and `cursor:wait`/`not-allowed`.
- Icon-only buttons need `aria-label`; selects without a visible label need `aria-label`; modals use `role="dialog"`, trap focus and close on Escape.
- Images use `ProductImage` (https URL with illustrated fallback); decorative SVG/emoji get `aria-hidden`.
- Mobile: layouts collapse at 900px and 600px (see existing `@media` blocks); side gutter 5-6.5%; no horizontal scroll.

## Checklist before finishing any UI change

1. Reused existing classes/tokens; no new colours, fonts or one-off inline styles.
2. **Every font size is from the Type scale table**, compared against two sibling pages' CSS (not taken from a mockup), and a source-contract test pins the key sizes to `globals.css`.
3. Light and dark both work from tokens alone; text on an orange background is white.
4. Each fact and each contact channel appears once per screen size; no invented copy; nothing private reaches the public HTML.
5. Controls in one row have identical height, radius, border and font (check by eye at 100% zoom with an Edit/Delete button beside the new control).
6. Selects show the chevron and match neighbouring buttons.
7. Required fields have `required` + `.lbl` wrapper; optional ones do not.
8. Client rules mirror server rules and a test covers both.
9. Keyboard: tab order sensible, focus ring visible, Escape closes dialogs.
10. Looks right at 390px, about 700px (tablet) and 1280px: the title and the first facts are visible below the photo without scrolling past a huge image.
11. `npm test` and `npx tsc --noEmit` pass.
