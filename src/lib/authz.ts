import { ApiError } from './errors';

export type Role = 'customer' | 'admin';
export type SessionUser = { email: string; role: Role; name?: string | null };
export type AppSession = { user?: { email?: string | null; role?: Role; name?: string | null } } | null;

export function roleFor(email: string, adminEmails = process.env.ADMIN_EMAILS): Role {
  const admins = (adminEmails ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.trim().toLowerCase()) ? 'admin' : 'customer';
}

export function requireUser(session: AppSession): SessionUser {
  const email = session?.user?.email;
  if (!email) throw new ApiError(401, 'Authentication required.');
  return { email, role: session?.user?.role === 'admin' ? 'admin' : 'customer', name: session?.user?.name };
}

export function requireAdmin(session: AppSession): SessionUser {
  const user = requireUser(session);
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required.');
  return user;
}
