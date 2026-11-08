import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { requireStaff } from '@/lib/authz';
import { getProfileByEmail, saveProfile } from '@/lib/users';
export const dynamic = 'force-dynamic';
// The signed-in seller's (or admin's) own public profile: the name and contact shown on their product pages.
export const GET = () => handle(async () => {
  const user = requireStaff(await auth());
  return json(await getProfileByEmail(user.email), 200, { 'cache-control': 'no-store' });
});
export const PUT = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const mine = await getProfileByEmail(user.email);
  // Once a seller has posted their details they are final: only an admin can change them.
  if (user.role === 'seller' && mine.onboardedAt) throw new ApiError(403, 'Your details are locked. Contact Craftofy to change them.');
  const saved = await saveProfile(mine.userId, await readJson(req));
  revalidatePath('/', 'layout');
  return json(saved);
});
