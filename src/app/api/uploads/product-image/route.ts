import { auth } from '@/auth';
import { getDb } from '@/db/client';
import { ensureUser } from '@/db/people';
import { handle, json, readJson } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { presignProductUpload, storageConfig } from '@/lib/storage';
export const dynamic = 'force-dynamic';

/** A short-lived form that lets a signed-in seller or admin upload one photo straight to S3. */
export const POST = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  if (!limits.uploadLimiter.hit(user.email.trim().toLowerCase())) throw new ApiError(429, 'Too many requests.');
  const cfg = storageConfig();
  if (!cfg) throw new ApiError(503, 'Image uploads are not set up yet.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const me = await ensureUser(getDb(), user.email);
  const { url, fields, publicUrl } = await presignProductUpload(cfg, me.id, { contentType: b.contentType, size: b.size });
  return json({ url, fields, publicUrl }, 200, { 'cache-control': 'no-store' });
});
