import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { appVersion } from '@/lib/version';
export const dynamic = 'force-dynamic';

/** Which commit is running. Admins only: everyone else gets the same 401 or 403 as any other admin API. */
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(appVersion(), 200, { 'cache-control': 'no-store' });
});
