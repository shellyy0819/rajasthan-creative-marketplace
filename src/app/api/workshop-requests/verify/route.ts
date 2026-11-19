import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { draftForSeller } from '@/lib/seller-draft';
import { verifyWorkshopRequestCode } from '@/lib/workshop-requests';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handle(async () => {
  if (!limits.workshopVerifyLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const { notified, justConfirmed, ...confirmed } = await verifyWorkshopRequestCode(b.id, b.code);
  // A seller's own request also becomes a Draft listing of theirs, but only for the call that really checked the code (one caller, so no race and
  // no drafting for a request whose email was never confirmed). It never makes the confirmation fail.
  if (justConfirmed) { try { await draftForSeller(confirmed); } catch { /* the team can still list it from the request */ } }
  return json({ ok: true, notified }); // notified: the Craftofy team was emailed the details
});
