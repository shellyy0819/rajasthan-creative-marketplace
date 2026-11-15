import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { actorOf, requireStaff } from '@/lib/authz';
import { createProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { PRODUCTS_PAGE_MAX } from '@/lib/catalog-shared';
import { ApiError } from '@/lib/errors';
export const dynamic = 'force-dynamic';
/** An optional whole number within [min, max]; anything else is a 400 that names the parameter. */
function pageNumber(raw: string | null, name: string, min: number, max: number): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < min || n > max) throw new ApiError(400, `${name} must be a whole number from ${min} to ${max}`);
  return n;
}
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  const limit = pageNumber(sp.get('limit'), 'limit', 1, PRODUCTS_PAGE_MAX);
  const offset = pageNumber(sp.get('offset'), 'offset', 0, Number.MAX_SAFE_INTEGER);
  if (offset !== undefined && limit === undefined) throw new ApiError(400, 'offset needs a limit');
  return json(await listProducts({ city: sp.get('city') ?? undefined, category: sp.get('category') ?? undefined, source: sp.get('source') ?? undefined, q: sp.get('q') ?? undefined, ...(limit !== undefined ? { limit, offset: offset ?? 0 } : {}) }));
});
export const POST = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const created = await createProduct(await readJson(req), actorOf(user));
  revalidatePath('/', 'layout');
  return json(created, 201);
});
