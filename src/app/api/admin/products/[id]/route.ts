import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { getProductForAdmin, scopeFor } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  const user = requireStaff(await auth());
  return json(await getProductForAdmin((await params).id, scopeFor(user)), 200, { 'cache-control': 'no-store' });
});
