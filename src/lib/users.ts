import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb, type Q, type Tx } from '../db/client';
import { ROLE_ID, ensureSellerProfile, ensureUser, normEmail, type StoredRole } from '../db/people';
import { cities, sellerProfiles, userRoles, users } from '../db/schema';
import { roleFor } from './authz';
import { resolveCityInput } from './cities';
import { ApiError } from './errors';
import type { AdminUser, SellerProfile } from './types';
import { EMAIL_RE, bad, obj, optionalEmail, optionalPhone, optionalText, pick, text } from './validate';

const ASSIGNABLE: readonly StoredRole[] = ['seller', 'admin'];
/** Serialises every change that can affect who is an admin, so two admins cannot remove each other at the same time. */
const lockAdmins = (tx: Tx) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('rr_admin_guard'))`);
const LAST_ADMIN = () => new ApiError(409, 'At least one active admin is required.');

const cols = {
  id: users.id, email: users.email, name: users.name, active: users.active, createdAt: users.createdAt,
  roles: sql<string[]>`coalesce((select array_agg(r.name order by r.name) from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = users.id), '{}')`,
  products: sql<number>`(select count(*) from products p where p.seller_id = users.id)`.mapWith(Number),
  workshops: sql<number>`(select count(*) from workshops w where w.host_id = users.id)`.mapWith(Number),
  orders: sql<number>`(select count(*) from orders o where o.user_id = users.id)`.mapWith(Number),
  bookings: sql<number>`(select count(*) from bookings b where b.user_id = users.id)`.mapWith(Number),
};
const toAdminUser = (r: { id: string; email: string; name: string; active: boolean; createdAt: Date; roles: string[]; products: number; workshops: number; orders: number; bookings: number }): AdminUser =>
  ({ ...r, roles: r.roles as AdminUser['roles'], createdAt: r.createdAt.toISOString() });

export async function listUsers(): Promise<AdminUser[]> {
  const rows = await getDb().select(cols).from(users).orderBy(sql`lower(${users.email})`);
  return rows.map(toAdminUser);
}
async function loadUser(tx: Tx | ReturnType<typeof getDb>, id: string): Promise<AdminUser> {
  const [row] = await tx.select(cols).from(users).where(eq(users.id, id));
  if (!row) throw new ApiError(404, 'User not found.');
  return toAdminUser(row);
}

function parseRoles(v: unknown): StoredRole[] {
  if (!Array.isArray(v) || v.some(r => !ASSIGNABLE.includes(r as StoredRole))) throw bad(`roles must be a list of: ${ASSIGNABLE.join(', ')}.`);
  return [...new Set(v as StoredRole[])];
}

/** Active admins after an operation: DB admin rows plus the ADMIN_EMAILS bootstrap admins (who can never be locked out). */
async function adminsExcluding(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.select({ id: users.id, email: users.email }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.roleId, ROLE_ID.admin)))
    .where(eq(users.active, true));
  const emails = new Set(rows.filter(r => r.id !== userId).map(r => normEmail(r.email)));
  for (const e of (process.env.ADMIN_EMAILS ?? '').split(',').map(normEmail).filter(Boolean)) emails.add(e);
  return emails.size;
}

async function setRoles(tx: Tx, userId: string, userName: string, roles: StoredRole[], assignedBy: string) {
  const want = roles.map(r => ROLE_ID[r]);
  await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), want.length ? sql`${userRoles.roleId} not in (${sql.join(want.map(w => sql`${w}`), sql`, `)})` : undefined));
  for (const r of roles) await tx.insert(userRoles).values({ userId, roleId: ROLE_ID[r], assignedBy }).onConflictDoNothing();
  if (roles.includes('seller')) await ensureSellerProfile(tx, userId, userName);
}

export async function createUser(input: unknown, actorEmail: string): Promise<AdminUser> {
  const raw = pick(obj(input), ['email', 'name', 'roles']);
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw bad('email must be a valid email address.');
  const name = optionalText(raw.name, 'name', 100);
  const roles = raw.roles === undefined ? [] : parseRoles(raw.roles);
  return getDb().transaction(async tx => {
    const [exists] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${normEmail(email)}`);
    if (exists) throw new ApiError(409, 'User already exists.');
    const me = await ensureUser(tx, actorEmail);
    const u = await ensureUser(tx, email, name);
    await setRoles(tx, u.id, u.name, roles, me.id);
    return loadUser(tx, u.id);
  });
}

export async function updateUser(id: string, input: unknown, actorEmail: string): Promise<AdminUser> {
  const raw = pick(obj(input), ['roles', 'active', 'name']);
  if (raw.active !== undefined && typeof raw.active !== 'boolean') throw bad('active must be true or false.');
  const roles = raw.roles === undefined ? undefined : parseRoles(raw.roles);
  const name = raw.name === undefined ? undefined : text(raw.name, 'name', 100);
  return getDb().transaction(async tx => {
    await lockAdmins(tx);
    const me = await ensureUser(tx, actorEmail);
    const [u] = await tx.select().from(users).where(eq(users.id, id)).for('update');
    if (!u) throw new ApiError(404, 'User not found.');
    const wasAdmin = (await tx.select().from(userRoles).where(and(eq(userRoles.userId, id), eq(userRoles.roleId, ROLE_ID.admin)))).length > 0;
    const willBeAdmin = roles ? roles.includes('admin') : wasAdmin;
    const willBeActive = raw.active === undefined ? u.active : raw.active;
    if (roleFor(u.email) === 'admin' && (!willBeActive || !willBeAdmin))
      throw new ApiError(409, 'Bootstrap admins (ADMIN_EMAILS) cannot be deactivated or lose admin access.');
    if (id === me.id && (!willBeActive || (wasAdmin && !willBeAdmin))) throw new ApiError(409, 'You cannot remove your own admin access or deactivate yourself.');
    if (wasAdmin && (!willBeAdmin || !willBeActive) && (await adminsExcluding(tx, id)) === 0) throw LAST_ADMIN();
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (raw.active !== undefined) patch.active = raw.active as boolean;
    if (name !== undefined) patch.name = name;
    await tx.update(users).set(patch).where(eq(users.id, id));
    if (roles) await setRoles(tx, id, name ?? u.name, roles, me.id);
    return loadUser(tx, id);
  });
}

/** Only users who own nothing can be deleted; otherwise the admin deactivates them. */
export async function deleteUser(id: string, actorEmail: string): Promise<void> {
  await getDb().transaction(async tx => {
    await lockAdmins(tx);
    const me = await ensureUser(tx, actorEmail);
    if (id === me.id) throw new ApiError(409, 'You cannot delete yourself.');
    const u = await loadUser(tx, id);
    if (u.products + u.workshops + u.orders + u.bookings > 0)
      throw new ApiError(409, 'This user has products, workshops, orders or bookings. Deactivate them instead.');
    if (u.roles.includes('admin') && (await adminsExcluding(tx, id)) === 0) throw LAST_ADMIN();
    await tx.delete(users).where(eq(users.id, id));
  });
}

// ---------- seller profiles ----------
type ProfileRow = typeof sellerProfiles.$inferSelect & { cityName?: string | null };
const toProfile = (r: ProfileRow): SellerProfile => ({
  userId: r.userId, displayName: r.displayName,
  ...(r.publicPhone ? { publicPhone: r.publicPhone } : {}), ...(r.publicEmail ? { publicEmail: r.publicEmail } : {}),
  ...(r.instagram ? { instagram: r.instagram } : {}), ...(r.youtube ? { youtube: r.youtube } : {}),
  ...(r.bio ? { bio: r.bio } : {}), ...(r.cityName ? { city: r.cityName, cityId: r.cityId! } : {}),
});

async function loadProfile(q: Q, userId: string): Promise<ProfileRow | undefined> {
  const [r] = await q.select({ pf: sellerProfiles, cityName: cities.name }).from(sellerProfiles)
    .leftJoin(cities, eq(cities.id, sellerProfiles.cityId)).where(eq(sellerProfiles.userId, userId));
  return r && { ...r.pf, cityName: r.cityName };
}

export async function getProfileByEmail(email: string): Promise<SellerProfile> {
  const u = await ensureUser(getDb(), email);
  const p = await loadProfile(getDb(), u.id);
  return p ? toProfile(p) : { userId: u.id, displayName: u.name };
}

export async function getProfileById(userId: string): Promise<SellerProfile> {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!u) throw new ApiError(404, 'User not found.');
  const p = await loadProfile(getDb(), userId);
  return p ? toProfile(p) : { userId, displayName: u.name };
}

export async function saveProfile(userId: string, input: unknown): Promise<SellerProfile> {
  const raw = obj(input);
  const v = {
    displayName: text(raw.displayName, 'displayName', 100),
    publicPhone: optionalPhone(raw.publicPhone, 'publicPhone') ?? null,
    publicEmail: optionalEmail(raw.publicEmail, 'publicEmail') ?? null,
    instagram: optionalText(raw.instagram, 'instagram', 200) ?? null,
    youtube: optionalText(raw.youtube, 'youtube', 200) ?? null,
    bio: optionalText(raw.bio, 'bio', 500) ?? null,
  };
  if ('city' in raw) throw bad('city is not accepted; send cityId or cityRef.');
  return getDb().transaction(async tx => {
    const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!u) throw new ApiError(404, 'User not found.');
    const holds = await tx.select({ r: userRoles.roleId }).from(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.roleId, [ROLE_ID.seller, ROLE_ID.admin])));
    if (!holds.length && !(await isEnvAdmin(tx, userId))) throw bad('That user is not a seller.');
    // Neither cityId nor cityRef clears the profile city.
    const cityId = await resolveCityInput(tx, raw);
    await tx.insert(sellerProfiles).values({ userId, ...v, cityId })
      .onConflictDoUpdate({ target: sellerProfiles.userId, set: { ...v, cityId } });
    return toProfile((await loadProfile(tx, userId))!);
  });
}
async function isEnvAdmin(tx: Tx, userId: string) {
  const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return !!u && roleFor(u.email) === 'admin';
}
