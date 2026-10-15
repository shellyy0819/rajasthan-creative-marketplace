import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { listArtists } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listArtists(), 200, { 'cache-control': 'no-store' });
});
