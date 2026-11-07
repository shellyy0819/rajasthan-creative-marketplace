import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SellerOnboarding } from '@/components/SellerOnboarding';
import { SellerWelcome } from '@/components/SellerWelcome';
import { dashboardPostsUrl } from '@/lib/hosts';

export const metadata: Metadata = { title: 'Sell on Craftofy', robots: { index: false, follow: false } };

export default async function SellPage() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return <SellerWelcome />;
  if (user.active === false) {
    return (
      <main>
        <h1>This account has been deactivated</h1>
        <p>It cannot be used to sell on Craftofy. Please contact us if you think this is a mistake.</p>
      </main>
    );
  }
  if (user.role === 'seller' || user.role === 'admin') redirect(dashboardPostsUrl());
  return <SellerOnboarding initialName={user.name ?? ''} initialEmail={user.email} postsUrl={dashboardPostsUrl()} postsUrlNew={dashboardPostsUrl({ newPost: true })} />;
}
