import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { toDto } from '@/lib/themes/dto';
import { scheduleTheme, unscheduleTheme } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };
const parseId = (s: string) => (/^\d{1,9}$/.test(s) ? Number(s) : null);
const run = (fn: (id: number, by: string) => ReturnType<typeof scheduleTheme>) => ({ params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const id = parseId((await params).id);
  if (id === null) return json({ error: 'Theme not found.' }, 404, NO_STORE);
  return json(toDto(await fn(id, admin.email)), 200, NO_STORE);
});
export const POST = (_req: Request, ctx: Ctx) => run((id, by) => scheduleTheme(id, by))(ctx);
export const DELETE = (_req: Request, ctx: Ctx) => run((id, by) => unscheduleTheme(id, by))(ctx);
