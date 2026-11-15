import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { deleteSourcingType, updateSourcingType } from '@/lib/sourcing-types';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };
const parseId = (s: string) => { if (!/^\d{1,9}$/.test(s)) throw new ApiError(404, 'Sourcing type not found.'); return Number(s); };

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const updated = await updateSourcingType(parseId((await params).id), await readJson(req));
  revalidatePath('/', 'layout');
  return json(updated, 200, NO_STORE);
});

export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  await deleteSourcingType(parseId((await params).id));
  revalidatePath('/', 'layout');
  return json({ ok: true }, 200, NO_STORE);
});
