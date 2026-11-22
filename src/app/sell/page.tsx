import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { SellerOnboarding } from '@/components/SellerOnboarding';
import { SellerWelcome } from '@/components/SellerWelcome';
import { dashboardPostsUrl } from '@/lib/hosts';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'Sell Your Handmade Crafts in India',
  description: 'List your handmade crafts and reach customers in your city. Customers contact you directly, with no commission.',
  path: '/sell',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Sell on Craftofy', path: '/sell' }];

export default async function SellPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return <><Breadcrumbs items={crumbs} /><SellerWelcome /></>;
  if (user.active === false) {
    return (
      <>
        <Breadcrumbs items={crumbs} />
        <InfoPage eyebrow="SELL ON CRAFTOFY" title="This account has been deactivated" intro="It cannot be used to sell on Craftofy. Please contact us if you think this is a mistake." />
      </>
    );
  }
  if (user.role === 'seller' || user.role === 'admin') redirect(dashboardPostsUrl());
  return <><Breadcrumbs items={crumbs} /><SellerOnboarding initialName={user.name ?? ''} initialEmail={user.email} postsUrl={dashboardPostsUrl()} postsUrlNew={dashboardPostsUrl({ newPost: true })} /></>;
}
