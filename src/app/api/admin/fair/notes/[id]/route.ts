import { auth } from '@/auth';
import { handle } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { deleteNote } from '@/lib/fair-notes';
export const dynamic = 'force-dynamic';

export const DELETE = (_req: Request, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  const { id } = await ctx.params;
  if (!/^\d{1,9}$/.test(id)) throw new ApiError(404, 'Note not found.');
  await deleteNote(Number(id));
  return new Response(null, { status: 204 });
});
