import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getHomeSettings, saveHomeSettings } from '@/lib/home-settings';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await getHomeSettings(), 200, NO_STORE);
});
export const PUT = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const saved = await saveHomeSettings(await readJson(req), admin.email);
  revalidatePath('/', 'layout');   // clears the cached home shelf too, so the home page shows the new number on the next visit
  return json(saved, 200, NO_STORE);
});
