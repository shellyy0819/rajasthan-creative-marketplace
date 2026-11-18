import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { setRequestStatus } from '@/lib/workshop-requests';
import { obj, oneOf } from '@/lib/validate';
export const dynamic = 'force-dynamic';

/** New, On hold or Archived: the review status of a request that is not a listing yet. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const status = oneOf(obj(await readJson(req)).status, 'status', ['received', 'on_hold', 'archived'] as const);
  const updated = await setRequestStatus((await params).id, status);
  revalidatePath('/dashboard/workshop-requests');
  return json(updated);
});
