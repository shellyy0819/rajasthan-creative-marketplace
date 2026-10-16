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
  return json(await updateUser(id, await readJson(req), admin.email));
});
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const { id } = await params;
  if (!UUID.test(id)) return NOT_FOUND();
  await deleteUser(id, admin.email);
  return json({ ok: true });
});
