'use client';
import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';

/** `dashboardUrl` is the dashboard host's origin when the dashboard lives on its own subdomain (empty: same site). */
export function AuthButton({ dashboardUrl = '' }: { dashboardUrl?: string }) {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="cart-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>Sign in</span>;
  if (!session?.user) {
    const login = () => signIn('google', { callbackUrl: '/sell' });
    return (
      <>
        <span className="seller-prompt">
          Are you a seller?{' '}
          <button type="button" className="seller-login-link" onClick={login}>Login here</button>
        </span>
        <button type="button" className="cart-btn seller-login-btn" onClick={login}>Seller login</button>
      </>
    );
  }
  return (
    <>
      {session.user.role === 'admin' && <Link href={`${dashboardUrl}/dashboard/posts`}>Admin</Link>}
      {session.user.role === 'seller' && <Link href={`${dashboardUrl}/dashboard/posts`}>My products</Link>}
      <button className="cart-btn" onClick={() => signOut()} title={session.user.email ?? undefined}>
        Sign out{session.user.role === 'admin' ? ' (admin)' : session.user.role === 'seller' ? ` (${session.user.name?.trim() || 'seller'})` : ''}
      </button>
    </>
  );
}
