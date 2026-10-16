import type { AppSession } from './authz';

export type Gate = 'ok' | 'signin' | 'forbidden';

export function adminGate(session: AppSession): Gate {
  if (!session?.user?.email) return 'signin';
  if (session.user.active === false) return 'forbidden';
  return session.user.role === 'admin' ? 'ok' : 'forbidden';
}

export function staffGate(session: AppSession): Gate {
  if (!session?.user?.email) return 'signin';
  if (session.user.active === false) return 'forbidden';
  const r = session.user.role;
  return r === 'admin' || r === 'seller' ? 'ok' : 'forbidden';
}
