import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { createTopic, listTopics } from '@/lib/topics';
export const dynamic = 'force-dynamic';
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listTopics(), 200, NO_STORE);
});

export const POST = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const created = await createTopic(await readJson(req));
  revalidatePath('/', 'layout');
  return json(created, 201, NO_STORE);
});
