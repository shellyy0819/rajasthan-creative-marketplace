import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { createWorkshop } from '@/lib/admin';
import { listWorkshops } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return json(await listWorkshops({ city: sp.get('city') ?? undefined, type: sp.get('type') ?? undefined, q: sp.get('q') ?? undefined }));
});
export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const created = await createWorkshop(await readJson(req));
  revalidatePath('/', 'layout');
  return json(created, 201);
});
