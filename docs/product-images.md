# Product photos (S3)

Sellers and admins add up to 6 photos to a product (JPEG, PNG or WebP, 5 MB each). The browser uploads each photo straight to an S3 bucket using a short-lived signed form from `POST /api/uploads/product-image`; the server never carries the image bytes. The first photo is the cover.

## 1. Create the bucket
1. AWS console, S3, **Create bucket**. Pick a name (for example `craftology-photos-dev`) and a region close to your users (for example `ap-south-1`).
2. Under **Block Public Access**, untick **Block public access to buckets and objects granted through new public bucket or access point policies** and **...through any public bucket or access point policies** (keep the two ACL options ticked). Confirm.
3. Leave versioning and encryption at their defaults.

## 2. Let anyone read the photos (and nothing else)
Bucket, **Permissions**, **Bucket policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadProductPhotos",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": ["arn:aws:s3:::YOUR-BUCKET/products/*", "arn:aws:s3:::YOUR-BUCKET/dev/products/*"]
  }]
}
```
Replace `YOUR-BUCKET`. Only the `products/` folders are readable; listing the bucket stays private.

## 3. Allow uploads from the website (CORS)
Bucket, **Permissions**, **Cross-origin resource sharing (CORS)**:
```json
[{
  "AllowedMethods": ["POST"],
  "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001", "https://www.your-domain.com"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}]
```
Add every origin the site runs on. Without this the browser blocks the upload and the tile shows an error.

## 4. Create a limited access key
IAM, **Users**, **Create user** (no console access), then attach an inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:DeleteObject"],
    "Resource": ["arn:aws:s3:::YOUR-BUCKET/products/*", "arn:aws:s3:::YOUR-BUCKET/dev/products/*"]
  }]
}
```
Then **Security credentials**, **Create access key**, use case "Application running outside AWS". Copy the key id and secret once. They go into `.env.local` (development) or `.env.backend` (production) and **never into git**.

## 5. Settings
| Variable | Meaning |
|---|---|
| `S3_BUCKET` | bucket name |
| `S3_REGION` | for example `ap-south-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | the key from step 4 |
| `S3_PUBLIC_BASE_URL` | optional; default `https://<bucket>.s3.<region>.amazonaws.com` (set it if you add a CDN or custom domain) |
| `S3_KEY_PREFIX` | optional, for example `dev/` so a test site keeps its photos apart from production |

Restart the server after changing them (`docker compose ... up -d` in production, no rebuild).

If any of the four required variables is missing, the form says **"Image uploads are not set up yet."**, products still save, and photos that are already attached keep working.

## 6. Check it works
1. Sign in as a seller or admin, open **New post**, add a photo. A thumbnail with a spinner appears, then the Cover badge.
2. Save, open the product page, then open the photo's address in a private window. It should load without signing in.
3. Remove the photo from the product and save. The object disappears from the bucket (a photo that another product still shows is kept).

## Cost and safety
- Add a **budget alert** (Billing, Budgets) with a small limit so a surprise cannot cost you. Check your account's free-tier terms; they differ by account age.
- Photos that were uploaded but never saved with a product stay in the bucket. An S3 lifecycle rule (Management tab) can expire objects older than N days in a `tmp/` folder if you ever want automatic cleanup; today every upload goes straight to `products/`, so clean-up is manual.
- A seller can only attach files from their own folder (`products/<their user id>/`); an admin can attach any file in `products/`. Pasting a link from another site is not possible any more; old links keep working until removed.
- Photos are served as uploaded (no resizing, no CDN). A browser-side resize before upload is the natural next improvement.
