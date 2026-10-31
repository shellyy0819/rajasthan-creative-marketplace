import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { createListingRequest, listListingRequests } from '@/lib/listing-requests';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handle(async () => {
  if (!limits.listingLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  // hidden "company website" field: people never fill it, form-spamming bots do. Pretend success, store nothing.
  if (body && typeof body === 'object' && !Array.isArray(body) && (body as Record<string, unknown>).companyWebsite) return json({ ok: true }, 201);
  await createListingRequest(body);
  return json({ ok: true }, 201);
});

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listListingRequests(), 200, { 'cache-control': 'no-store' });
});
