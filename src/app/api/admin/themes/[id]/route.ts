import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { obj } from '@/lib/validate';
import { toDto } from '@/lib/themes/dto';
import { deleteTheme, getTheme, updateTheme } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };
const NOT_FOUND = () => json({ error: 'Theme not found.' }, 404, NO_STORE);
const parseId = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : null);
export const GET = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const id = parseId((await params).id);
  const row = id === null ? undefined : await getTheme(id);
  return row ? json(toDto(row), 200, NO_STORE) : NOT_FOUND();
});
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const id = parseId((await params).id);
  if (id === null) return NOT_FOUND();
  const b = obj(await readJson(req) as never) as { config?: unknown; startsAtIst?: unknown; endsAtIst?: unknown };
  return json(toDto(await updateTheme(id, { config: b.config, startsAtIst: b.startsAtIst, endsAtIst: b.endsAtIst }, admin.email)), 200, NO_STORE);
});
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const id = parseId((await params).id);
  if (id === null) return NOT_FOUND();
  await deleteTheme(id);
  return json({ ok: true }, 200, NO_STORE);
});
