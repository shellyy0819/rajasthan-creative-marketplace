import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SignInCard } from '@/components/SignInCard';
import { DEFAULT_CALLBACK, safeCallback } from '@/lib/callback-url';
import { dashboardPostsUrl, hostConfig, normalizeHost } from '@/lib/hosts';
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

/** The callback from the query when it is same-site or on the dashboard host; otherwise null. */
function callbackFrom(raw: string | undefined): string | null {
  const cfg = hostConfig();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL;
  let siteHost: string | undefined;
  try { siteHost = site ? normalizeHost(new URL(site).host) : undefined; } catch { /* unset */ }
  return safeCallback(raw, [siteHost, cfg.dashboardHost], normalizeHost);
}

export default async function SignInPage({ searchParams }: Props) {
  const q = await searchParams;
  const requested = callbackFrom(first(q.callbackUrl));
  const user = (await auth())?.user;
  if (user?.email) {
    if (user.role === 'seller' || user.role === 'admin') redirect(requested ?? dashboardPostsUrl());
    redirect('/sell');
  }
  return <><Breadcrumbs items={crumbs} /><SignInCard callbackUrl={requested ?? DEFAULT_CALLBACK} error={first(q.error)} /></>;
}
