import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { TREND_PREVIEW_COOKIE } from '@/lib/trend-preview';
import { getDigest } from '@/lib/trend-store';
import { bad, obj } from '@/lib/validate';
export const dynamic = 'force-dynamic';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const secure = (req: Request) => new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
const cookie = (req: Request, value: string, extra = '') =>
  `${TREND_PREVIEW_COOKIE}=${value}; Path=/; HttpOnly; SameSite=lax${secure(req) ? '; Secure' : ''}${extra}`;
const NO_STORE = { 'cache-control': 'no-store' };

export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const b = obj(await readJson(req));
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) throw bad('id must be a digest id.');
  if (!(await getDigest(b.id))) throw new ApiError(404, 'Digest not found.');
  return json({ ok: true }, 200, { ...NO_STORE, 'set-cookie': cookie(req, b.id.toLowerCase()) });
});
export const DELETE = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  return json({ ok: true }, 200, { ...NO_STORE, 'set-cookie': cookie(req, '', '; Max-Age=0') });
});
