import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { addItem } from '@/lib/trend-store';
import { bad, obj } from '@/lib/validate';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const b = obj(await readJson(req));
  // addItem only type-checks the origin, so it is checked here: an admin adds items from Pinterest or by hand, never as web research.
  if (b.origin !== 'pinterest' && b.origin !== 'manual') throw bad('origin must be pinterest or manual.');
  return json(await addItem((await params).id, b, b.origin), 201, NO_STORE);
});
