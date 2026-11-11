import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { ANON_UPLOADER, REQUEST_AREA, presignUpload, storageConfig } from '@/lib/storage';
export const dynamic = 'force-dynamic';

/** A short-lived form that lets a visitor of the host-a-workshop form upload one photo straight to S3 (no sign-in; rate limited per address). */
export const POST = (req: Request) => handle(async () => {
  if (!limits.requestUploadLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const cfg = storageConfig();
  if (!cfg) throw new ApiError(503, 'Image uploads are not set up yet.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const { url, fields, publicUrl } = await presignUpload(cfg, ANON_UPLOADER, { contentType: b.contentType, size: b.size }, REQUEST_AREA);
  return json({ url, fields, publicUrl }, 200, { 'cache-control': 'no-store' });
});
