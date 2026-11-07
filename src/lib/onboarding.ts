import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ROLE_ID, ensureSellerProfile, ensureUser, grantRole } from '../db/people';
import { sellerProfiles, userRoles, users } from '../db/schema';
import { roleFor } from './authz';
import { canonicalCategory } from './categories';
import { resolveCityInput } from './cities';
import { ApiError } from './errors';
import { validateOnboarding, type OnboardingInput } from './onboarding-validate';

export type OnboardingResult = { status: 'created' | 'completed' | 'unchanged'; userId: string };

/** The logo must be an http(s) URL (validateLogoUrl only checks length). */
function isHttpUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

/**
 * Finishes seller onboarding for a verified Google email in ONE transaction: the user row is locked, a deactivated
 * user is refused before anything is written, and the seller role is granted together with the profile save, so a
 * failed profile (bad city, bad category) leaves no role behind. Input is re-validated here: callers are not trusted.
 */
export async function completeOnboarding(email: string, input: OnboardingInput): Promise<OnboardingResult> {
  const checked = validateOnboarding(input);
  if (!checked.ok) throw new ApiError(400, Object.values(checked.errors)[0] ?? 'Invalid request.');
  const v = checked.value;
  if (!isHttpUrl(v.logoUrl)) throw new ApiError(400, 'Upload your logo.');

  return getDb().transaction(async tx => {
    const found = await ensureUser(tx, email);
    // Serialise concurrent calls for the same user; re-read state only after the lock is held.
    const [u] = await tx.select().from(users).where(eq(users.id, found.id)).for('update');
    if (!u) throw new ApiError(404, 'User not found.');
    if (!u.active) throw new ApiError(403, 'Account is deactivated.');

    const roleRows = await tx.select({ r: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, u.id));
    const ids = roleRows.map(r => r.r);
    const hasSeller = ids.includes(ROLE_ID.seller);
    const isStaff = hasSeller || ids.includes(ROLE_ID.admin) || roleFor(u.email) === 'admin';

    const [existing] = await tx.select({ onboardedAt: sellerProfiles.onboardedAt }).from(sellerProfiles).where(eq(sellerProfiles.userId, u.id));
    if (isStaff && existing?.onboardedAt) return { status: 'unchanged', userId: u.id };

    const category = await canonicalCategory(tx, v.category);
    const cityId = await resolveCityInput(tx, v);

    const status: OnboardingResult['status'] = isStaff ? 'completed' : 'created';
    if (!isStaff) await grantRole(tx, u.id, 'seller', u.id);

    await tx.update(users).set({ name: v.fullName, phone: v.mobile, updatedAt: new Date() }).where(eq(users.id, u.id));
    await ensureSellerProfile(tx, u.id, v.brandName);
    await tx.update(sellerProfiles).set({
      displayName: v.brandName, bio: v.description, category, cityId,
      instagram: v.instagram ?? null, website: v.website ?? null, logoUrl: v.logoUrl,
      whatsapp: v.whatsapp ?? null,
      contactMethods: v.contactMethods,
      ...(v.contactMethods.includes('phone') ? { publicPhone: v.mobile } : {}),
      onboardedAt: new Date(),
    }).where(eq(sellerProfiles.userId, u.id));
    return { status, userId: u.id };
  });
}
