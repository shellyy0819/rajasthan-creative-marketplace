import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin, requireStaff } from '@/lib/authz';
import { updateOwnWorkshop } from '@/lib/seller-workshops';
import { updateWorkshop, deleteWorkshop } from '@/lib/admin';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const user = requireStaff(await auth());
  const id = (await params).id;
  // An admin edits any listing; a seller only their own, and never its status.
  const updated = user.role === 'admin' ? await updateWorkshop(id, await readJson(req)) : await updateOwnWorkshop(id, await readJson(req), user.email);
  revalidatePath('/', 'layout');
  return json(updated);
});

export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const { unlinkedProducts } = await deleteWorkshop((await params).id);
  revalidatePath('/', 'layout');
  return json({ ok: true, unlinkedProducts });
});
