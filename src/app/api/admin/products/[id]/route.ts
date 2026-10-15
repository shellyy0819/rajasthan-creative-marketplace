import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getProductForAdmin } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  return json(await getProductForAdmin((await params).id), 200, { 'cache-control': 'no-store' });
});
