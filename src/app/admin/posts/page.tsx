import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireStaffPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin, listSellerOptions, listWorkshopOptions, scopeFor } from '@/lib/admin-posts';
import { listCategories } from '@/lib/categories';
import { getProfileByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const user = await requireStaffPage(); // never rely on the layout alone
  const scope = scopeFor(user);
  const [products, artists, workshops, categories, sellers, profile] = await Promise.all([
    listProductsForAdmin({}, scope), listArtists(scope), listWorkshopOptions(), listCategories(),
    user.role === 'admin' ? listSellerOptions() : Promise.resolve([]), getProfileByEmail(user.email),
  ]);
  // A seller has one level (Home > My products); an admin sees Home > Admin > Artists' posts.
  const crumbs = user.role === 'admin'
    ? [{ name: 'Home', path: '/' }, { name: 'Admin', path: '/admin' }, { name: 'Artists’ posts', path: '/admin/posts' }]
    : [{ name: 'Home', path: '/' }, { name: 'My products', path: '/admin/posts' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <PostsAdmin initialProducts={products} initialArtists={artists} role={user.role} categories={categories} workshops={workshops} sellers={sellers} me={{ id: profile.userId, name: profile.displayName, email: user.email, phone: profile.publicPhone }} profile={profile} />
    </>
  );
}
