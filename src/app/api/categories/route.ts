import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireStaff } from '@/lib/authz';
import { createCategory, listCategories } from '@/lib/categories';
export const dynamic = 'force-dynamic';

export const GET = () => handle(async () => json(await listCategories()));

/** Sellers and admins can add a category while creating a product. Repeating an existing name is fine (200). */
export const POST = (req: Request) => handle(async () => {
  const user = requireStaff(await auth());
  const { name, created } = await createCategory(await readJson(req), user.email);
  if (created) revalidatePath('/', 'layout');
  return json({ name }, created ? 201 : 200);
});
