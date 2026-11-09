import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { addMissingLogo, getProfileByEmail } from '@/lib/users';
export const dynamic = 'force-dynamic';
// A locked seller who skipped the logo at sign-up can add it later. It cannot replace a logo that is already stored.
export const PUT = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const mine = await getProfileByEmail(user.email);
  const saved = await addMissingLogo(mine.userId, await readJson(req));
  revalidatePath('/', 'layout');
  return json(saved);
});
