import { auth } from '@/auth';
import { getDb } from '@/db/client';
import { ensureUser } from '@/db/people';
import { handle, json, readJson } from '@/lib/api';
import { requireUser } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { presignProductUpload, storageConfig } from '@/lib/storage';
export const dynamic = 'force-dynamic';

const LOGO_TYPES = ['image/jpeg', 'image/png'];

/** A short-lived form that lets any signed-in account (before it is a seller) upload one JPG or PNG logo to S3. */
export const POST = (req: Request) => handle(async () => {
  const user = requireUser(await auth());
  if (!limits.logoLimiter.hit(user.email.trim().toLowerCase())) throw new ApiError(429, 'Too many requests.');
  const cfg = storageConfig();
  if (!cfg) throw new ApiError(503, 'Image uploads are not set up yet.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.contentType !== 'string' || !LOGO_TYPES.includes(b.contentType)) throw new ApiError(400, 'Your logo must be a JPG or PNG.');
  const me = await ensureUser(getDb(), user.email);
  const { url, fields, publicUrl } = await presignProductUpload(cfg, me.id, { contentType: b.contentType, size: b.size });
  return json({ url, fields, publicUrl }, 200, { 'cache-control': 'no-store' });
});
