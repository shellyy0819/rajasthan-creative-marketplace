import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { bad, obj } from '@/lib/validate';
import { getTheme } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
export const PREVIEW_COOKIE = 'rr_theme_preview';
const secure = (req: Request) => new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
const cookie = (req: Request, value: string, extra = '') =>
  `${PREVIEW_COOKIE}=${value}; Path=/; HttpOnly; SameSite=lax${secure(req) ? '; Secure' : ''}${extra}`;
export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const b = obj(await readJson(req) as never) as { id?: unknown };
  if (typeof b.id !== 'number' || !Number.isInteger(b.id) || b.id < 1) throw bad('id must be a theme id.');
  if (!(await getTheme(b.id))) return json({ error: 'Theme not found.' }, 404, { 'cache-control': 'no-store' });
  return json({ ok: true }, 200, { 'cache-control': 'no-store', 'set-cookie': cookie(req, String(b.id)) });
});
export const DELETE = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  return json({ ok: true }, 200, { 'cache-control': 'no-store', 'set-cookie': cookie(req, '', '; Max-Age=0') });
});
