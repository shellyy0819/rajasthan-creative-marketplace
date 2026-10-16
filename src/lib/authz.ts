import { ApiError } from './errors';

export type Role = 'customer' | 'seller' | 'admin';
export type SessionUser = { email: string; role: Role; name?: string | null };
export type StaffUser = SessionUser & { role: 'admin' | 'seller' };
export type Actor = { email: string; role: 'admin' | 'seller' };
export type AppSession = { user?: { email?: string | null; role?: Role; name?: string | null; active?: boolean } } | null;

const ROLES: readonly unknown[] = ['customer', 'seller', 'admin'];
export const asRole = (v: unknown): Role => (ROLES.includes(v) ? (v as Role) : 'customer');

/** Env-based admin check (the bootstrap admin). Everyone else's roles live in the database: see resolveAccess in roles.ts. */
export function roleFor(email: string, adminEmails = process.env.ADMIN_EMAILS): Role {
  const admins = (adminEmails ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.trim().toLowerCase()) ? 'admin' : 'customer';
}

export function requireUser(session: AppSession): SessionUser {
  const email = session?.user?.email;
  if (!email) throw new ApiError(401, 'Authentication required.');
  if (session?.user?.active === false) throw new ApiError(403, 'Account is deactivated.');
  return { email, role: asRole(session?.user?.role), name: session?.user?.name };
}

export function requireStaff(session: AppSession): StaffUser {
  const user = requireUser(session);
  if (user.role === 'customer') throw new ApiError(403, 'Seller or admin access required.');
  return user as StaffUser;
}

export const actorOf = (u: StaffUser): Actor => ({ email: u.email, role: u.role });

export function requireAdmin(session: AppSession): SessionUser {
  const user = requireUser(session);
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required.');
  return user;
}
