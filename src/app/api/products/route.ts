import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { createProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return json(await listProducts({ city: sp.get('city') ?? undefined, category: sp.get('category') ?? undefined, q: sp.get('q') ?? undefined }));
});
export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const created = await createProduct(await readJson(req));
  revalidatePath('/', 'layout');
  return json(created, 201);
});
