import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getShareSettings, saveShareSettings } from '@/lib/share-settings';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await getShareSettings(), 200, NO_STORE);
});
export const PUT = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const saved = await saveShareSettings(await readJson(req), admin.email);
  revalidatePath('/', 'layout');   // pages that show or hide Share follow the new setting on the next visit
  return json(saved, 200, NO_STORE);
});
