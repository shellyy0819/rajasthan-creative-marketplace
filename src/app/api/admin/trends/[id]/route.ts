import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { matchItems } from '@/lib/trend-match';
import { getDigest } from '@/lib/trend-store';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const digest = await getDigest((await params).id);
  if (!digest) throw new ApiError(404, 'Digest not found.');
  return json({ digest, matched: await matchItems(digest.items) }, 200, NO_STORE);
});
