import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { decideCityRequest } from '@/lib/city-requests';
export const dynamic = 'force-dynamic';

/** { decision: 'approve' | 'remove' | 'rename', name? }: confirm the city a seller added, take it out of the City field, or rename it. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  const admin = requireAdmin(await auth());
  const updated = await decideCityRequest((await params).id, await readJson(req), admin.email);
  revalidatePath('/', 'layout');
  return json(updated, 200, { 'cache-control': 'no-store' });
});
