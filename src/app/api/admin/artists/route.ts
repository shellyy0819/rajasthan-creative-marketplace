import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { listArtists, scopeFor } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  const user = requireStaff(await auth());
  return json(await listArtists(scopeFor(user)), 200, { 'cache-control': 'no-store' });
});
