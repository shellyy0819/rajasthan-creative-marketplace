import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { setTopicActive } from '@/lib/topics';
import { bad, obj } from '@/lib/validate';
export const dynamic = 'force-dynamic';

/** Switch a topic on or off. A topic in use is switched off, never deleted: its listings keep showing it. */
export const PATCH = (req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Topic not found.');
  const { active } = obj(await readJson(req));
  if (typeof active !== 'boolean') throw bad('active must be true or false.');
  const updated = await setTopicActive(id, active);
  revalidatePath('/', 'layout');
  return json(updated);
});
