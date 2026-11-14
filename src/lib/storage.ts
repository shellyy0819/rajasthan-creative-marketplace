import { randomUUID } from 'node:crypto';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ApiError } from './errors';

import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from './image-limits';
export { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES };

export type StorageConfig = { bucket: string; region: string; publicBase: string; keyPrefix: string };
export type PresignFn = typeof createPresignedPost;

const clean = (v: string | undefined) => (v ?? '').trim();

/** Null unless the bucket, region and both AWS keys are set: uploads then answer 503 and the rest of the app keeps working. */
export function storageConfig(env: Record<string, string | undefined> = process.env): StorageConfig | null {
  const bucket = clean(env.S3_BUCKET), region = clean(env.S3_REGION);
  if (!bucket || !region || !clean(env.AWS_ACCESS_KEY_ID) || !clean(env.AWS_SECRET_ACCESS_KEY)) return null;
  const base = clean(env.S3_PUBLIC_BASE_URL) || `https://${bucket}.s3.${region}.amazonaws.com`;
  const prefix = clean(env.S3_KEY_PREFIX).replace(/^\/+/, '').replace(/\/+$/, '');
  return { bucket, region, publicBase: base.replace(/\/+$/, ''), keyPrefix: prefix ? `${prefix}/` : '' };
}

const extOf = (contentType: unknown) => (typeof contentType === 'string' && Object.hasOwn(IMAGE_TYPES, contentType) ? IMAGE_TYPES[contentType as keyof typeof IMAGE_TYPES] : undefined);

export type UploadArea = { folder: 'products' | 'logos' | 'workshop-requests'; types: readonly string[]; typeMessage: string; sizeMessage: string };
const PRODUCT_AREA: UploadArea = {
  folder: 'products', types: Object.keys(IMAGE_TYPES),
  typeMessage: 'Photos must be JPEG, PNG or WebP.', sizeMessage: 'Each photo must be between 1 byte and 5 MB.',
};
/** Seller logos live in their own area so a logo is never a product photo and never deleted with one. */
export const LOGO_AREA: UploadArea = {
  folder: 'logos', types: ['image/jpeg', 'image/png'],
  typeMessage: 'Your logo must be a JPG or PNG.', sizeMessage: 'Your logo must be between 1 byte and 5 MB.',
};

/** Photos sent with the public "host a workshop" form: their own folder, so they are never product photos or deleted with one. */
export const REQUEST_AREA: UploadArea = {
  folder: 'workshop-requests', types: Object.keys(IMAGE_TYPES),
  typeMessage: 'Photos must be JPEG, PNG or WebP.', sizeMessage: 'Each photo must be between 1 byte and 5 MB.',
};
/** The folder id used for uploads by people who are not signed in. */
export const ANON_UPLOADER = 'public';

function newKey(cfg: StorageConfig, userId: string, contentType: string, area: UploadArea): string {
  const ext = area.types.includes(contentType) ? extOf(contentType) : undefined;
  if (!ext) throw new ApiError(400, area.typeMessage);
  return `${cfg.keyPrefix}${area.folder}/${userId}/${randomUUID()}.${ext}`;
}
export const newProductKey = (cfg: StorageConfig, userId: string, contentType: string) => newKey(cfg, userId, contentType, PRODUCT_AREA);

export const publicUrlFor = (cfg: StorageConfig, key: string) => `${cfg.publicBase}/${key}`;

/** The object key when `url` is exactly a public bucket url for a file inside this bucket's products/ area; otherwise undefined. */
export function keyFromUrl(cfg: StorageConfig, url: string): string | undefined {
  const head = `${cfg.publicBase}/`;
  if (typeof url !== 'string' || !url.startsWith(head)) return undefined;
  const key = url.slice(head.length);
  const area = `${cfg.keyPrefix}products/`;
  if (!key.startsWith(area) || key.length === area.length || key.endsWith('/')) return undefined;
  if (/[?#%\\]/.test(key) || key.split('/').some(part => part === '..' || part === '.' || part === '')) return undefined;
  return key;
}

export const UPLOAD_CACHE_CONTROL = 'public, max-age=86400';

/** A short-lived S3 POST form allowing exactly one key, exactly the declared type, 1 byte to 5 MB. */
export async function presignUpload(
  cfg: StorageConfig, userId: string, req: { contentType: unknown; size: unknown }, area: UploadArea, createPost: PresignFn = createPresignedPost,
): Promise<{ url: string; fields: Record<string, string>; publicUrl: string; key: string }> {
  if (typeof req.contentType !== 'string' || !area.types.includes(req.contentType) || !extOf(req.contentType)) throw new ApiError(400, area.typeMessage);
  const size = req.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) throw new ApiError(400, area.sizeMessage);
  const contentType = req.contentType;
  const key = newKey(cfg, userId, contentType, area);
  const { url, fields } = await createPost(new S3Client({ region: cfg.region }), {
    Bucket: cfg.bucket, Key: key, Expires: 300,
    // A day, so a photo a seller removes does not stay in browsers for long.
    Fields: { 'Content-Type': contentType, 'Cache-Control': UPLOAD_CACHE_CONTROL },
    Conditions: [['content-length-range', 1, MAX_IMAGE_BYTES], ['eq', '$Content-Type', contentType], ['eq', '$Cache-Control', UPLOAD_CACHE_CONTROL]],
  });
  return { url, fields, publicUrl: publicUrlFor(cfg, key), key };
}

export const presignProductUpload = (
  cfg: StorageConfig, userId: string, req: { contentType: unknown; size: unknown }, createPost: PresignFn = createPresignedPost,
) => presignUpload(cfg, userId, req, PRODUCT_AREA, createPost);

/** True when `url` is a public bucket url for a file directly inside this user's own logos/ folder. */
export function isOwnLogoUrl(cfg: StorageConfig, userId: string, url: string): boolean {
  const head = `${cfg.publicBase}/`;
  if (typeof url !== 'string' || !url.startsWith(head)) return false;
  const key = url.slice(head.length);
  const folder = `${cfg.keyPrefix}logos/${userId}/`;
  if (!key.startsWith(folder)) return false;
  const name = key.slice(folder.length);
  return name.length > 0 && !/[/?#%\\]/.test(name) && name !== '.' && name !== '..';
}

/** Best effort: a failure is logged (never with credentials) and never thrown, so a save or delete cannot fail because of S3. */
export async function deleteObjects(cfg: StorageConfig, keys: string[], send?: (cmd: unknown) => Promise<unknown>): Promise<void> {
  if (!keys.length) return;
  try {
    const run = send ?? ((cmd: unknown) => new S3Client({ region: cfg.region }).send(cmd as never));
    await run(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true } }));
  } catch (e) {
    console.error('could not delete stored photos', (e as Error)?.name ?? 'error', keys.length);
  }
}

/** True when `url` is a public bucket url for a file directly inside the workshop-requests/ folder. */
export function isRequestImageUrl(cfg: StorageConfig, url: string): boolean {
  const head = `${cfg.publicBase}/${cfg.keyPrefix}${REQUEST_AREA.folder}/`;
  if (typeof url !== 'string' || !url.startsWith(head)) return false;
  const rest = url.slice(head.length).split('/');
  return rest.length === 2 && rest.every(part => part.length > 0 && part !== '.' && part !== '..' && !/[?#%\\]/.test(part));
}
