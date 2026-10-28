'use client';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';

/** `dashboardUrl` is the dashboard host's origin when the dashboard lives on its own subdomain (empty: same site). */
export function AuthButton({ dashboardUrl = '' }: { dashboardUrl?: string }) {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="cart-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>Sign in</span>;
  if (!session?.user) return <button className="cart-btn" onClick={() => signIn('google')}>Sign in</button>;
  return (
    <>
      {session.user.role === 'admin' && <Link href={`${dashboardUrl}/dashboard/posts`}>Admin</Link>}
      {session.user.role === 'seller' && <Link href={`${dashboardUrl}/dashboard/posts`}>My products</Link>}
      <button className="cart-btn" onClick={() => signOut()} title={session.user.email ?? undefined}>
        Sign out{session.user.role === 'admin' ? ' (admin)' : session.user.role === 'seller' ? ' (seller)' : ''}
      </button>
    </>
  );
}
