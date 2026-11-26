import { revalidatePath, revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { publishDigest, unpublishDigest } from '@/lib/trend-store';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };

export const POST = (_req: Request, { params }: Ctx) => handle(async () => {
  const admin = requireAdmin(await auth());
  const digest = await publishDigest((await params).id, admin.email);
  revalidatePath('/trending');
  revalidateTag('trends', { expire: 0 }); // the cached block of a published digest; no stale serving
  return json(digest, 200, NO_STORE);
});
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const digest = await unpublishDigest((await params).id);
  revalidatePath('/trending');
  revalidateTag('trends', { expire: 0 }); // the cached block of a published digest; no stale serving
  return json(digest, 200, NO_STORE);
});
