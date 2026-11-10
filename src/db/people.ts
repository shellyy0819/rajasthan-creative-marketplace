import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Q } from './client';
import { sellerProfiles, userRoles, users } from './schema';

/** Seeded by migration 0003. "customer" is implicit: every signed-in user can buy and read. */
export const ROLE_ID = { seller: 1, admin: 2 } as const;
export type StoredRole = keyof typeof ROLE_ID;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const nameFromEmail = (email: string) => email.split('@')[0] || email;

/** Find the live user by email (case-insensitive; a soft-deleted user does not count) or create a role-less one. Returns the row. */
export async function ensureUser(q: Q, email: string, name?: string) {
  const e = normEmail(email);
  await q.insert(users).values({ email: e, name: (name ?? '').trim() || nameFromEmail(e) }).onConflictDoNothing();
  const [row] = await q.select().from(users).where(and(sql`lower(${users.email}) = ${e}`, isNull(users.deletedAt)));
  return row;
}

export async function grantRole(q: Q, userId: string, role: StoredRole, assignedBy: string | null = null) {
  await q.insert(userRoles).values({ userId, roleId: ROLE_ID[role], assignedBy }).onConflictDoNothing();
}

/** A seller always has a public profile; it starts from the user's name. */
export async function ensureSellerProfile(q: Q, userId: string, displayName: string) {
  await q.insert(sellerProfiles).values({ userId, displayName }).onConflictDoNothing();
}

export async function userIdByEmail(q: Q, email: string): Promise<string | undefined> {
  const [row] = await q.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${normEmail(email)}`, isNull(users.deletedAt)));
  return row?.id;
}

export const userById = async (q: Q, id: string) => (await q.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))))[0];
