import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getSignText, saveSignText } from '@/lib/workshop-sign';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await getSignText(), 200, NO_STORE);
});

export const PUT = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const saved = await saveSignText(await readJson(req), admin.email);
  revalidatePath('/workshops');
  return json(saved, 200, NO_STORE);
});
