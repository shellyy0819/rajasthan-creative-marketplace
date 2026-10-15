import type { AppSession } from './authz';

export type Gate = 'ok' | 'signin' | 'forbidden';

export function adminGate(session: AppSession): Gate {
  if (!session?.user?.email) return 'signin';
  return session.user.role === 'admin' ? 'ok' : 'forbidden';
}
