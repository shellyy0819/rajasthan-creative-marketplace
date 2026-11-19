import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { updateWorkshop } from '@/lib/admin';
import { obj, oneOf } from '@/lib/validate';
export const dynamic = 'force-dynamic';

/** Draft, Published (APPROVED) or Archived: the only thing this route changes. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const status = oneOf(obj(await readJson(req)).status, 'status', ['DRAFT', 'APPROVED', 'ARCHIVED'] as const);
  const updated = await updateWorkshop((await params).id, { status });
  revalidatePath('/', 'layout');
  return json(updated);
});
