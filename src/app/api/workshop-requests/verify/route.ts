import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { verifyWorkshopRequestCode } from '@/lib/workshop-requests';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handle(async () => {
  if (!limits.workshopVerifyLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const { notified } = await verifyWorkshopRequestCode(b.id, b.code);
  return json({ ok: true, notified }); // notified: the Craftofy team was emailed the details
});
