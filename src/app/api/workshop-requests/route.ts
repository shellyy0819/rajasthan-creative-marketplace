import { auth } from '@/auth';
import { clientIp } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import * as limits from '@/lib/engagement-limits';
import { createWorkshopRequest, listWorkshopRequests } from '@/lib/workshop-requests';
export const dynamic = 'force-dynamic';

export const POST = (req: Request) => handle(async () => {
  if (!limits.workshopRequestLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  // hidden "company website" field: people never fill it, form-spamming bots do. Pretend success, store nothing.
  if (body && typeof body === 'object' && !Array.isArray(body) && (body as Record<string, unknown>).companyWebsite) return json({ ok: true }, 201);
  const created = await createWorkshopRequest(body);
  return json({ ok: true, id: created.id, email: created.email }, 201); // the id lets the form confirm the emailed code
});

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listWorkshopRequests(), 200, { 'cache-control': 'no-store' });
});
