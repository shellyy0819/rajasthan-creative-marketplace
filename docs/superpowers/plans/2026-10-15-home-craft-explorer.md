# Home Page Craft Explorer (Interlinked Filters + Illustrated Tiles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the home page, add two interlinked filter rows — "Explore Crochet / Leather / Wood / Resin" chips and circular illustrated collection tiles (Home & décor, Desk, Aesthetic decor, Accessories, Gifts & keepsakes) — that drive the product grid below, in the site's existing visual style.

**Architecture:** Replace keyword guessing with structured product data (`material`, `collections[]`) validated by the admin API. A pure, unit-tested module (`src/lib/explore.ts`) owns filtering, per-option counts, toggle/reconcile rules and URL (de)serialisation. One client component (`HomeCraftExplorer`) renders both rows from that module; the home page stays statically rendered (first paint = all products, URL state applied after mount). Tiles/chips show original inline-SVG illustrations (`CraftArt`) instead of emoji/icons.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (+ jsdom/Testing Library already installed), plain CSS in `src/app/globals.css`.

**Spec:** No spec doc. Requirements = user messages of 2026-10-15: "on home page, add 2 type of filters — Explore crochet, Explore Leather, Explore wood, Explore Resin; then show cards which has sub filters like 2nd image [circular tiles] but keep UI consistent as our product design; both filters should be interlinked", and "add relevant images instead of icons" (tile labels/counts as in the user's screenshot: "Home & décor 3 finds … Gifts & keepsakes 2 finds", heading "Handmade finds … 4 pieces").

## Pre-flight (do before Task 1)

The working tree has **uncommitted work that is not part of this plan**: seller contact fields (`artistName`, `instagram`, `youtube`, `phone`, `email`) in `src/lib/types.ts`, `src/lib/admin.ts`, `data/db.json`, `src/app/products/[slug]/page.tsx`; a prototype `src/components/HomeCraftExplorer.tsx` (keyword matching, no material row); `.craft-*` / `.product-card` CSS in `src/app/globals.css`; and a `HomeCraftExplorer` import in `src/app/page.tsx`. This plan edits several of those same files.

- [ ] **Step 1:** Ask the owner of that work to commit it first (suggested: `git add -A && git commit -m "wip: seller contact fields + craft explorer prototype"`). Do not discard it. Tasks below rewrite `HomeCraftExplorer.tsx` and replace its `.craft-*` CSS; everything else in that WIP is preserved.
- [ ] **Step 2:** Run `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH && npx vitest run` — Expected: all pass (101+) before starting.

## Global Constraints

- Keep the existing look: palette vars `--paper #f8f4ee`, `--cream #eee5d8`, `--green #405746`, `--orange #c66b43`, `--line #e5ddd1`, `--white #fffdf9`; fonts via `var(--font-serif)` (Playfair) and `var(--font-sans)` (DM Sans).
- No new runtime dependencies. No emoji or text glyphs as tile art — inline SVG only.
- Home page must stay statically rendered (`○ /` in `next build` output): no `searchParams`/cookies in `src/app/page.tsx`.
- First server render must equal the unfiltered state (no hydration mismatch); URL state is applied in an effect after mount.
- Selected state lives in the URL as `?craft=<material>&collection=<collection>` via `history.replaceState`; unknown values are ignored.
- All product data changes keep `tests/fixtures/db.json` valid (new fields are optional); the 4-product fixture and its tests must keep passing untouched.
- Commits use the repo identity (`shellyy0819`), end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A material or collection with **zero products overall** (e.g. Wood/Leather on old data) → option rendered disabled, never a dead "0 pieces" grid; a URL naming it is ignored. (Task 2 test + Task 4 test)
2. **Clicking an option that has 0 results under the other active filter** → the clicked filter wins and the other is cleared (never an empty result caused by the UI); clicking the active option again clears it. (Task 2 + Task 4)
3. **Garbage / conflicting URL params** (`?craft=<script>`, `?collection=nope`, repeated keys, `?craft=leather&collection=desk` where the pair is empty) → ignored or reconciled, no crash, SSR output unchanged. (Task 2 `parseSelection` tests, Task 4 mount test)
4. **Legacy products without `material`/`collections`** appear only under "All", never crash counts. **Sold-out** products still count and still render as "Sold out". (Task 2 + Task 4)
5. **Admin API input**: invalid `material`/`collections` (wrong slug, non-array, duplicates, >5 entries) → 400 with field name, nothing written; clearing with `""`/`[]` works. (Task 1)

---

## File Structure

- Create `src/lib/explore.ts` — constants (`MATERIALS`, `COLLECTIONS`), types, `filterProducts`, `collectionCounts`, `materialCounts`, `toggle`, `parseSelection`, `toQuery`. Client-safe, no `fs`.
- Create `src/components/CraftArt.tsx` — `<CraftArt slug={...} />` inline SVG illustrations (9 slugs).
- Rewrite `src/components/HomeCraftExplorer.tsx` — the two interlinked rows + results.
- Modify `src/lib/types.ts` (`material?`, `collections?`), `src/lib/admin.ts` (validate them), `data/db.json` (tag the 4 products, add 4 sample products so Leather and Wood are not empty), `src/app/globals.css` (replace `.craft-*` rules), `src/app/page.tsx` (keep the existing `<HomeCraftExplorer products={products} />` wiring), `README.md`.
- Tests: `tests/explore.test.ts`, `tests/craft-art.test.tsx`, `tests/home-craft-explorer.test.tsx`, additions to `tests/admin.test.ts`.

---

### Task 1: Product data model — `material` and `collections` (+ admin validation, seed data)

**Files:**
- Modify: `src/lib/types.ts:4`, `src/lib/admin.ts` (PRODUCT_KEYS, `validateProduct`), `data/db.json`
- Create: `src/lib/explore.ts` (constants + types only in this task)
- Test: `tests/admin.test.ts` (append)

**Interfaces:**
- Produces (`src/lib/explore.ts`): 
  - `MATERIALS: readonly [{slug:'crochet',label:'Crochet'},{slug:'leather',label:'Leather'},{slug:'wood',label:'Wood'},{slug:'resin',label:'Resin'}]`
  - `COLLECTIONS: readonly [{slug:'home-decor',label:'Home & décor'},{slug:'desk',label:'Desk'},{slug:'aesthetic-decor',label:'Aesthetic decor'},{slug:'accessories',label:'Accessories'},{slug:'gifts',label:'Gifts & keepsakes'}]`
  - `type MaterialSlug`, `type CollectionSlug`, `isMaterial(v: unknown): v is MaterialSlug`, `isCollection(v: unknown): v is CollectionSlug`
- Produces (`Product`): `material?: string; collections?: string[]`.

- [ ] **Step 1: Write failing tests** — append to `tests/admin.test.ts`:

```ts
describe('product material and collections', () => {
  it('stores valid material and collections on create', async () => {
    const p = await createProduct({ ...validProduct, material: 'leather', collections: ['desk', 'gifts'] });
    expect(p.material).toBe('leather');
    expect(p.collections).toEqual(['desk', 'gifts']);
  });
  it('both are optional (legacy shape still valid)', async () => {
    const p = await createProduct(validProduct);
    expect(p.material).toBeUndefined();
    expect(p.collections).toBeUndefined();
  });
  it('rejects bad material / collections with the field name and writes nothing', async () => {
    for (const [extra, field] of [
      [{ material: 'plastic' }, 'material'],
      [{ material: 5 }, 'material'],
      [{ collections: 'desk' }, 'collections'],
      [{ collections: ['nope'] }, 'collections'],
      [{ collections: ['desk', 'desk'] }, 'collections'],
      [{ collections: ['home-decor', 'desk', 'aesthetic-decor', 'accessories', 'gifts', 'desk'] }, 'collections'],
    ] as const) {
      await expect(createProduct({ ...validProduct, ...extra })).rejects.toMatchObject({ status: 400, message: expect.stringContaining(field) });
    }
    expect((await readDb()).products).toHaveLength(4);
  });
  it('patch can set and clear them', async () => {
    await updateProduct('p1', { material: 'resin', collections: ['gifts'] });
    expect((await readDb()).products[0]).toMatchObject({ material: 'resin', collections: ['gifts'] });
    await updateProduct('p1', { material: '', collections: [] });
    const p = (await readDb()).products[0];
    expect(p.material).toBeUndefined();
    expect(p.collections).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/admin.test.ts` — Expected: FAIL (new tests; `material` ignored/undefined).

- [ ] **Step 3: Implement**

`src/lib/explore.ts` (constants only for now):
```ts
export const MATERIALS = [
  { slug: 'crochet', label: 'Crochet' },
  { slug: 'leather', label: 'Leather' },
  { slug: 'wood', label: 'Wood' },
  { slug: 'resin', label: 'Resin' },
] as const;

export const COLLECTIONS = [
  { slug: 'home-decor', label: 'Home & décor' },
  { slug: 'desk', label: 'Desk' },
  { slug: 'aesthetic-decor', label: 'Aesthetic decor' },
  { slug: 'accessories', label: 'Accessories' },
  { slug: 'gifts', label: 'Gifts & keepsakes' },
] as const;

export type MaterialSlug = (typeof MATERIALS)[number]['slug'];
export type CollectionSlug = (typeof COLLECTIONS)[number]['slug'];

export const isMaterial = (v: unknown): v is MaterialSlug => MATERIALS.some(m => m.slug === v);
export const isCollection = (v: unknown): v is CollectionSlug => COLLECTIONS.some(c => c.slug === v);
```
`src/lib/types.ts` line 4 → `artistName?: string; instagram?: string; youtube?: string; phone?: string; email?: string;\n  material?: string; collections?: string[];`

`src/lib/admin.ts`: add `'material', 'collections'` to `PRODUCT_KEYS`; add import `import { COLLECTIONS, isCollection, isMaterial } from './explore';`; add helpers above `validateProduct`:
```ts
function optionalMaterial(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (!isMaterial(v)) throw bad('material must be one of: crochet, leather, wood, resin.');
  return v;
}
function optionalCollections(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > COLLECTIONS.length || !v.every(isCollection) || new Set(v).size !== v.length)
    throw bad(`collections must be a list of unique values from: ${COLLECTIONS.map(c => c.slug).join(', ')}.`);
  return v.length ? v : undefined;
}
```
and in the object returned by `validateProduct` add `material: optionalMaterial(v.material),` and `collections: optionalCollections(v.collections),`. (`Object.assign(p, validateProduct(...))` in `updateProduct` must clear removed keys: change that line to `Object.assign(p, { material: undefined, collections: undefined }, validateProduct({ ...p, ...patch }));` — `JSON.stringify` drops undefined so cleared fields disappear from `db.json`.)

`data/db.json`: tag existing products and add four samples (keep every other existing field, including the seller contact fields, exactly as they are). Final `products` entries to add/merge:
```json
{"id":"p1", "...existing fields...", "material":"crochet", "collections":["home-decor","gifts"]},
{"id":"p2", "...existing fields...", "material":"crochet", "collections":["accessories","gifts"]},
{"id":"p3", "...existing fields...", "material":"resin",   "collections":["home-decor","desk","aesthetic-decor"]},
{"id":"p4", "...existing fields...", "collections":["home-decor","aesthetic-decor"]},
{"id":"p5","name":"Leather Card Holder","category":"Accessories","city":"Jaipur","pricePaise":55000,"seller":"Chamda Works","description":"Hand-stitched vegetable-tanned leather card holder.","stock":10,"status":"APPROVED","material":"leather","collections":["accessories","gifts"]},
{"id":"p6","name":"Leather Desk Mat","category":"Accessories","city":"Jodhpur","pricePaise":120000,"seller":"Chamda Works","description":"Stitched leather desk mat with a soft felt underside.","stock":4,"status":"APPROVED","material":"leather","collections":["desk","aesthetic-decor"]},
{"id":"p7","name":"Sheesham Pen Stand","category":"Accessories","city":"Udaipur","pricePaise":38000,"seller":"Lakdi Studio","description":"Hand-carved sheesham wood pen stand for your desk.","stock":7,"status":"APPROVED","material":"wood","collections":["desk","home-decor"]},
{"id":"p8","name":"Carved Wood Wall Hook","category":"Accessories","city":"Udaipur","pricePaise":32000,"seller":"Lakdi Studio","description":"Carved wooden wall hook with a hand-painted finish.","stock":0,"status":"APPROVED","material":"wood","collections":["aesthetic-decor","home-decor"]}
```
(`p8` is deliberately sold out so the UI's sold-out counting is exercised on real data.)

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass (existing 4-product fixture tests untouched).

- [ ] **Step 5: Commit**
```bash
git add src/lib/explore.ts src/lib/types.ts src/lib/admin.ts data/db.json tests/admin.test.ts
git commit -m "feat: product material and collections fields with admin validation"
```

---

### Task 2: Pure interlinking logic — `explore.ts`

**Files:**
- Modify: `src/lib/explore.ts` (append)
- Test: `tests/explore.test.ts`

**Interfaces:**
- Consumes: `MATERIALS`, `COLLECTIONS`, `isMaterial`, `isCollection`, `Product`.
- Produces:
  - `type Selection = { material?: MaterialSlug; collection?: CollectionSlug }`
  - `filterProducts(products: Product[], sel: Selection): Product[]`
  - `collectionCounts(products: Product[], material?: MaterialSlug): Record<CollectionSlug, number>` — counts within the chosen material (all products when undefined)
  - `materialCounts(products: Product[], collection?: CollectionSlug): Record<MaterialSlug, number>`
  - `toggle(sel: Selection, key: 'material'|'collection', value: string, products: Product[]): Selection` — same value again clears it; otherwise sets it, and if the result is empty clears the *other* key (clicked wins); if the value has zero products overall, returns `sel` unchanged
  - `parseSelection(search: string, products: Product[]): Selection` — reads `craft` + `collection`, ignores invalid/unknown, drops `collection` then `material` if the combination has no products
  - `toQuery(sel: Selection): string` — `'craft=leather&collection=desk'`, `''` when empty

- [ ] **Step 1: Write failing tests** `tests/explore.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { filterProducts, collectionCounts, materialCounts, toggle, parseSelection, toQuery } from '@/lib/explore';
import type { Product } from '@/lib/types';

const p = (id: string, material: string | undefined, collections: string[] | undefined, stock = 5): Product => ({
  id, name: id, category: 'Accessories', city: 'Jaipur', pricePaise: 1000, seller: 's', description: 'd', stock, status: 'APPROVED', material, collections,
});
const products = [
  p('a', 'crochet', ['home-decor', 'gifts']),
  p('b', 'crochet', ['accessories', 'gifts']),
  p('c', 'resin', ['home-decor', 'desk', 'aesthetic-decor']),
  p('d', undefined, ['home-decor']),
  p('e', 'leather', ['accessories'], 0), // sold out still counts
  p('f', 'wood', ['desk']),
  p('legacy', undefined, undefined),     // old record without tags
];
const ids = (l: Product[]) => l.map(x => x.id);

describe('filterProducts', () => {
  it('no selection → everything, including legacy records', () => {
    expect(filterProducts(products, {})).toHaveLength(7);
  });
  it('material only / collection only / both', () => {
    expect(ids(filterProducts(products, { material: 'crochet' }))).toEqual(['a', 'b']);
    expect(ids(filterProducts(products, { collection: 'desk' }))).toEqual(['c', 'f']);
    expect(ids(filterProducts(products, { material: 'resin', collection: 'desk' }))).toEqual(['c']);
  });
  it('legacy records only appear with no selection', () => {
    expect(ids(filterProducts(products, { collection: 'home-decor' }))).not.toContain('legacy');
    expect(ids(filterProducts(products, { material: 'wood' }))).not.toContain('legacy');
  });
});

describe('counts are interlinked', () => {
  it('collectionCounts without material = whole catalogue', () => {
    expect(collectionCounts(products, undefined)).toEqual({ 'home-decor': 3, desk: 2, 'aesthetic-decor': 1, accessories: 2, gifts: 2 });
  });
  it('collectionCounts follows the selected material (sold-out counted)', () => {
    expect(collectionCounts(products, 'leather')).toEqual({ 'home-decor': 0, desk: 0, 'aesthetic-decor': 0, accessories: 1, gifts: 0 });
  });
  it('materialCounts follows the selected collection', () => {
    expect(materialCounts(products, undefined)).toEqual({ crochet: 2, leather: 1, wood: 1, resin: 1 });
    expect(materialCounts(products, 'desk')).toEqual({ crochet: 0, leather: 0, wood: 1, resin: 1 });
  });
});

describe('toggle', () => {
  it('selecting sets; selecting the same value clears', () => {
    const s1 = toggle({}, 'material', 'leather', products);
    expect(s1).toEqual({ material: 'leather' });
    expect(toggle(s1, 'material', 'leather', products)).toEqual({});
  });
  it('switching material keeps the collection when still non-empty', () => {
    expect(toggle({ material: 'wood', collection: 'desk' }, 'material', 'resin', products)).toEqual({ material: 'resin', collection: 'desk' });
  });
  it('clicked option wins: an empty combination clears the other filter', () => {
    expect(toggle({ material: 'leather' }, 'collection', 'home-decor', products)).toEqual({ collection: 'home-decor' });
    expect(toggle({ collection: 'gifts' }, 'material', 'resin', products)).toEqual({ material: 'resin' });
  });
  it('an option with zero products overall is ignored', () => {
    const noWood = products.filter(x => x.material !== 'wood');
    expect(toggle({ material: 'leather' }, 'material', 'wood', noWood)).toEqual({ material: 'leather' });
    expect(toggle({}, 'material', 'nope', products)).toEqual({});
  });
});

describe('parseSelection / toQuery', () => {
  it('reads valid params', () => {
    expect(parseSelection('?craft=resin&collection=desk', products)).toEqual({ material: 'resin', collection: 'desk' });
  });
  it('ignores garbage, unknown slugs and repeated keys (first value only)', () => {
    expect(parseSelection('?craft=<script>&collection=nope', products)).toEqual({});
    expect(parseSelection('?craft=nope&craft=wood', products)).toEqual({});
    expect(parseSelection('', products)).toEqual({});
    expect(parseSelection('craft=wood', products)).toEqual({ material: 'wood' });
  });
  it('drops a collection that makes the pair empty, then an empty material', () => {
    expect(parseSelection('?craft=leather&collection=desk', products)).toEqual({ material: 'leather' });
    const noWood = products.filter(x => x.material !== 'wood');
    expect(parseSelection('?craft=wood', noWood)).toEqual({});
  });
  it('toQuery serialises in stable order', () => {
    expect(toQuery({})).toBe('');
    expect(toQuery({ collection: 'desk', material: 'wood' })).toBe('craft=wood&collection=desk');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/explore.test.ts` — Expected: FAIL ("filterProducts is not a function" / import error).

- [ ] **Step 3: Implement** — append to `src/lib/explore.ts` (add `import type { Product } from './types';` at the top):

```ts
export type Selection = { material?: MaterialSlug; collection?: CollectionSlug };

const hasMaterial = (p: Product, m?: MaterialSlug) => !m || p.material === m;
const hasCollection = (p: Product, c?: CollectionSlug) => !c || (p.collections ?? []).includes(c);

export const filterProducts = (products: Product[], sel: Selection): Product[] =>
  products.filter(p => hasMaterial(p, sel.material) && hasCollection(p, sel.collection));

export function collectionCounts(products: Product[], material?: MaterialSlug): Record<CollectionSlug, number> {
  const within = products.filter(p => hasMaterial(p, material));
  return Object.fromEntries(COLLECTIONS.map(c => [c.slug, within.filter(p => hasCollection(p, c.slug)).length])) as Record<CollectionSlug, number>;
}

export function materialCounts(products: Product[], collection?: CollectionSlug): Record<MaterialSlug, number> {
  const within = products.filter(p => hasCollection(p, collection));
  return Object.fromEntries(MATERIALS.map(m => [m.slug, within.filter(p => p.material === m.slug).length])) as Record<MaterialSlug, number>;
}

export function toggle(sel: Selection, key: 'material' | 'collection', value: string, products: Product[]): Selection {
  const valid = key === 'material' ? isMaterial(value) : isCollection(value);
  if (!valid) return sel;
  if (sel[key] === value) {
    const { [key]: _removed, ...rest } = sel;
    return rest;
  }
  const next: Selection = { ...sel, [key]: value };
  if (filterProducts(products, next).length > 0) return next;
  const other = key === 'material' ? 'collection' : 'material';
  const alone: Selection = { [key]: value };
  if (filterProducts(products, alone).length === 0) return sel; // nothing exists for it at all
  void other;
  return alone;
}

export function parseSelection(search: string, products: Product[]): Selection {
  const sp = new URLSearchParams(search);
  const craft = sp.get('craft');
  const collection = sp.get('collection');
  let sel: Selection = {};
  if (isMaterial(craft)) sel.material = craft;
  if (isCollection(collection)) sel.collection = collection;
  if (filterProducts(products, sel).length === 0 && sel.collection) { const { collection: _c, ...rest } = sel; sel = rest; }
  if (filterProducts(products, sel).length === 0 && sel.material) { const { material: _m, ...rest } = sel; sel = rest; }
  return sel;
}

export function toQuery(sel: Selection): string {
  const sp = new URLSearchParams();
  if (sel.material) sp.set('craft', sel.material);
  if (sel.collection) sp.set('collection', sel.collection);
  return sp.toString();
}
```
(Clean-up while here: delete the unused `other` variable and the `void other;` line in `toggle`; they are dead code.)

- [ ] **Step 4: Run** `npx vitest run tests/explore.test.ts` — Expected: PASS. Then `npx vitest run` — Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add src/lib/explore.ts tests/explore.test.ts
git commit -m "feat: pure interlinked filter logic for craft explorer"
```

---

### Task 3: Illustrations — `CraftArt`

**Files:**
- Create: `src/components/CraftArt.tsx`
- Test: `tests/craft-art.test.tsx`

**Interfaces:**
- Consumes: `MATERIALS`, `COLLECTIONS` (slugs).
- Produces: `<CraftArt slug={MaterialSlug | CollectionSlug} />` → decorative `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">` filling its container; returns `null` for unknown slugs.

- [ ] **Step 1: Failing test** `tests/craft-art.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CraftArt } from '@/components/CraftArt';
import { MATERIALS, COLLECTIONS } from '@/lib/explore';

afterEach(cleanup);

describe('CraftArt', () => {
  it('renders a decorative svg illustration for every material and collection', () => {
    for (const { slug } of [...MATERIALS, ...COLLECTIONS]) {
      const { container, unmount } = render(<CraftArt slug={slug} />);
      const svg = container.querySelector('svg');
      expect(svg, slug).toBeTruthy();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
      expect(svg!.querySelectorAll('path,circle,rect,ellipse').length, slug).toBeGreaterThan(2);
      expect(container.textContent, `${slug} must not use text/emoji glyphs`).toBe('');
      unmount();
    }
  });
  it('renders nothing for an unknown slug', () => {
    const { container } = render(<CraftArt slug={'nope' as never} />);
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/craft-art.test.tsx` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/components/CraftArt.tsx` (original flat illustrations in the site palette: green `#405746`, orange `#c66b43`, tan `#d18c60`, cream `#f5e8d6`, sage `#a8b39a`, peach `#e5b28c`):

```tsx
import type { CollectionSlug, MaterialSlug } from '@/lib/explore';

const CAP = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ART: Record<MaterialSlug | CollectionSlug, React.ReactNode> = {
  // materials
  crochet: (<>
    <circle cx="60" cy="60" r="30" fill="#c66b43" />
    <path d="M36 50c18 8 30 8 48-4M32 64c20 10 36 10 56-4M40 80c16 6 28 4 42-6" stroke="#f5e8d6" strokeWidth="3" fill="none" opacity=".85" {...CAP} />
    <path d="M82 84c10 6 18 2 24 10" stroke="#c66b43" strokeWidth="4" fill="none" {...CAP} />
  </>),
  leather: (<>
    <rect x="26" y="38" width="68" height="46" rx="8" fill="#8a5a3c" />
    <rect x="26" y="38" width="68" height="16" rx="8" fill="#a56d48" />
    <rect x="34" y="46" width="52" height="30" rx="5" fill="none" stroke="#e5c9a8" strokeWidth="2" strokeDasharray="4 3" />
    <circle cx="86" cy="62" r="4" fill="#e5c9a8" />
  </>),
  wood: (<>
    <circle cx="60" cy="60" r="34" fill="#c9a06b" />
    <circle cx="60" cy="60" r="26" fill="none" stroke="#a8794a" strokeWidth="3" />
    <circle cx="60" cy="60" r="17" fill="none" stroke="#a8794a" strokeWidth="3" />
    <circle cx="60" cy="60" r="8" fill="none" stroke="#a8794a" strokeWidth="3" />
    <circle cx="60" cy="60" r="2" fill="#a8794a" />
  </>),
  resin: (<>
    <circle cx="60" cy="60" r="34" fill="#dbe5e2" stroke="#9db8b2" strokeWidth="3" />
    <circle cx="60" cy="60" r="26" fill="#bcd4cf" opacity=".6" />
    <g fill="#f5e8d6"><circle cx="60" cy="44" r="6" /><circle cx="71" cy="52" r="6" /><circle cx="67" cy="65" r="6" /><circle cx="53" cy="65" r="6" /><circle cx="49" cy="52" r="6" /></g>
    <circle cx="60" cy="56" r="5" fill="#d18c60" />
  </>),
  // collections
  'home-decor': (<>
    <path d="M45 52h30c4 10 6 24 2 38a8 8 0 0 1-8 6H51a8 8 0 0 1-8-6c-4-14-2-28 2-38z" fill="#c66b43" />
    <rect x="48" y="44" width="24" height="9" rx="3" fill="#a8532f" />
    <path d="M60 44V24M60 44 44 30M60 44l16-14" stroke="#405746" strokeWidth="3" fill="none" {...CAP} />
    <circle cx="60" cy="20" r="8" fill="#e5b28c" /><circle cx="42" cy="27" r="7" fill="#f5e8d6" /><circle cx="78" cy="27" r="7" fill="#e5b28c" />
    <circle cx="60" cy="20" r="3" fill="#c66b43" />
  </>),
  desk: (<>
    <ellipse cx="44" cy="96" rx="22" ry="5" fill="#405746" />
    <path d="M44 94 52 58 80 42" stroke="#405746" strokeWidth="4" fill="none" {...CAP} />
    <path d="M70 32l22 14-8 12-22-14z" fill="#c66b43" />
    <circle cx="88" cy="64" r="3" fill="#e5b28c" />
    <rect x="86" y="80" width="18" height="16" rx="3" fill="#a8b39a" />
  </>),
  'aesthetic-decor': (<>
    <path d="M34 100V56a26 26 0 0 1 52 0v44z" fill="#f5e8d6" stroke="#8b987e" strokeWidth="3" />
    <circle cx="60" cy="58" r="12" fill="#d18c60" />
    <path d="M44 84h32M44 92h32" stroke="#a8b39a" strokeWidth="3" {...CAP} />
  </>),
  accessories: (<>
    <path d="M42 52a18 18 0 0 1 36 0" stroke="#405746" strokeWidth="5" fill="none" {...CAP} />
    <path d="M30 52h60l6 44a6 6 0 0 1-6 7H30a6 6 0 0 1-6-7z" fill="#c66b43" />
    <rect x="52" y="64" width="16" height="12" rx="3" fill="#f5e8d6" />
  </>),
  gifts: (<>
    <rect x="30" y="52" width="60" height="44" rx="4" fill="#a8b39a" />
    <rect x="26" y="42" width="68" height="14" rx="4" fill="#405746" />
    <rect x="55" y="42" width="10" height="54" fill="#e5b28c" />
    <path d="M60 42c-14-18-26-6-14 0M60 42c14-18 26-6 14 0" stroke="#c66b43" strokeWidth="4" fill="none" {...CAP} />
  </>),
};

export function CraftArt({ slug }: { slug: MaterialSlug | CollectionSlug }) {
  const art = ART[slug];
  if (!art) return null;
  return <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">{art}</svg>;
}
```
(add `import type React from 'react';` at the top if the compiler asks for the `React.ReactNode` type.)

- [ ] **Step 4: Run** `npx vitest run tests/craft-art.test.tsx` — Expected: PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/CraftArt.tsx tests/craft-art.test.tsx
git commit -m "feat: illustrated SVG art for crafts and collections"
```

---

### Task 4: `HomeCraftExplorer` — the two interlinked rows, results, styles

**Files:**
- Rewrite: `src/components/HomeCraftExplorer.tsx` (replaces the prototype)
- Modify: `src/app/globals.css` (replace every `.craft-*` rule from the prototype)
- Test: `tests/home-craft-explorer.test.tsx`

**Interfaces:**
- Consumes: `MATERIALS`, `COLLECTIONS`, `Selection`, `filterProducts`, `collectionCounts`, `materialCounts`, `toggle`, `parseSelection`, `toQuery` (Task 2); `CraftArt` (Task 3); `ProductGrid` (existing, takes `products: Product[]`).
- Produces: `<HomeCraftExplorer products={Product[]} />` (client). Behavior contract:
  - Row 1 (`role="group"`, label "Explore by craft"): an "All" chip plus `Explore <Label>` chips with illustration + count (count = products in that material under the active collection).
  - Row 2 (`role="group"`, label "Explore collections"): five circular illustrated tiles with name and `N find(s)` (count under the active material).
  - Option disabled iff it has zero products overall and is not selected. Option with zero under the other active filter gets class `is-empty` (dimmed) but stays clickable (clicked wins, per `toggle`).
  - `aria-pressed` on every chip/tile; heading = selected collection label, else `"<Material> finds"`, else `"Handmade finds"`; count text `N piece(s)` in a `role="status"` element.
  - On mount: `parseSelection(location.search)`; on every change `history.replaceState` to `pathname + (qs ? '?'+qs : '') + hash`.

- [ ] **Step 1: Failing tests** `tests/home-craft-explorer.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/AddToCartButton', () => ({ AddToCartButton: ({ product }: any) => <button disabled={product.stock < 1}>{product.stock < 1 ? 'Sold out' : 'add'}</button> }));

import { HomeCraftExplorer } from '@/components/HomeCraftExplorer';
import type { Product } from '@/lib/types';

const p = (id: string, material: string | undefined, collections: string[] | undefined, stock = 5): Product => ({
  id, name: `Item ${id}`, category: 'Accessories', city: 'Jaipur', pricePaise: 1000, seller: 's', description: 'd', stock, status: 'APPROVED', material, collections,
});
const products = [
  p('a', 'crochet', ['home-decor', 'gifts']),
  p('b', 'crochet', ['accessories', 'gifts']),
  p('c', 'resin', ['home-decor', 'desk', 'aesthetic-decor']),
  p('d', undefined, ['home-decor']),
  p('e', 'leather', ['accessories'], 0),
  p('f', 'wood', ['desk']),
  p('legacy', undefined, undefined),
];

const chip = (re: RegExp) => screen.getByRole('button', { name: re });
const tile = (name: string) => within(screen.getByRole('group', { name: 'Explore collections' })).getByRole('button', { name: new RegExp(`^${name}`) });
const shown = () => screen.queryAllByText(/^Item /).map(e => e.textContent);
const status = () => screen.getByRole('status').textContent;

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(cleanup);

describe('HomeCraftExplorer', () => {
  it('first render is unfiltered: all products, heading "Handmade finds", 7 pieces', () => {
    render(<HomeCraftExplorer products={products} />);
    expect(shown()).toHaveLength(7);
    expect(screen.getByRole('heading', { name: 'Handmade finds' })).toBeTruthy();
    expect(status()).toMatch(/7 pieces/);
  });

  it('renders both filter rows with illustrations, not emoji/text icons', () => {
    const { container } = render(<HomeCraftExplorer products={products} />);
    for (const l of ['Crochet', 'Leather', 'Wood', 'Resin']) expect(chip(new RegExp(`Explore ${l}`))).toBeTruthy();
    for (const l of ['Home & décor', 'Desk', 'Aesthetic decor', 'Accessories', 'Gifts & keepsakes']) expect(tile(l)).toBeTruthy();
    expect(container.querySelectorAll('.craft-collection svg')).toHaveLength(5);
    expect(container.querySelectorAll('.craft-chip svg')).toHaveLength(4);
    expect(container.textContent).not.toMatch(/[⌂❋✳🧶👜🪵🌼]/u);
  });

  it('tile counts show finds per collection', () => {
    render(<HomeCraftExplorer products={products} />);
    expect(tile('Home & décor').textContent).toMatch(/3 finds/);
    expect(tile('Aesthetic decor').textContent).toMatch(/1 find\b/);
  });

  it('picking a craft filters results AND re-counts the collection tiles', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(chip(/Explore Leather/));
    expect(shown()).toEqual(['Item e']);
    expect(status()).toMatch(/1 piece\b/);
    expect(screen.getByRole('heading', { name: 'Leather finds' })).toBeTruthy();
    expect(tile('Accessories').textContent).toMatch(/1 find\b/);
    expect(tile('Home & décor').textContent).toMatch(/0 finds/);
    expect(tile('Home & décor').className).toContain('is-empty');
    expect((tile('Home & décor') as HTMLButtonElement).disabled).toBe(false);
    expect(chip(/Explore Leather/).getAttribute('aria-pressed')).toBe('true');
  });

  it('picking a collection re-counts the craft chips', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(tile('Desk'));
    expect(shown().sort()).toEqual(['Item c', 'Item f']);
    expect(screen.getByRole('heading', { name: 'Desk' })).toBeTruthy();
    expect(chip(/Explore Wood/).textContent).toMatch(/1/);
    expect(chip(/Explore Crochet/).className).toContain('is-empty');
    expect(chip(/Explore Crochet/).textContent).toMatch(/0/);
  });

  it('both selected = intersection', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(chip(/Explore Resin/));
    fireEvent.click(tile('Desk'));
    expect(shown()).toEqual(['Item c']);
  });

  it('clicking an option that is empty under the other filter replaces the other filter', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(chip(/Explore Leather/));
    fireEvent.click(tile('Home & décor'));
    expect(shown().sort()).toEqual(['Item a', 'Item c', 'Item d']);
    expect(chip(/Explore Leather/).getAttribute('aria-pressed')).toBe('false');
    expect(tile('Home & décor').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the active option again, or "All", clears', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(tile('Desk'));
    fireEvent.click(tile('Desk'));
    expect(shown()).toHaveLength(7);
    fireEvent.click(chip(/Explore Wood/));
    fireEvent.click(chip(/^All/));
    expect(shown()).toHaveLength(7);
    expect(chip(/^All/).getAttribute('aria-pressed')).toBe('true');
  });

  it('a craft with zero products overall is disabled and does nothing', () => {
    render(<HomeCraftExplorer products={products.filter(x => x.material !== 'wood')} />);
    const wood = chip(/Explore Wood/) as HTMLButtonElement;
    expect(wood.disabled).toBe(true);
    fireEvent.click(wood);
    expect(shown()).toHaveLength(6);
  });

  it('sold-out products are counted and shown as Sold out', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(chip(/Explore Leather/));
    expect(screen.getByText('Sold out')).toBeTruthy();
  });

  it('legacy products without tags only show under All', () => {
    render(<HomeCraftExplorer products={products} />);
    expect(shown()).toContain('Item legacy');
    fireEvent.click(chip(/Explore Crochet/));
    expect(shown()).not.toContain('Item legacy');
  });

  it('keeps the URL in sync (shareable) and clears it when unfiltered', () => {
    render(<HomeCraftExplorer products={products} />);
    fireEvent.click(chip(/Explore Resin/));
    expect(window.location.search).toBe('?craft=resin');
    fireEvent.click(tile('Desk'));
    expect(window.location.search).toBe('?craft=resin&collection=desk');
    fireEvent.click(chip(/^All/));
    fireEvent.click(tile('Desk'));
    expect(window.location.search).toBe('?collection=desk');
    fireEvent.click(tile('Desk'));
    expect(window.location.search).toBe('');
  });

  it('applies the URL on mount; garbage and conflicting params are ignored', () => {
    window.history.replaceState(null, '', '/?craft=wood&collection=desk');
    render(<HomeCraftExplorer products={products} />);
    expect(shown()).toEqual(['Item f']);
    cleanup();
    window.history.replaceState(null, '', '/?craft=<script>&collection=nope');
    render(<HomeCraftExplorer products={products} />);
    expect(shown()).toHaveLength(7);
    cleanup();
    window.history.replaceState(null, '', '/?craft=leather&collection=desk');
    render(<HomeCraftExplorer products={products} />);
    expect(shown()).toEqual(['Item e']);
  });

  it('shows an empty state instead of crashing when there are no products', () => {
    render(<HomeCraftExplorer products={[]} />);
    expect(screen.getByText(/No finds match/)).toBeTruthy();
    expect(status()).toMatch(/0 pieces/);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/home-craft-explorer.test.tsx` — Expected: FAIL (prototype has no material row / roles / counts logic).

- [ ] **Step 3: Implement**

Overwrite `src/components/HomeCraftExplorer.tsx`:
```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/lib/types';
import {
  COLLECTIONS, MATERIALS, collectionCounts, filterProducts, materialCounts, parseSelection, toQuery, toggle,
  type Selection,
} from '@/lib/explore';
import { CraftArt } from './CraftArt';
import { ProductGrid } from './ProductGrid';

const finds = (n: number) => `${n} ${n === 1 ? 'find' : 'finds'}`;

export function HomeCraftExplorer({ products }: { products: Product[] }) {
  const [sel, setSel] = useState<Selection>({});

  // Apply ?craft=&collection= after mount so the server render (unfiltered) always matches hydration.
  useEffect(() => { setSel(parseSelection(window.location.search, products)); }, [products]);

  const apply = (next: Selection) => {
    setSel(next);
    const qs = toQuery(next);
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const byCollection = useMemo(() => collectionCounts(products, sel.material), [products, sel.material]);
  const byMaterial = useMemo(() => materialCounts(products, sel.collection), [products, sel.collection]);
  const totalCollection = useMemo(() => collectionCounts(products), [products]);
  const totalMaterial = useMemo(() => materialCounts(products), [products]);
  const visible = useMemo(() => filterProducts(products, sel), [products, sel]);

  const material = MATERIALS.find(m => m.slug === sel.material);
  const collection = COLLECTIONS.find(c => c.slug === sel.collection);
  const heading = collection?.label ?? (material ? `${material.label} finds` : 'Handmade finds');

  return (
    <div className="craft-explorer">
      <div className="craft-materials" role="group" aria-label="Explore by craft">
        <span className="craft-materials-label" aria-hidden="true">EXPLORE</span>
        <button type="button" className={`craft-chip${sel.material ? '' : ' selected'}`} aria-pressed={!sel.material}
          onClick={() => apply({ collection: sel.collection })}>
          All
        </button>
        {MATERIALS.map(m => {
          const count = byMaterial[m.slug];
          const selected = sel.material === m.slug;
          return (
            <button key={m.slug} type="button" aria-pressed={selected}
              className={`craft-chip${selected ? ' selected' : ''}${count === 0 ? ' is-empty' : ''}`}
              disabled={totalMaterial[m.slug] === 0 && !selected}
              onClick={() => apply(toggle(sel, 'material', m.slug, products))}>
              <span className="craft-chip-art"><CraftArt slug={m.slug} /></span>
              Explore {m.label} <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="craft-subfilters" role="group" aria-label="Explore collections">
        {COLLECTIONS.map(c => {
          const count = byCollection[c.slug];
          const selected = sel.collection === c.slug;
          return (
            <button key={c.slug} type="button" aria-pressed={selected}
              className={`craft-collection${selected ? ' selected' : ''}${count === 0 ? ' is-empty' : ''}`}
              disabled={totalCollection[c.slug] === 0 && !selected}
              onClick={() => apply(toggle(sel, 'collection', c.slug, products))}>
              <span className="craft-collection-art"><CraftArt slug={c.slug} /></span>
              <span className="craft-collection-name">{c.label}</span>
              <span className="craft-collection-count">{finds(count)}</span>
            </button>
          );
        })}
      </div>

      <div className="craft-results">
        <div className="craft-results-heading">
          <h3>{heading}</h3>
          <span role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'piece' : 'pieces'}</span>
        </div>
        <ProductGrid products={visible} />
      </div>
    </div>
  );
}
```
(`ProductGrid` already renders "No finds match those filters…" for an empty list.)

`src/app/globals.css`: first remove every prototype rule that mentions `.craft-` (they sit on whole lines appended at the end of the file):
```bash
grep -n "craft-" src/app/globals.css | cut -c1-80      # inspect: every matching line must contain ONLY .craft-* rules
python3 - <<'EOF'
p='src/app/globals.css'; lines=open(p).read().split('\n')
open(p,'w').write('\n'.join(l for l in lines if '.craft-' not in l))
EOF
grep -c "craft-" src/app/globals.css                   # Expected: 0
```
If the inspect step shows a line that mixes `.craft-` with unrelated rules (e.g. `.product-card`, `.detail-*`), move those unrelated rules to their own line before deleting. Then append:
```css
.craft-explorer{margin-top:28px}
.craft-materials{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-bottom:28px}
.craft-materials-label{font:700 9px var(--font-sans),sans-serif;letter-spacing:2px;color:var(--orange);margin-right:6px}
.craft-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #d9d2c7;background:var(--white);color:var(--ink);border-radius:30px;padding:5px 16px 5px 6px;font:600 11px var(--font-sans),sans-serif;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.craft-chip:first-of-type{padding:11px 18px}
.craft-chip-art{width:30px;height:30px;border-radius:50%;background:var(--cream);display:grid;place-items:center;overflow:hidden;flex:none}
.craft-chip-art svg{width:84%;height:84%}
.craft-chip small{font-size:9px;opacity:.7}
.craft-chip:hover:not(:disabled),.craft-chip.selected{background:var(--green);border-color:var(--green);color:#fff}
.craft-chip.selected .craft-chip-art{background:#fff3}
.craft-chip.is-empty:not(.selected){opacity:.5}
.craft-chip:disabled,.craft-collection:disabled{opacity:.35;cursor:not-allowed}
.craft-subfilters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px;margin:4px 0 38px}
.craft-collection{display:flex;flex-direction:column;align-items:center;gap:9px;border:0;background:transparent;color:var(--ink);font:inherit;cursor:pointer;padding:0}
.craft-collection-art{width:min(100%,170px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:#eadfd0;overflow:hidden;transition:transform .2s,box-shadow .2s,background .2s}
.craft-collection-art svg{width:74%;height:74%}
.craft-collection:nth-child(2) .craft-collection-art{background:#dce2d5}
.craft-collection:nth-child(3) .craft-collection-art{background:#ead8c5}
.craft-collection:nth-child(4) .craft-collection-art{background:#e8e1d6}
.craft-collection:hover:not(:disabled) .craft-collection-art,.craft-collection.selected .craft-collection-art{transform:translateY(-3px);box-shadow:0 0 0 3px var(--paper),0 0 0 5px var(--orange)}
.craft-collection.selected .craft-collection-art{background:#d9e0d3}
.craft-collection.is-empty:not(.selected){opacity:.5}
.craft-collection-name{font:600 13px var(--font-serif),serif}
.craft-collection-count{font-size:9px;color:var(--muted)}
.craft-results-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 0 16px}
.craft-results-heading h3{font:500 clamp(22px,3vw,30px)/1.15 var(--font-serif),serif;margin:0}
.craft-results-heading span{font-size:13px;color:var(--muted)}
@media(max-width:600px){.craft-subfilters{gap:8px;margin-bottom:27px}.craft-collection-art{width:100%}.craft-collection-name{font-size:11px;text-align:center}.craft-collection-count{font-size:8px}.craft-materials{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}.craft-chip{flex:none}.craft-results-heading h3{font-size:20px}}
```

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass. Then `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/HomeCraftExplorer.tsx src/app/globals.css tests/home-craft-explorer.test.tsx
git commit -m "feat: interlinked craft + collection filters with illustrated tiles on home"
```

---

### Task 5: Wire-up, build verification, docs

**Files:**
- Modify: `src/app/page.tsx` (confirm wiring), `README.md`, `scripts/seo-check.mjs`

**Interfaces:**
- Consumes: `HomeCraftExplorer` (Task 4), seed data (Task 1).

- [ ] **Step 1: Confirm home wiring.** `src/app/page.tsx` must import `HomeCraftExplorer` and render `<HomeCraftExplorer products={products} />` inside the `#shop` section in place of the plain `ProductGrid`, keep the "Browse & filter all →" link, and must NOT read `searchParams`. Run: `grep -n "HomeCraftExplorer\|searchParams" src/app/page.tsx` — Expected: the import and one usage; no `searchParams`.

- [ ] **Step 2: Add SEO/smoke assertions** to `scripts/seo-check.mjs` (before the final `console.log`):
```js
const home = (await get('/')).text;
ok(/Explore Crochet/.test(home) && /Explore Leather/.test(home) && /Explore Wood/.test(home) && /Explore Resin/.test(home), 'home renders the four Explore craft chips server-side');
ok(/Gifts &amp; keepsakes/.test(home) && /Aesthetic decor/.test(home), 'home renders the collection tiles server-side');
ok(/Handmade finds/.test(home) && !/[⌂❋✳🧶👜🪵🌼]/u.test(home.split('craft-explorer')[1] ?? ''), 'explorer uses illustrations, not emoji glyphs');
ok((home.match(/<h1[\s>]/g) || []).length === 1, 'home still has exactly one h1');
```

- [ ] **Step 3: Build + live check**
```bash
export NEXTAUTH_SECRET=testsecret NEXTAUTH_URL=http://localhost:3217 GOOGLE_CLIENT_ID=id GOOGLE_CLIENT_SECRET=sec NEXT_PUBLIC_SITE_URL=http://localhost:3217
npx next build 2>&1 | grep -E "^[┌├└] [○●ƒ] /($| )|rror|warning"     # Expected: "○ /" (static), no errors
(npx next start -p 3217 >/tmp/nx.log 2>&1 &); sleep 4
BASE_URL=http://localhost:3217 node scripts/seo-check.mjs | grep -E "^FAIL|checks passed|failed"   # Expected: All SEO checks passed
pkill -f "next start -p 3217"; git checkout data/db.json 2>/dev/null; git status --short
```
Port 3100 is occupied on this machine by another app; use 3217. `data/db.json` must be restored only if a run changed stock — do NOT run `git checkout data/db.json` if the seed tags from Task 1 are still uncommitted (commit Task 1 first, as the steps above do).

- [ ] **Step 4: Manual check in a browser** (`npm run dev`, http://localhost:3000): (a) first paint shows 8 products and all filters; (b) click *Explore Leather* → 2 products, tiles re-count, Home & décor dims; (c) click *Home & décor* → Leather clears, 5 products; (d) reload on `/?craft=wood&collection=desk` → 1 product; (e) keyboard: Tab to a tile, Space/Enter toggles; (f) narrow the window to <600px: tiles shrink, craft chips scroll horizontally.

- [ ] **Step 5: README + commit.** Add under "Included and working": "Home page craft explorer: interlinked *Explore Crochet/Leather/Wood/Resin* chips and illustrated collection tiles (state kept in `?craft=&collection=`). Products carry optional `material` and `collections[]` fields, editable via the admin product APIs."
```bash
git add src/app/page.tsx scripts/seo-check.mjs README.md
git commit -m "feat: wire craft explorer into home; smoke checks and docs"
```

---

## Self-Review

**Spec coverage:** two filter types (craft chips + collection tiles) → Task 4; "Explore crochet/leather/wood/resin" wording → chip text `Explore <Label>`; cards with sub-filters like image 2 but in our design (circular tiles, palette, Playfair labels, counts as in the user's screenshot) → Task 4 CSS; interlinked → Task 2 logic + Task 4 re-counting/clicked-wins; "relevant images instead of icons" → Task 3 SVG illustrations, asserted by "no emoji/text glyph" tests; data so Leather/Wood aren't empty → Task 1 seed.

**Placeholder scan:** no TBD/TODO; every code step has code. One deliberate cleanup instruction (remove dead `other` variable in `toggle`) is explicit.

**Type consistency:** `Selection`, `toggle(sel, key, value, products)`, `collectionCounts(products, material?)`, `materialCounts(products, collection?)`, `parseSelection(search, products)`, `toQuery(sel)` are defined in Task 2 and used with identical signatures in Task 4. `CraftArt` takes `MaterialSlug | CollectionSlug` (Task 3) and is called with `m.slug` / `c.slug` in Task 4. Product fields `material?: string`, `collections?: string[]` (Task 1) are what Task 2's filters read.

**Review Focus coverage:** (1) Task 2 "zero products overall is ignored" + Task 4 disabled-chip test; (2) Task 2 "clicked option wins" + Task 4 replace/clear tests; (3) Task 2 parse tests + Task 4 mount-URL test; (4) Task 2 legacy/sold-out + Task 4 legacy/sold-out tests; (5) Task 1 validation tests.

**Known limits / decisions to confirm:** (a) illustrations are original inline SVG — if you want real photos, drop files in `public/collections/` and swap `CraftArt` for `next/image`; (b) sample products p5–p8 are invented seed content; (c) the home page filters its server-passed product list client-side (fine at this catalogue size; switch to the API if it grows past a few hundred); (d) pottery (p4) has no craft among the four, so it shows only under *All* and its collections.
