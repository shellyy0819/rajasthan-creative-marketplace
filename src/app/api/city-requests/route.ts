import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { createCityRequest } from '@/lib/city-requests';
export const dynamic = 'force-dynamic';

/** A seller (or admin) adds the place they picked from the place search because the City field did not offer their city. Live at once; the team is emailed to review it. */
export const POST = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const { place, alreadyThere } = await createCityRequest(await readJson(req), { email: user.email, name: user.name ?? undefined });
  revalidatePath('/', 'layout');
  return json({ place, alreadyThere }, alreadyThere ? 200 : 201, { 'cache-control': 'no-store' });
});
