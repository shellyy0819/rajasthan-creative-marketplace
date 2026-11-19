import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { SellerTabs } from '@/components/SellerTabs';
import { SellerWorkshops } from '@/components/SellerWorkshops';
import { requireStaffPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin, listSellerOptions, listWorkshopOptions, scopeFor } from '@/lib/admin-posts';
import { listCategories } from '@/lib/categories';
import { listSourcingTypes } from '@/lib/sourcing-types';
import { hostConfig } from '@/lib/hosts';
import { sellerTab, wantsNewPost, wantsProfile } from '@/lib/new-post-param';
import { listSellerWorkshops } from '@/lib/seller-workshops';
import { listActiveTopics } from '@/lib/topics';
import { getProfileByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const user = await requireStaffPage(); // never rely on the layout alone
  const sp = await searchParams;
  const openNew = wantsNewPost(sp);
  const openProfile = wantsProfile(sp);
  const scope = scopeFor(user);
  const isAdmin = user.role === 'admin';
  const tab = isAdmin ? 'products' : sellerTab(sp);
  const [products, artists, workshops, categories, sourcingTypes, sellers, profile, myWorkshops, topics] = await Promise.all([
    listProductsForAdmin({}, scope), listArtists(scope), listWorkshopOptions(), listCategories(), listSourcingTypes(),
    user.role === 'admin' ? listSellerOptions() : Promise.resolve([]), getProfileByEmail(user.email),
    // A seller sees and edits their own workshops here too; an admin manages every listing on the Workshops tab.
    isAdmin ? Promise.resolve([]) : listSellerWorkshops(user.email), isAdmin ? Promise.resolve([]) : listActiveTopics(),
  ]);
  // "Home" leads to the public shop, which is another host when the dashboard has its own subdomain.
  const home = hostConfig().publicOrigin ?? '/';
  // A seller has one level (Home > My products); an admin sees Home > Dashboard > Artists' posts.
  const crumbs = user.role === 'admin'
    ? [{ name: 'Home', path: home }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Artists’ posts', path: '/dashboard/posts' }]
    : [{ name: 'Home', path: home }, tab === 'workshops' ? { name: 'My workshops', path: '/dashboard/posts?tab=workshops' } : { name: 'My products', path: '/dashboard/posts' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      {!isAdmin && <SellerTabs current={tab} />}
      {tab === 'workshops'
        ? <SellerWorkshops initial={myWorkshops} topics={topics} />
        : <PostsAdmin initialProducts={products} initialArtists={artists} role={user.role} categories={categories} sourcingTypes={sourcingTypes} workshops={workshops} sellers={sellers} me={{ id: profile.userId, name: profile.displayName, email: user.email, phone: profile.publicPhone }} profile={profile} openNew={openNew} openProfile={openProfile} />}
    </>
  );
}
