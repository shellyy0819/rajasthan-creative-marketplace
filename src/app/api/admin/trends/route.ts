import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { runTrendFetch } from '@/lib/trend-fetch';
import { ApiError } from '@/lib/errors';
import { listDigests, startManualDigest } from '@/lib/trend-store';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json({ digests: await listDigests() }, 200, NO_STORE);
});
/** The body is optional: none (the Fetch trends button) is a normal fetch. `{ "manual": true }` starts an empty digest by hand instead. */
async function manualFlag(req: Request | undefined): Promise<boolean> {
  const body = await req?.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('manual' in body)) return false;
  const manual = (body as { manual: unknown }).manual;
  if (typeof manual !== 'boolean') throw new ApiError(400, 'manual must be true or false.');
  return manual;
}

export const POST = (req?: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  if (await manualFlag(req)) return json(await startManualDigest(admin.email), 201, NO_STORE); // no key, no Gemini, no gap
  return json(await runTrendFetch(admin.email), 201, NO_STORE);
});
