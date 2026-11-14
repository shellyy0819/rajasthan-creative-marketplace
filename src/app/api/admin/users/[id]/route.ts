import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { deleteUser, updateUser } from '@/lib/users';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = () => json({ error: 'User not found.' }, 404);
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const { id } = await params;
  if (!UUID.test(id)) return NOT_FOUND();
  const updated = await updateUser(id, await readJson(req), admin.email);
  revalidatePath('/', 'layout'); // a deactivated or re-roled seller must not stay in cached public pages
  return json(updated);
});
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const { id } = await params;
  if (!UUID.test(id)) return NOT_FOUND();
  await deleteUser(id, admin.email);
  revalidatePath('/', 'layout');
  return json({ ok: true });
});
