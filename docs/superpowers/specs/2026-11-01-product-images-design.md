# Product images: upload, several per product

## Intent and why

Sellers can only give a product one cover photo today, by pasting an https link into a text box. Most makers do not have an image link; they have photos on their phone. Buyers also want to see a piece from more than one side before they contact the artist. The goal is that a seller picks photos from their device, sees them as thumbnails, and buyers can browse them on the product page.

## Goals

- A seller (or admin) adds photos to a product by choosing files from their device. Up to 6 photos per product, 5 MB each, JPEG, PNG or WebP.
- The first photo is the cover. The seller can make any photo the cover and remove photos.
- Product cards, the product page, search previews and structured data show the cover. The product page also shows a small gallery so buyers can see the rest.
- Photos are stored in an AWS S3 bucket. The browser uploads straight to S3, so the small server never carries image bytes.
- Existing products keep their current image: the old single image URL becomes photo number one.
- Works for a non-production setup now (AWS free tier, one bucket), with nothing in the design that stops a later move to production.

## Non-goals

- No drag-to-reorder (a "Make cover" button is enough), no cropping or editing.
- No server-side resizing, thumbnails or CDN (CloudFront). Originals are served as uploaded. Recommended follow-up: downscale in the browser before upload.
- No images for workshops, artists or profiles. Products only.
- No video, no virus scanning, no automatic cleanup of photos that were uploaded but never saved with a product. An optional S3 lifecycle rule can handle that later.
- No pasted image URLs for new photos. The upload replaces the "Cover image URL" box.

## Anti-goals

- A seller attaching a photo that belongs to someone else, or an arbitrary link from another site, to their product.
- Anyone who is not signed in as a seller or admin getting an upload permission.
- AWS keys appearing in the repository, in browser code or in logs.
- Image traffic going through the 1 GB server.
- A product failing to save because the photo service is down or not configured. Text details must still save.

## Constraints

- Next.js 16, Drizzle and Postgres, Vitest. Design rules in `.claude/skills/rang-rajasthan-design/SKILL.md` (shared tokens, DM Sans only, 36px controls, loader inside the busy control, toasts for success and error, red asterisk on required fields).
- Bucket and keys are created by the project owner by hand in AWS. The build documents the exact steps; it does not create AWS resources.
- Tests never call AWS. The signing step is replaceable in tests.

## The parts of the how that were decided with the owner

- Storage is S3. The owner has an AWS account on the free tier and will use one bucket for the non-production site.
- Limits: 6 photos per product, 5 MB each, JPEG, PNG or WebP.
- First photo is the cover; the product page shows a gallery.
- Existing single image becomes the first photo.

## Design (the builder's calls, to be checked by the owner)

**Data.** New table `product_images`: `id`, `product_id` (cascade on delete), `url` (https, public), `s3_key` (null for legacy external URLs), `position`, `created_at`. A migration copies each product's existing `image_url` into one row at position 0. The old `image_url` column is no longer read or written; dropping it is a separate later migration so the change is reversible.

**Public JSON.** Products gain `images: string[]` in order, and `imageUrl` stays as the first of them so existing consumers keep working. Nothing else about storage (keys, owners) is public.

**Upload permission.** `POST /api/uploads/product-image`, signed-in seller or admin only, JSON only, rate limited per user. Body: `contentType`, `size`. It checks the type is one of the three and the size is 1 byte to 5 MB, then returns an S3 presigned POST that allows exactly one object key, exactly that content type, and that size range, valid for 5 minutes, plus the final public URL. The key is `products/<user id>/<random id>.<ext>` (with an optional environment prefix such as `dev/`). The browser then uploads to S3 directly.

**Saving a product.** Create and update accept `images`: an ordered list of up to 6 URLs. Each URL must be https and either (a) inside this bucket's `products/<the acting user's id>/` folder (admins: any folder in the products area) or (b) already attached to this same product. Anything else is a 400. The list replaces the product's photos; the first is the cover. Photos removed from a product, or products deleted, have their S3 object deleted on a best-effort basis (a failure is logged and never blocks the save).

**Configuration.** Environment variables `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_BASE_URL` and `S3_KEY_PREFIX`. If they are missing the upload endpoint answers 503 "Image uploads are not set up yet." and the form shows that message in place of the uploader; the rest of the form still saves. The IAM user gets only put and delete on that bucket's `products/` folder.

**Seller form.** The "Cover image URL" field is replaced by an uploader: a grid of thumbnails with a Cover badge on the first, "Make cover" and "Remove" on each, and an "Add photos" button that accepts several files at once. Each file shows a spinner while uploading and a clear error on that tile if it is the wrong type, too large, over the limit of 6, or the upload fails. Saving is blocked while an upload is still running. Fully keyboard operable, with an accessible name on every control.

**Buyer pages.** Cards and the dashboard list use the cover. The product page shows the cover large with a row of thumbnails below; choosing a thumbnail swaps the large image (buttons, keyboard accessible, current one marked). The structured data lists every photo.

## What is left to the builder

Exact component split, the S3 SDK package choice (the AWS SDK v3 presigned-POST helper is the expected one), error wording, and the CSS inside the existing tokens.

## Calls the builder made that the owner should check

- Photos stay in the bucket if a seller uploads them and then abandons the form (orphans). Acceptable for non-production; a lifecycle rule is the later fix.
- Photos are served from the bucket's public address without a CDN.
- The old `image_url` column is left in place, unused, until a follow-up migration.
- New photos can only be uploaded, not pasted as links. Old pasted links keep working until the seller removes them.
