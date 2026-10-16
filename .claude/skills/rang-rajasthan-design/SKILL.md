---
name: rang-rajasthan-design
description: Use when creating or changing any UI component, page, form, button, dropdown, card, dialog or CSS in the Rang Rajasthan marketplace. Defines the design tokens, control sizing, component patterns and a checklist so new UI matches the existing look.
---

# Rang Rajasthan design guidelines

Single stylesheet: `src/app/globals.css` (plain CSS, no Tailwind/CSS-in-JS). Fonts come from `src/app/layout.tsx`: `--font-sans` (DM Sans) for UI, `--font-serif` (Playfair Display) for headings and card titles. **Reuse existing classes before writing new CSS; extend globals.css, do not add inline styles or a second stylesheet.**

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
| `--control-h` | 36px | height of every admin control |
| `--control-border` | #cfc5b7 | border of outline buttons **and selects** |
| danger | #a74d35 (border #e0b9ad) | destructive actions |
| required marker | #d0312d | red asterisk |

Radius is `3px` for controls, `4-6px` for cards/dialogs, `30px` only for pills/badges. Type scale: 10-12px UI text (`font: 600 11px var(--font-sans)` for buttons), 17-18px serif card titles, 27-45px serif headings.

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

## Feedback toasts

Use `<Toast toast={toast} onClose={…} />` from `src/components/Toast.tsx` for the outcome of an action (never an inline banner for page-level results). Success is green (`role="status"`), error is red (`role="alert"`), both close themselves after 3 seconds (`TOAST_MS`), have a ✕ button, and a new toast restarts the timer. Errors that belong next to form fields stay inline in the form (not duplicated as a toast).

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
2. Controls in one row have identical height, radius, border and font (check by eye at 100% zoom with an Edit/Delete button beside the new control).
3. Selects show the chevron and match neighbouring buttons.
4. Required fields have `required` + `.lbl` wrapper; optional ones do not.
5. Client rules mirror server rules and a test covers both.
6. Keyboard: tab order sensible, focus ring visible, Escape closes dialogs.
7. Looks right at 600px width.
8. `npm test` and `npx tsc --noEmit` pass.
