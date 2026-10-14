'use client';
import { signIn, signOut, useSession } from 'next-auth/react';

export function AuthButton() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="cart-btn" aria-hidden="true" style={{ visibility: 'hidden' }}>Sign in</span>;
  if (!session?.user) return <button className="cart-btn" onClick={() => signIn('google')}>Sign in</button>;
  return (
    <button className="cart-btn" onClick={() => signOut()} title={session.user.email ?? undefined}>
      Sign out{session.user.role === 'admin' ? ' (admin)' : ''}
    </button>
  );
}
