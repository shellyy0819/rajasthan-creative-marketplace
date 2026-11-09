import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireStaffPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin, listSellerOptions, listWorkshopOptions, scopeFor } from '@/lib/admin-posts';
import { SectionLoader } from '@/components/SectionLoader';
import { listCategories } from '@/lib/categories';
import { hostConfig } from '@/lib/hosts';
import { wantsNewPost } from '@/lib/new-post-param';
import { getProfileByEmail } from '@/lib/users';
import type { StaffUser } from '@/lib/authz';

export const dynamic = 'force-dynamic';

async function PostsData({ user, openNew }: { user: StaffUser; openNew: boolean }) {
  const scope = scopeFor(user);
  const [products, artists, workshops, categories, sellers, profile] = await Promise.all([
    listProductsForAdmin({}, scope), listArtists(scope), listWorkshopOptions(), listCategories(),
    user.role === 'admin' ? listSellerOptions() : Promise.resolve([]), getProfileByEmail(user.email),
  ]);
  return <PostsAdmin initialProducts={products} initialArtists={artists} role={user.role} categories={categories} workshops={workshops} sellers={sellers} me={{ id: profile.userId, name: profile.displayName, email: user.email, phone: profile.publicPhone }} profile={profile} openNew={openNew} />;
}

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireStaffPage(); // never rely on the layout alone; runs before anything is returned, so a visitor without access never sees a shell
  const openNew = wantsNewPost(await searchParams);
  // "Home" leads to the public shop, which is another host when the dashboard has its own subdomain.
  const home = hostConfig().publicOrigin ?? '/';
  // A seller has one level (Home > My products); an admin sees Home > Dashboard > Artists' posts.
  const crumbs = user.role === 'admin'
    ? [{ name: 'Home', path: home }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Artists’ posts', path: '/dashboard/posts' }]
    : [{ name: 'Home', path: home }, { name: 'My products', path: '/dashboard/posts' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <Suspense fallback={<SectionLoader label="Loading your products…" variant="list" />}><PostsData user={user} openNew={openNew} /></Suspense>
    </>
  );
}
