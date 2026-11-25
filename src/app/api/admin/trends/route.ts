import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { runTrendFetch } from '@/lib/trend-fetch';
import { listDigests } from '@/lib/trend-store';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json({ digests: await listDigests() }, 200, NO_STORE);
});
export const POST = () => handle(async () => {
  const admin = requireAdmin(await auth());
  return json(await runTrendFetch(admin.email), 201, NO_STORE);
});
