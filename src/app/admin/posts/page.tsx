import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin } from '@/lib/admin-posts';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  await requireAdminPage(); // never rely on the layout alone
  const [products, artists] = await Promise.all([listProductsForAdmin(), listArtists()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Admin', path: '/admin' }, { name: 'Artists’ posts', path: '/admin/posts' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <PostsAdmin initialProducts={products} initialArtists={artists} />
    </>
  );
}
