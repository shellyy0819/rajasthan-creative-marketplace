import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { descriptionOf, setCategoryDescription } from '@/lib/category-pages';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ slug: string }> };

/** Admin only: write or clear the description shown on the category's page. */
export const PATCH = (req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  const { slug } = await params;
  const saved = await setCategoryDescription(slug, descriptionOf(await readJson(req)));
  revalidatePath(`/categories/${slug}`);
  return json(saved);
});
