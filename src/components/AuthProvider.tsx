'use client';
import { SessionProvider } from 'next-auth/react';
import { SessionGuard } from './SessionGuard';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider><SessionGuard />{children}</SessionProvider>;
}
