import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { patchItem, type ItemPatch } from '@/lib/trend-store';
import { obj, pick } from '@/lib/validate';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; itemId: string }> };
const NO_STORE = { 'cache-control': 'no-store' };
// An admin can change what the item says and whether it shows. Its id and where it came from stay as they were.
const EDITABLE = ['show', 'kind', 'title', 'why', 'category', 'tags', 'sources'] as const;

export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const patch = pick(obj(await readJson(req)), EDITABLE) as ItemPatch;
  const { id, itemId } = await params;
  return json(await patchItem(id, itemId, patch), 200, NO_STORE);
});
