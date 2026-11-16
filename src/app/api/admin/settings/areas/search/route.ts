import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { searchAreas } from '@/lib/places';
export const dynamic = 'force-dynamic';

/** Suburbs and neighbourhoods matching ?q=, for the admin to pick an extra city area from (admin only; the service behind it is fair-use). */
export const GET = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return json(q.trim().length < 2 ? [] : await searchAreas(q), 200, { 'cache-control': 'no-store' });
});
