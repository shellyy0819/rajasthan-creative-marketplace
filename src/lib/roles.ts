import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ROLE_ID, ensureUser, grantRole, normEmail } from '../db/people';
import { userRoles, users } from '../db/schema';
import { roleFor, type Role } from './authz';

export type Access = { role: Role; active: boolean };

/**
 * The highest role a person holds: admin (ADMIN_EMAILS, or an admin row in user_roles) > seller > customer.
 * Deactivated users are customers with active=false. A database error fails closed to a plain customer.
 */
export async function resolveAccess(email: string): Promise<Access> {
  const e = normEmail(email);
  if (roleFor(e) === 'admin') return { role: 'admin', active: true }; // the bootstrap admin can never be locked out
  try {
    // One round trip: the user and every role they hold.
    const rows = await getDb().select({ active: users.active, roleId: userRoles.roleId }).from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id)).where(sql`lower(${users.email}) = ${e}`);
    if (!rows.length) return { role: 'customer', active: true };
    if (!rows[0].active) return { role: 'customer', active: false };
    const ids = rows.flatMap(r => (r.roleId == null ? [] : [r.roleId]));
    return { role: ids.includes(ROLE_ID.admin) ? 'admin' : ids.includes(ROLE_ID.seller) ? 'seller' : 'customer', active: true };
  } catch (err) {
    console.error('role lookup failed; treating the user as a customer', err);
    return { role: 'customer', active: true };
  }
}

export const resolveRole = async (email: string): Promise<Role> => (await resolveAccess(email)).role;

/** Called at Google sign-in: create or refresh the user row (name, Google id) and give bootstrap admins their admin row. */
export async function upsertUserOnSignIn(p: { email: string; name?: string | null; sub?: string | null }): Promise<{ active: boolean }> {
  return getDb().transaction(async tx => {
    const u = await ensureUser(tx, p.email, p.name ?? undefined);
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (p.name?.trim() && u.name !== p.name.trim()) patch.name = p.name.trim();
    // A Google id already attached to another row (the person changed email) must not block sign-in.
    if (p.sub && !u.googleSub) {
      const [taken] = await tx.select({ id: users.id }).from(users).where(sql`${users.googleSub} = ${p.sub} and ${users.id} <> ${u.id}`);
      if (!taken) patch.googleSub = p.sub;
    }
    // Bootstrap admins are never locked out: sign-in reactivates them.
    const bootstrap = roleFor(p.email) === 'admin';
    if (bootstrap && !u.active) patch.active = true;
    if (Object.keys(patch).length > 1) await tx.update(users).set(patch).where(eq(users.id, u.id));
    if (roleFor(p.email) === 'admin') await grantRole(tx, u.id, 'admin');
    return { active: bootstrap || u.active };
  });
}
