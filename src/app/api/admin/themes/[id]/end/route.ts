import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { toDto } from '@/lib/themes/dto';
import { endNow } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };
export const POST = (_req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const s = (await params).id;
  if (!/^\d{1,9}$/.test(s)) return json({ error: 'Theme not found.' }, 404, NO_STORE);
  const now = new Date();
  return json(toDto(await endNow(Number(s), admin.email, now), now), 200, NO_STORE);
});
