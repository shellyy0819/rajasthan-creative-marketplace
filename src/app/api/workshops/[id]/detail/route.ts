import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getWorkshopSellerDetail } from '@/lib/workshop-detail';
export const dynamic = 'force-dynamic';

/** Admin only: a listing with its host's profile, their other workshops and their products. */
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  return json(await getWorkshopSellerDetail((await params).id), 200, { 'cache-control': 'no-store' });
});
