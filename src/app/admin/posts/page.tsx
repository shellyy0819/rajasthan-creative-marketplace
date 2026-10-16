import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireStaffPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin, listSellerOptions, listWorkshopOptions, scopeFor } from '@/lib/admin-posts';
import { getProfileByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const user = await requireStaffPage(); // never rely on the layout alone
  const scope = scopeFor(user);
  const [products, artists, workshops, sellers, profile] = await Promise.all([
    listProductsForAdmin({}, scope), listArtists(scope), listWorkshopOptions(),
    user.role === 'admin' ? listSellerOptions() : Promise.resolve([]), getProfileByEmail(user.email),
  ]);
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: user.role === 'admin' ? 'Admin' : 'Seller', path: '/admin/posts' },
    { name: user.role === 'admin' ? 'Artists’ posts' : 'My products', path: '/admin/posts' },
  ];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <PostsAdmin initialProducts={products} initialArtists={artists} role={user.role} workshops={workshops} sellers={sellers} profile={profile} />
    </>
  );
}
