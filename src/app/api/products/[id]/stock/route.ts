import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { actorOf, requireStaff } from '@/lib/authz';
import { setProductStock } from '@/lib/admin';
export const dynamic = 'force-dynamic';

/** { stock } changes only the stock (0 is sold out), for a seller's own product or any product for an admin. It applies at once, with no review. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  const user = requireStaff(await auth());
  const updated = await setProductStock((await params).id, await readJson(req), actorOf(user));
  revalidatePath('/', 'layout');
  return json(updated, 200, { 'cache-control': 'no-store' });
});
