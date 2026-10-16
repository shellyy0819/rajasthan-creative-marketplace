import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { updateWorkshop, deleteWorkshop } from '@/lib/admin';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const updated = await updateWorkshop((await params).id, await readJson(req));
  revalidatePath('/', 'layout');
  return json(updated);
});

export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const { unlinkedProducts } = await deleteWorkshop((await params).id);
  revalidatePath('/', 'layout');
  return json({ ok: true, unlinkedProducts });
});
