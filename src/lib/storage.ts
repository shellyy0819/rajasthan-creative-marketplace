import { randomUUID } from 'node:crypto';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ApiError } from './errors';

export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 6;

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

export function newProductKey(cfg: StorageConfig, userId: string, contentType: string): string {
  const ext = extOf(contentType);
  if (!ext) throw new ApiError(400, 'Photos must be JPEG, PNG or WebP.');
  return `${cfg.keyPrefix}products/${userId}/${randomUUID()}.${ext}`;
}

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

/** A short-lived S3 POST form allowing exactly one key, exactly the declared type, 1 byte to 5 MB. */
export async function presignProductUpload(
  cfg: StorageConfig, userId: string, req: { contentType: unknown; size: unknown }, createPost: PresignFn = createPresignedPost,
): Promise<{ url: string; fields: Record<string, string>; publicUrl: string; key: string }> {
  const ext = extOf(req.contentType);
  if (!ext) throw new ApiError(400, 'Photos must be JPEG, PNG or WebP.');
  const size = req.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES)
    throw new ApiError(400, 'Each photo must be between 1 byte and 5 MB.');
  const contentType = req.contentType as string;
  const key = newProductKey(cfg, userId, contentType);
  const { url, fields } = await createPost(new S3Client({ region: cfg.region }), {
    Bucket: cfg.bucket, Key: key, Expires: 300,
    Fields: { 'Content-Type': contentType },
    Conditions: [['content-length-range', 1, MAX_IMAGE_BYTES], ['eq', '$Content-Type', contentType]],
  });
  return { url, fields, publicUrl: publicUrlFor(cfg, key), key };
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
