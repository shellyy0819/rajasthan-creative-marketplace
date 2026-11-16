import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { listCityRequests } from '@/lib/city-requests';
export const dynamic = 'force-dynamic';

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listCityRequests(), 200, { 'cache-control': 'no-store' });
});
