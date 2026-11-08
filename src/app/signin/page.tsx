import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SignInCard } from '@/components/SignInCard';
import { DEFAULT_CALLBACK, allowedCallbackHosts, onDashboardHost, safeCallback } from '@/lib/callback-url';
import { dashboardPostsUrl, hostConfig } from '@/lib/hosts';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to Craftofy with your Google account to add products and manage your listings.',
  path: '/signin',
  noindex: true,
  image: false,
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Sign in', path: '/signin' }];
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({ searchParams }: Props) {
  const q = await searchParams;
  const safe = safeCallback(first(q.callbackUrl), allowedCallbackHosts());
  const requested = safe && onDashboardHost(safe, hostConfig().dashboardOrigin);
  const user = (await auth())?.user;
  if (user?.email) {
    if (user.role === 'seller' || user.role === 'admin') redirect(requested ?? dashboardPostsUrl());
    redirect('/sell');
  }
  return <><Breadcrumbs items={crumbs} /><SignInCard callbackUrl={requested ?? DEFAULT_CALLBACK} error={first(q.error)} /></>;
}
