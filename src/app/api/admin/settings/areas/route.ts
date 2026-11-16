import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { addExtraArea, getExtraAreas, removeExtraArea } from '@/lib/extra-areas';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

/** The extra city areas the City field offers (admin only). POST { ref, name } adds the area picked from the area search; DELETE { osmType, osmId } removes one. */
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json({ areas: await getExtraAreas() }, 200, NO_STORE);
});
export const POST = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const areas = await addExtraArea(await readJson(req), admin.email);
  revalidatePath('/', 'layout');
  return json({ areas }, 200, NO_STORE);
});
export const DELETE = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const areas = await removeExtraArea(await readJson(req), admin.email);
  revalidatePath('/', 'layout');
  return json({ areas }, 200, NO_STORE);
});
