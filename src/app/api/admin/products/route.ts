import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { listProductsForAdmin } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') ?? undefined;
  if (status && status !== 'APPROVED' && status !== 'DRAFT') throw new ApiError(400, 'status must be APPROVED or DRAFT.');
  return json(await listProductsForAdmin({ artist: sp.get('artist') ?? undefined, status, q: sp.get('q') ?? undefined }), 200, { 'cache-control': 'no-store' });
});
