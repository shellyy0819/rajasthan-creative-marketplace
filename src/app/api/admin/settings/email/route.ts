import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { clearEmailSettings, getEmailSettings, saveEmailSettings } from '@/lib/settings';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await getEmailSettings(), 200, NO_STORE);
});
export const PUT = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  return json(await saveEmailSettings(await readJson(req), admin.email), 200, NO_STORE);
});
export const DELETE = () => handle(async () => {
  requireAdmin(await auth());
  return json(await clearEmailSettings(), 200, NO_STORE);
});
