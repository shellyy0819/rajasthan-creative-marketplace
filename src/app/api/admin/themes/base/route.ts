import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { obj } from '@/lib/validate';
import { toDto } from '@/lib/themes/dto';
import { getBase, updateBase } from '@/lib/themes/store';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(toDto(await getBase()), 200, NO_STORE);
});
export const PATCH = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  const b = obj(await readJson(req) as never) as { config?: unknown };
  return json(toDto(await updateBase({ config: b.config }, admin.email)), 200, NO_STORE);
});
