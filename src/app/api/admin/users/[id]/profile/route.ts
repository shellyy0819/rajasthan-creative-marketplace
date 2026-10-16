import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getProfileById, saveProfile } from '@/lib/users';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: 'User not found.' }, 404);
  return json(await getProfileById(id), 200, { 'cache-control': 'no-store' });
});
export const PUT = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: 'User not found.' }, 404);
  const saved = await saveProfile(id, await readJson(req));
  revalidatePath('/', 'layout');
  return json(saved);
});
