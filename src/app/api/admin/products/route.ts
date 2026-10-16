import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { listProductsForAdmin, scopeFor } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') ?? undefined;
  if (status && status !== 'APPROVED' && status !== 'DRAFT' && status !== 'ARCHIVED') throw new ApiError(400, 'status must be APPROVED, DRAFT, or ARCHIVED.');
  return json(await listProductsForAdmin({ artist: sp.get('artist') ?? undefined, status, q: sp.get('q') ?? undefined }, scopeFor(user)), 200, { 'cache-control': 'no-store' });
});
