# Product Images (upload, several per product) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sellers and admins upload up to 6 photos per product straight to S3; buyers see the cover everywhere and a gallery on the product page.

**Architecture:** A new `product_images` table (ordered rows, first = cover) replaces the single `products.image_url`. The server only signs a short-lived S3 presigned POST (`POST /api/uploads/product-image`), the browser uploads to S3 directly, and product create/update accepts an ordered `images` URL list that the server validates against ownership rules. The public product JSON keeps `imageUrl` (= cover) and adds `images: string[]`, so cards, the dashboard list and detail dialog keep working unchanged.

**Tech Stack:** Next.js 16 App Router, Drizzle + Postgres (PGlite in tests), Vitest + Testing Library, AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-01-product-images-design.md`

## Environment facts

- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`. Full suite: `npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000`. Type check: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/"`.
- The working tree holds the owner's uncommitted edits (`globals.css`, `Footer.tsx`, `Header.tsx`, `Hero.tsx`, `LikeButton.tsx`, `layout.tsx`, `page.tsx`, others). **Stage only files this plan creates or fully owns, by name; never `git add -A`; never commit `.env*`.** For a shared file (`globals.css`, `PostForm.tsx` if it shows foreign edits) commit only if `git diff <file>` shows nothing but your change, otherwise leave it unstaged and say so. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- `globals.css` is now pretty-printed (one declaration per line); append new rules in that style at the end of the file.
- Migrations: edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <name>`, hand-edit the SQL when a backfill is needed, then `npm run db:migrate` (local Docker DB from `.env.local`). PGlite tests apply `drizzle/` automatically. Latest migration today is `0010_listing_requests`.
- Public product reads go through `productSelect` / `toProduct` in `src/db/mappers.ts`; admin reads add `toAdminProduct`. Product create/update live in `src/lib/admin.ts` (`PRODUCT_KEYS`, `validateProduct`, `inputOf`, `contentOf`, `createProduct`, `updateProduct`, `deleteProduct`).
- Design rules: `.claude/skills/rang-rajasthan-design/SKILL.md` (DM Sans only via tokens, `--control-h` 36px controls, spinner inside the busy control with `aria-busy`, toasts, red-asterisk `.lbl`, `Breadcrumbs`). `tests/typography.test.ts` fails on any literal font name.
- Tests never call AWS: the signing and delete functions take an injectable dependency (see Task 1).

## Global Constraints

- Limits: **6 photos per product, 5 MB each (5 * 1024 * 1024 bytes), JPEG / PNG / WebP** (`image/jpeg`, `image/png`, `image/webp`).
- The first photo is the cover. `imageUrl` in public JSON is the first of `images`; both are omitted (never null) when a product has no photos.
- Only a signed-in **seller or admin** can get an upload permission. A seller may attach only URLs in their own folder `products/<their user id>/` (after the optional `S3_KEY_PREFIX`) or URLs already attached to that same product; an admin may attach any URL in the bucket's `products/` area or already attached ones. Every attached URL is https.
- Presigned POST allows exactly one key (`<S3_KEY_PREFIX>products/<user id>/<random uuid>.<ext>`), exactly the declared content type, and a size range of 1 byte to 5 MB, valid for 5 minutes.
- Config: env vars `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_BASE_URL` (default `https://<bucket>.s3.<region>.amazonaws.com`) and `S3_KEY_PREFIX` (e.g. `dev/`). If any required variable is missing, uploads answer **503 "Image uploads are not set up yet."**, the form still saves text, and already-attached photos stay valid.
- Removing a photo or deleting a product deletes the S3 object best-effort: a failure is logged and never fails the request. Secrets never appear in code, client bundles, logs or responses.
- A live (published) product whose photo list changes, including a cover change by reordering, goes back to Draft when a seller saves it (same rule as other content edits).
- The old `products.image_url` column stays in the database, unread and unwritten, until a later migration.

## Review Focus

1. **Foreign or hostile image URLs:** a seller attaching another seller's folder, an external https link, an `http:` link, `javascript:`, a look-alike host (`bucket.s3.region.amazonaws.com.evil.com`), a `../` path, or someone else's photo from a different product. Expected: 400, nothing saved. (Task 2, Task 3)
2. **Upload-permission abuse:** anonymous, customer role, wrong type (`image/svg+xml`, `text/html`), size 0 / negative / 5 MB + 1 / non-integer, missing body, hammering. Expected: 401/403/400/429, never a signed form. (Task 4)
3. **Not configured or S3 failing:** missing env vars, S3 delete failing during save or product delete. Expected: uploader shows the 503 message, text still saves, existing photos kept and removable, the save never fails because of S3. (Tasks 3, 4, 5)
4. **Edit semantics:** reorder to change the cover on a published product, exceed 6 by adding, duplicate URL in the list, `images` omitted on an edit (must keep photos), `images: []` (removes all), product deleted while photos exist. (Task 3)
5. **Odd files in the picker:** zero-byte file, 5 MB + 1, GIF/SVG, a file whose name ends `.jpg` but declares another type, picking 8 files at once with 4 slots left, picking the same file twice, one upload failing in a batch. Expected: clear per-file message, other files unaffected, never more than 6 kept. (Task 5)

---

## File Structure

```
src/lib/storage.ts                          # config, key/URL helpers, presign, best-effort delete
src/lib/product-images.ts                   # parse/validate image lists, load/save rows
src/db/schema.ts, drizzle/0011_product_images.sql   # product_images + backfill
src/db/mappers.ts, src/lib/types.ts         # images + imageUrl(cover) in product JSON
src/lib/admin.ts                            # create/update/delete use images
src/app/api/uploads/product-image/route.ts  # POST: signed upload form
src/components/ImageUploader.tsx            # thumbnails, add/remove/cover, per-file state
src/components/PostForm.tsx                 # uploader replaces the URL box; images in payload
src/components/ProductGallery.tsx           # product-page gallery
src/app/products/[slug]/page.tsx, src/lib/jsonld.ts
src/lib/engagement-limits.ts                # + uploadLimiter
docs/product-images.md, .env.backend.example, README.md
tests/storage.test.ts, product-images.test.ts, uploads-api.test.ts, image-uploader.test.tsx, product-gallery.test.tsx
tests/admin.test.ts, post-form.test.ts, jsonld.test.ts, db-schema.test.ts (existing, updated)
```

---

### Task 1: Storage library (`storage.ts`)

**Files:**
- Create: `src/lib/storage.ts`, `tests/storage.test.ts`
- Modify: `package.json` / lockfile (dependencies)

**Interfaces:**
- Produces:
  - `IMAGE_TYPES: Record<'image/jpeg' | 'image/png' | 'image/webp', 'jpg' | 'png' | 'webp'>`, `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `MAX_IMAGES = 6`
  - `type StorageConfig = { bucket: string; region: string; publicBase: string; keyPrefix: string }`
  - `storageConfig(env?: Record<string, string | undefined>): StorageConfig | null` (null unless all four required vars are non-empty; `publicBase` has no trailing slash; `keyPrefix` is `''` or ends with `/`, with leading slashes removed)
  - `newProductKey(cfg: StorageConfig, userId: string, contentType: string): string`
  - `publicUrlFor(cfg: StorageConfig, key: string): string`
  - `keyFromUrl(cfg: StorageConfig, url: string): string | undefined` (the key only when `url` is exactly `publicBase + '/' + key` and `key` starts with `keyPrefix + 'products/'`, has no `..`, no query, no fragment)
  - `presignProductUpload(cfg, userId, req: { contentType: unknown; size: unknown }, createPost?: PresignFn): Promise<{ url: string; fields: Record<string, string>; publicUrl: string; key: string }>` (throws `ApiError` 400 for a bad type or size; `PresignFn` has the same call shape as `createPresignedPost` from `@aws-sdk/s3-presigned-post`)
  - `deleteObjects(cfg: StorageConfig, keys: string[], send?: (cmd: unknown) => Promise<unknown>): Promise<void>` (never throws; logs on failure; no call for an empty list)

- [ ] **Step 1: Install the SDK pieces.** Run `npm install @aws-sdk/client-s3 @aws-sdk/s3-presigned-post` and confirm both appear in `package.json` dependencies.

- [ ] **Step 2: Write the failing tests** in `tests/storage.test.ts`:
  - `storageConfig` returns null for `{}`, for each required var missing, and for blank strings; with all four set returns bucket, region, default `publicBase` `https://b.s3.ap-south-1.amazonaws.com`; honours `S3_PUBLIC_BASE_URL` with a trailing slash trimmed; `S3_KEY_PREFIX` `dev` / `/dev/` / `dev/` all become `dev/`; empty becomes `''`.
  - `newProductKey` matches `/^products\/U1\/[0-9a-f-]{36}\.jpg$/` and with prefix `dev/` starts `dev/products/U1/`; png and webp get their extensions; two calls differ.
  - `publicUrlFor` joins base and key with one slash.
  - `keyFromUrl` returns the key for a bucket URL in `products/`, and `undefined` for: another host, `http:` scheme, look-alike host (`https://b.s3.ap-south-1.amazonaws.com.evil.com/products/a.jpg`), a path outside `products/`, a `..` path, a query string, a fragment, an empty string, and a key outside the configured `keyPrefix`.
  - `presignProductUpload` with a fake `createPost` records its input and asserts: bucket, key from `newProductKey`, `Expires` 300, `Conditions` contain `['content-length-range', 1, 5242880]` and `['eq', '$Content-Type', 'image/png']`, `Fields['Content-Type']` equals the type; returns the fake's `url` and `fields` plus `publicUrl` and `key`.
  - `presignProductUpload` rejects with status 400 for content types `image/svg+xml`, `text/html`, `image/gif`, `''`, `undefined`, `5`; and for sizes `0`, `-1`, `5242881`, `1.5`, `'100'`, `NaN`, `undefined`; the fake is never called. Accepts size `1` and `5242880`.
  - `deleteObjects` with a fake `send` is called once with all keys (as `DeleteObjectsCommand` input: bucket and `Delete.Objects`), not called for `[]`, and when `send` rejects the promise still resolves.

- [ ] **Step 3: Run `npx vitest run tests/storage.test.ts`.** Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/storage.ts`** per the Interfaces block. Use `createPresignedPost` and `S3Client` + `DeleteObjectsCommand`; build the default client lazily inside `deleteObjects` so importing the module needs no credentials.

- [ ] **Step 5: Run the file again.** Expected: all PASS; `tsc` clean.

- [ ] **Step 6: Commit**
```bash
git add package.json package-lock.json src/lib/storage.ts tests/storage.test.ts
git commit -m "feat: S3 storage helpers (config, keys, presigned upload, best-effort delete)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `product_images` table, mapper output and the image-list library

**Files:**
- Modify: `src/db/schema.ts`, `src/db/mappers.ts`, `src/lib/types.ts`, `tests/db-schema.test.ts`
- Create: `drizzle/0011_product_images.sql` (generated, then hand-edited), `src/lib/product-images.ts`, `tests/product-images.test.ts`

**Interfaces:**
- Consumes: Task 1 (`StorageConfig`, `keyFromUrl`, `MAX_IMAGES`).
- Produces:
  - table `productImages` (`id` uuid pk default random, `productId` text FK `products.id` cascade, `url` text not null, `s3Key` text null, `position` smallint not null, `createdAt`; unique `(productId, position)`; index on `productId`)
  - `Product.images?: string[]` in `src/lib/types.ts`; `toProduct` sets `images` (ordered by position) and `imageUrl` = `images[0]`, both omitted when none
  - `type ImageRef = { url: string; key: string | null }`
  - `parseImages(v: unknown): string[] | undefined` (undefined when the key is absent or `undefined`; throws 400 `images must be a list of up to 6 image URLs.` for a non-array, a non-string item, an empty or whitespace string, more than `MAX_IMAGES`, or duplicate URLs; trims items)
  - `resolveImages(q: Q, input: { urls: string[]; productId?: string; userId: string; isAdmin: boolean; cfg: StorageConfig | null }): Promise<ImageRef[]>` (applies the ownership rules from Global Constraints; for urls already attached to `productId` it reuses their stored `key`; throws 400 `One or more images are not allowed.` otherwise)
  - `loadImages(q: Q, productId: string): Promise<ImageRef[]>` (ordered)
  - `saveImages(tx: Tx, productId: string, next: ImageRef[]): Promise<{ removedKeys: string[] }>` (replaces the product's rows with `next` in order, positions 0..n-1; returns the `key`s of removed rows that were not kept)

- [ ] **Step 1: Write the failing tests** in `tests/product-images.test.ts` (PGlite via `resetTestDb`; seller made with `makeSeller`; use a `cfg` object `{ bucket: 'b', region: 'ap-south-1', publicBase: 'https://b.s3.ap-south-1.amazonaws.com', keyPrefix: '' }`):
  - `parseImages`: `undefined` → `undefined`; `[]` → `[]`; trims; throws 400 for `'x'`, `{}`, `[5]`, `['']`, `['  ']`, 7 items, `['a','a']`.
  - Seed rows with `saveImages`, then `loadImages` returns them in order; `saveImages` with a reordered list changes positions and returns no removed keys; with one dropped it returns that row's key; dropped rows with `key: null` return nothing; identical list is a no-op.
  - Public product JSON (via `listProducts`): a product with two images has `images` in order and `imageUrl` equal to the first; a product with none has neither key (not null); deleting the product removes its rows (count 0).
  - `resolveImages` for a seller: accepts `${base}/products/<own id>/x.jpg` (key `products/<own id>/x.jpg`); rejects another seller's folder, an external `https://cdn.example.com/a.jpg`, `http:` version of an own URL, `https://b.s3.ap-south-1.amazonaws.com.evil.com/products/<own id>/x.jpg`, `${base}/products/<own id>/../<other id>/x.jpg`, `${base}/products/<own id>/x.jpg?x=1`, `${base}/other/x.jpg`, `javascript:alert(1)`, each with 400 and the message above.
  - For an admin: accepts any `products/<any id>/…` URL; still rejects external and outside-`products/`.
  - A URL already attached to this product is accepted even if external (legacy) and keeps `key: null`; the same external URL is rejected for a different product.
  - With `cfg: null` only already-attached URLs are accepted; any new URL is rejected.
  - Migration backfill (in `tests/db-schema.test.ts`, extend): after migrating a DB that had `products.image_url`, the row exists at position 0 with `key` null. Use the PGlite migrate path on a fresh database seeded before the new migration, or assert the SQL file contains the `INSERT INTO "product_images"` backfill statement if a mid-migration seed is impractical (state which you did).

- [ ] **Step 2: Run `npx vitest run tests/product-images.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Add the table and mapper.** Define `productImages` in `src/db/schema.ts`; generate `0011_product_images` with `npx drizzle-kit generate --name product_images`; append to the generated SQL the backfill `INSERT INTO "product_images" ("product_id","url","position") SELECT "id","image_url",0 FROM "products" WHERE "image_url" IS NOT NULL;`. In `productSelect` add an `images` field `coalesce((select json_agg(url order by position) from product_images pi where pi.product_id = products.id), '[]')` (literal `products.id`, as in `trending.ts`, because drizzle renders `${products.id}` unqualified in single-table selects) typed `string[]`; extend `ProductJoinRow`; in `toProduct` replace the `imageUrl` line with `images`/`imageUrl` derived from it. Remove `imageUrl` from `toProductRow`.

- [ ] **Step 4: Implement `src/lib/product-images.ts`** per Interfaces. `resolveImages` decides per URL: first "already attached" (compare with `loadImages`), else `keyFromUrl(cfg, url)` and the owner-folder rule (`products/<userId>/` after the prefix, admin: any), else throw.

- [ ] **Step 5: Run `npx vitest run tests/product-images.test.ts tests/db-schema.test.ts`, then the whole suite and `tsc`.** Expected: PASS (existing tests that read `imageUrl` from the product row or the old column are fixed in Task 3, so expect only those to be red until then; list them in the commit message if any). Apply the migration locally: `npm run db:migrate`.

- [ ] **Step 6: Commit**
```bash
git add src/db/schema.ts src/db/mappers.ts src/lib/types.ts src/lib/product-images.ts drizzle/0011_product_images.sql drizzle/meta tests/product-images.test.ts tests/db-schema.test.ts
git commit -m "feat: product_images table, ordered images in product JSON, image-list validation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Product create, update and delete use `images`

**Files:**
- Modify: `src/lib/admin.ts`, `tests/admin.test.ts`, `tests/db-schema.test.ts` (any remaining `imageUrl` row assertions)

**Interfaces:**
- Consumes: Task 1 (`storageConfig`, `deleteObjects`), Task 2 (`parseImages`, `resolveImages`, `loadImages`, `saveImages`, `ImageRef`).
- Produces: `createProduct` / `updateProduct` accept `images?: string[]` (ordered; replaces the product's photos; omitted on update means keep). `imageUrl` is no longer an accepted input (ignored like any unknown key). `deleteProduct` deletes the product's S3 objects best-effort after the row is gone. Returned `AdminProduct` carries `images` and `imageUrl` (cover).

- [ ] **Step 1: Rewrite the image tests in `tests/admin.test.ts`** (replace the `product imageUrl` and `imageUrl credentials` blocks and the `imageUrl` lines in the pickup-location test). Use a stubbed config by setting the four env vars in `beforeEach` (`S3_BUCKET=b`, `S3_REGION=ap-south-1`, fake keys) and restoring after; stub `deleteObjects` with `vi.mock('@/lib/storage', …)` keeping the real helpers via `importActual` and replacing only `deleteObjects` with a spy. Tests:
  - create with `images` of two own-folder URLs: response `images` equals the list, `imageUrl` equals the first, rows exist in order.
  - create as a seller with another seller's URL, an external URL, 7 URLs, duplicates, a non-array, `['']` → 400, and no product is created (product count unchanged).
  - `imageUrl: 'https://cdn.example.com/a.jpg'` in the body is ignored (product has no images).
  - update without `images` keeps the photos; `images: []` removes all and the removed keys are passed to the `deleteObjects` spy; reordering changes `imageUrl`; adding past 6 → 400 and the old photos remain.
  - a seller updating a published product with a reordered list gets status `DRAFT` back; an unchanged list leaves it `APPROVED`; an admin changing photos does not change status.
  - a seller cannot attach a photo from their own folder to someone else's product (404 as today); an admin may attach photos from any seller's folder.
  - with the env vars unset: a create/update that sends only already-attached URLs works; one that sends a new bucket URL → 400; text-only edits work.
  - `deleteProduct` passes all the product's keys to the `deleteObjects` spy once; when the spy rejects the delete still succeeds; legacy `key: null` photos are not passed.
  - `deleteObjects` failing during an update does not fail the update.

- [ ] **Step 2: Run `npx vitest run tests/admin.test.ts`.** Expected: the new tests FAIL.

- [ ] **Step 3: Implement in `src/lib/admin.ts`.** In `PRODUCT_KEYS` replace `'imageUrl'` with `'images'`; `validateProduct` no longer handles images (remove `imageUrl`). In `createProduct` and `updateProduct`, after the product row is written inside the transaction: `parseImages(raw.images)` (before the transaction), then `resolveImages` with `{ userId: me.id, isAdmin: actor.role === 'admin', cfg: storageConfig(), productId }`, then `saveImages`; call `deleteObjects(cfg, removedKeys)` after the transaction commits, never inside it. In `updateProduct`, include the photo list in the "content changed" comparison (extend `contentOf` or compare the url arrays separately) so a reorder or add/remove sends a live seller edit back to Draft. In `deleteProduct`, read the product's keys first, delete the row, then best-effort delete the objects. `inputOf` and `toProductRow` no longer carry `imageUrl`.

- [ ] **Step 4: Run `npx vitest run tests/admin.test.ts tests/db-schema.test.ts` then the whole suite and `tsc`.** Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin.ts tests/admin.test.ts tests/db-schema.test.ts
git commit -m "feat: products take an ordered images list (ownership-checked), delete removes stored photos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Upload-permission endpoint

**Files:**
- Create: `src/app/api/uploads/product-image/route.ts`, `tests/uploads-api.test.ts`
- Modify: `src/lib/engagement-limits.ts` (+ `uploadLimiter`, 60 per hour per user, included in `resetLimitersForTests`)

**Interfaces:**
- Consumes: Task 1 (`storageConfig`, `presignProductUpload`).
- Produces: `POST /api/uploads/product-image` with JSON `{ contentType: string, size: number }` → `200 { url, fields, publicUrl }` (the `key` is not returned); `401` anonymous, `403` customers, `415` non-JSON, `400` bad type/size (message from Task 1), `429 "Too many requests."`, `503 "Image uploads are not set up yet."` when `storageConfig()` is null. `Cache-Control: no-store`.

- [ ] **Step 1: Write the failing tests** (mock `@/auth` like the other API tests; mock `@/lib/storage`'s `presignProductUpload` via `importActual` + override to a fake returning `{ url: 'https://b.s3…', fields: { key: 'k' }, publicUrl: 'https://b.s3…/products/U/x.jpg', key: 'k' }`; set the four env vars in `beforeEach`):
  - seller and admin sessions get 200 with `url`, `fields`, `publicUrl`, no `key` property, `cache-control: no-store`; the fake was called with the session user's id (look the user up by email, as the app does) and the declared type/size.
  - anonymous → 401; a `customer` session → 403; a deactivated seller → 403; none call the fake.
  - non-JSON content type → 415; invalid JSON → 400; `{}` / `{contentType:'image/svg+xml',size:10}` / `{contentType:'image/png',size:0}` / size `5242881` → 400 (the real validation runs; use the real `presignProductUpload` with a fake `createPost` for these cases instead of the override).
  - env vars unset → 503 with the exact message, for a signed-in seller.
  - 61st request in an hour by the same user → 429; another user unaffected.

- [ ] **Step 2: Run `npx vitest run tests/uploads-api.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Implement the route** with `handle`, `requireStaff(await auth())`, the JSON-only check via `readJson`, the limiter keyed by the user's email lower-cased, and `ensureUser`/`userIdByEmail` to get the user id for the key folder. Never log `fields`.

- [ ] **Step 4: Run the file, the whole suite and `tsc`.** Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/uploads src/lib/engagement-limits.ts tests/uploads-api.test.ts
git commit -m "feat: signed upload permission endpoint for product photos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `ImageUploader` and the product form

**Files:**
- Create: `src/components/ImageUploader.tsx`, `tests/image-uploader.test.tsx`
- Modify: `src/components/PostForm.tsx` (replace the "Cover image URL" label with the uploader; `buildPayload` sends `images`), `tests/post-form.test.ts`, `tests/posts-admin.test.tsx` (the mocked API and the image-URL case), `src/app/globals.css` (uploader styles, appended)

**Interfaces:**
- Consumes: Task 4 endpoint; Task 1 constants `MAX_IMAGE_BYTES`, `MAX_IMAGES`, `IMAGE_TYPES` (import from a client-safe file: move the three constants into `src/lib/image-limits.ts` and re-export from `storage.ts`, so the browser bundle never imports the AWS SDK).
- Produces:
  - `<ImageUploader initial: string[] onBusyChange?: (busy: boolean) => void />`: renders one hidden `<input type="hidden" name="images" value={url}>` per kept photo in order (so `FormData.getAll('images')` is the ordered list), thumbnails with a "Cover" badge on the first, per-tile "Make cover" (not on the first) and "Remove", an "Add photos" button wrapping `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`, a live region (`role="status"`) for counts and `role="alert"` for errors.
  - `buildPayload(f)` returns `images: string[]` (from `f.getAll('images')`) and no `imageUrl`.

- [ ] **Step 1: Write the failing tests** `tests/image-uploader.test.tsx` (jsdom; mock `fetch` for the permission call and a second `fetch` URL for S3; files built with `new File([new Uint8Array(n)], name, { type })`):
  - shows existing photos as thumbnails with the first marked "Cover"; hidden inputs match the order; "Add photos" is hidden/disabled at 6 photos with a note "6 of 6 photos".
  - choosing two valid files: for each one POSTs `{contentType,size}` JSON to `/api/uploads/product-image`, then POSTs a `FormData` to the returned `url` whose fields come first in the returned order and `file` is the last entry; on success the tile appears with its `publicUrl` in a hidden input; while running the tile shows a spinner and `onBusyChange(true)` fires, then `false`.
  - rejects before any network call, with an alert naming the file: a GIF, an SVG, a file of 5 MB + 1, a zero-byte file; a file named `a.jpg` whose `type` is `image/gif` is rejected on the declared type; valid files in the same pick still upload.
  - picking 8 files with 4 slots left uploads 4 and reports "Only 4 more photos fit (limit 6)." for the rest; picking a file already added (same name, size and lastModified) is skipped with a message.
  - one upload fails (permission 400 or S3 non-2xx): that tile shows its error and no hidden input; the others succeed.
  - permission 503: shows "Image uploads are not set up yet." and no file picker action; existing thumbnails still show and can be removed.
  - "Make cover" moves that photo first (hidden-input order and Cover badge follow); "Remove" deletes it and the count updates; both are real buttons with accessible names including the position ("Remove photo 2").
  - `buildPayload` in `tests/post-form.test.ts`: returns `images` in order from several hidden inputs, `[]` when none, and no `imageUrl` key. Update the posts-admin test mocks that referenced `imageUrl` so the edit flow sends `images`.
  - PostForm: the Save button is disabled and `aria-busy` while an upload runs, and enabled again after.

- [ ] **Step 2: Run `npx vitest run tests/image-uploader.test.tsx tests/post-form.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Implement `ImageUploader`** (client component, states per tile: `uploading | done | error`; upload files sequentially or two at a time; revoke object URLs used for previews; no `fontFamily`; styles via existing tokens, spinner via the existing `.rr-spinner`). Create `src/lib/image-limits.ts` and re-export from `storage.ts`. In `PostForm`, replace the "Cover image URL" label with `<ImageUploader initial={initial?.images ?? []} onBusyChange={setUploading} />` and disable the submit button while `uploading`.

- [ ] **Step 4: Run the new and updated tests, the whole suite, `tsc`.** Expected: PASS (the footer and CSS-pattern failures already present before this plan are unrelated; list them if they appear).

- [ ] **Step 5: Commit** (stage `globals.css` only if `git diff` shows nothing but this task's uploader rules)
```bash
git add src/components/ImageUploader.tsx src/components/PostForm.tsx src/lib/image-limits.ts src/lib/storage.ts tests/image-uploader.test.tsx tests/post-form.test.ts tests/posts-admin.test.tsx
git commit -m "feat: photo uploader in the product form (several photos, cover, remove)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Product page gallery and structured data

**Files:**
- Create: `src/components/ProductGallery.tsx`, `tests/product-gallery.test.tsx`
- Modify: `src/app/products/[slug]/page.tsx` (use the gallery in place of the single `ProductImage`), `src/lib/jsonld.ts`, `tests/jsonld.test.ts`, `src/app/globals.css` (gallery styles, appended)

**Interfaces:**
- Consumes: `Product.images`, `Product.imageUrl`.
- Produces: `<ProductGallery images: string[] alt: string fallback: React.ReactNode />`; `productJsonLd(p).image` lists all of `p.images` (or `[p.imageUrl]` when only that exists) followed by the generated opengraph image.

- [ ] **Step 1: Write the failing tests:**
  - gallery with 3 images renders one large image (the first) and 3 thumbnail buttons named "Show photo 1 of 3" etc., the first with `aria-current="true"`; clicking thumbnail 2 swaps the large image `src` and moves `aria-current`; keyboard: thumbnails are buttons (Enter/Space activate).
  - 1 image renders the large image and no thumbnails; 0 images renders only the fallback; a broken large image falls back like `ProductImage` does; the alt text is the product name on the large image and thumbnails use empty alt (decorative, the button carries the name).
  - `productJsonLd`: with `images: [a, b]` → `image` is `[a, b, <opengraph url>]`; with only `imageUrl` → `[imageUrl, <opengraph>]`; with none → `[<opengraph>]`.
  - source contract: the product page uses `<ProductGallery` and no longer renders `ProductImage` directly.

- [ ] **Step 2: Run the two test files.** Expected: FAIL.

- [ ] **Step 3: Implement the component and edits.** Gallery reuses `ProductImage` for the large image so its failure fallback keeps working; thumbnails are plain `<img>` inside buttons; keep the existing `product-visual detail-art visual-N` wrapper behaviour for the fallback.

- [ ] **Step 4: Run the tests, the whole suite, `tsc`.** Expected: PASS.

- [ ] **Step 5: Commit** (same `globals.css` rule as Task 5)
```bash
git add src/components/ProductGallery.tsx "src/app/products/[slug]/page.tsx" src/lib/jsonld.ts tests/product-gallery.test.tsx tests/jsonld.test.ts
git commit -m "feat: product page photo gallery and all photos in structured data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: AWS setup guide, env example, final checks

**Files:**
- Create: `docs/product-images.md`
- Modify: `.env.backend.example`, `README.md` (short "Product photos" section linking the guide)

**Interfaces:** consumes everything above.

- [ ] **Step 1: Write `docs/product-images.md`** with, in order: what the feature does; creating the bucket (region, name, Block Public Access: allow public bucket policies, keep ACLs blocked); the bucket policy granting public `s3:GetObject` only on `products/*` and `dev/products/*`; the CORS JSON allowing `POST` from the site origins (`http://localhost:3000`, `http://localhost:3001`, the production origins) with `AllowedHeaders ["*"]`; the IAM user with a policy allowing only `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*products/*`; the access key placed in `.env.local` / `.env.backend`, never committed; the env var table from Global Constraints; a budget alert with a small limit; the optional lifecycle rule for abandoned uploads; how to verify (upload a photo, open the URL in a private window); and what the 503 message means.
- [ ] **Step 2: Add the variables to `.env.backend.example`** (commented values, no real keys) and the README section.
- [ ] **Step 3: Final checks:** whole suite, `tsc`, and a local run on the dev server with the four variables unset: `POST /api/uploads/product-image` as anonymous → 401, and the product form (seller session forged as in earlier live checks) shows the "not set up" message while text still saves. State plainly that a real S3 upload was not run unless the owner supplied a bucket.
- [ ] **Step 4: Commit**
```bash
git add docs/product-images.md .env.backend.example
git commit -m "docs: S3 setup guide for product photos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
# README.md: stage only if git diff shows nothing but this section
```

---

## Self-Review

**Spec coverage:** upload from device, up to 6, 5 MB, three types (Tasks 1, 4, 5); first = cover, make cover, remove (Task 5); cards, dashboard, detail keep working through `imageUrl` = cover and the gallery on the product page (Tasks 2, 6); structured data lists every photo (Task 6); direct-to-S3 with signed permission and ownership folder rules (Tasks 1, 3, 4); existing single image becomes photo one via the backfill (Task 2); old column kept unused (Task 2); not-configured behaviour (Tasks 3, 4, 5); best-effort S3 delete (Tasks 1, 3); setup guide with bucket, CORS, IAM, budget (Task 7); non-goals respected (no reorder drag, resize, CDN, workshop images).

**Step scan:** every step names an interface or test assertions; function bodies are left to the implementer except the two SQL/key rules the spec pins.

**Type consistency:** `StorageConfig`, `IMAGE_TYPES`, `MAX_IMAGE_BYTES`, `MAX_IMAGES` (Task 1, re-exported through `image-limits.ts` in Task 5), `ImageRef`, `parseImages`, `resolveImages`, `loadImages`, `saveImages` (Task 2) and `Product.images` / `imageUrl` (Task 2) are named identically wherever used in Tasks 3 to 6.

**Review Focus coverage:** (1) Tasks 2 and 3 URL-rule tests; (2) Task 4; (3) Tasks 3, 4, 5 (503, S3 delete failure); (4) Task 3 edit-semantics tests; (5) Task 5 file-picker tests.

**Known limits to confirm:** photos uploaded and abandoned stay in the bucket; originals are served unresized with no CDN; the old `image_url` column remains until a later migration; no real S3 round trip is possible in tests, so the first real upload is the owner's check after creating the bucket.
