import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { createSourcingType, listSourcingTypesForAdmin } from '@/lib/sourcing-types';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listSourcingTypesForAdmin(), 200, NO_STORE);
});

export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const created = await createSourcingType(await readJson(req));
  revalidatePath('/', 'layout');
  return json(created, 201, NO_STORE);
});
