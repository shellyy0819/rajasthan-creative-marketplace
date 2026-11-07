import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { completeOnboarding } from '@/lib/onboarding';
import * as people from '@/db/people';
import { resolveRole } from '@/lib/roles';
import { sellerProfiles, userRoles, users } from '@/db/schema';
import type { OnboardingInput } from '@/lib/onboarding-validate';
import { getTestDb, giveRole, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const origAdmins = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = ''; await resetTestDb(); });
afterEach(() => { process.env.ADMIN_EMAILS = origAdmins; });

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  fullName: 'Asha Verma', mobile: '9876543210', brandName: 'Asha Crafts', category: 'Pottery',
  description: 'Hand-thrown blue pottery.', cityRef: cityRef('Jaipur'), instagram: 'asha.crafts',
  logoUrl: 'https://example.com/logo.png', contactMethods: ['phone', 'instagram'], ...over,
});
const byEmail = async (email: string) => (await (await getTestDb()).select().from(users).where(eq(users.email, email)))[0];
const profile = async (id: string) => (await (await getTestDb()).select().from(sellerProfiles).where(eq(sellerProfiles.userId, id)))[0];
const roles = async (id: string) => (await getTestDb()).select().from(userRoles).where(eq(userRoles.userId, id));

describe('completeOnboarding', () => {
  it('new account becomes seller with profile and onboarded_at', async () => {
    const r = await completeOnboarding('new@x.co', input());
    expect(r.status).toBe('created');
    expect(await resolveRole('new@x.co')).toBe('seller');
    const p = await profile(r.userId);
    expect(p.onboardedAt).toBeInstanceOf(Date);
    expect(p).toMatchObject({ category: 'Pottery', logoUrl: 'https://example.com/logo.png', instagram: 'asha.crafts', bio: 'Hand-thrown blue pottery.', contactMethods: ['instagram', 'phone'], publicPhone: '9876543210' });
    expect(p.cityId).not.toBeNull();
  });
  it('users.name and users.phone updated', async () => {
    const r = await completeOnboarding('new@x.co', input());
    expect(await byEmail('new@x.co')).toMatchObject({ id: r.userId, name: 'Asha Verma', phone: '9876543210' });
  });
  it('brand name saved as display_name', async () => {
    const r = await completeOnboarding('new@x.co', input());
    expect((await profile(r.userId)).displayName).toBe('Asha Crafts');
  });
  it('public_phone only set when Phone contact method chosen', async () => {
    const r = await completeOnboarding('n2@x.co', input({ contactMethods: ['instagram'] }));
    expect((await profile(r.userId)).publicPhone).toBeNull();
  });
  it('existing seller with null onboarded_at gets completed, role untouched', async () => {
    const s = await makeSeller('old@x.co', 'Old Name');
    const before = await roles(s.id);
    const r = await completeOnboarding('old@x.co', input());
    expect(r).toEqual({ status: 'completed', userId: s.id });
    expect(await roles(s.id)).toEqual(before);
    expect((await profile(s.id)).onboardedAt).not.toBeNull();
  });
  it('existing admin completes without gaining a seller role; env admin too', async () => {
    const a = await giveRole('adm@x.co', 'admin');
    expect((await completeOnboarding('adm@x.co', input())).status).toBe('completed');
    expect((await roles(a.id)).map(r => r.roleId)).toEqual([2]);
    process.env.ADMIN_EMAILS = 'env@x.co';
    const e = await completeOnboarding('env@x.co', input());
    expect(e.status).toBe('completed');
    expect(await roles(e.userId)).toHaveLength(0);
  });
  it('already onboarded returns unchanged and writes nothing', async () => {
    const first = await completeOnboarding('new@x.co', input());
    const before = await profile(first.userId);
    const r = await completeOnboarding('new@x.co', input({ brandName: 'Changed', fullName: 'Other' }));
    expect(r).toEqual({ status: 'unchanged', userId: first.userId });
    expect(await profile(first.userId)).toEqual(before);
    expect((await byEmail('new@x.co')).name).toBe('Asha Verma');
  });
  it('deactivated user refused and gets no role', async () => {
    const u = await giveRole('off@x.co', 'customer');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, u.id));
    await expect(completeOnboarding('off@x.co', input())).rejects.toMatchObject({ status: 403 });
    expect(await roles(u.id)).toHaveLength(0);
    expect(await profile(u.id)).toBeUndefined();
  });
  it('invalid category rejected, no role', async () => {
    await expect(completeOnboarding('c@x.co', input({ category: 'Nonexistent' }))).rejects.toMatchObject({ status: 400 });
    expect(await resolveRole('c@x.co')).toBe('customer');
  });
  it('rejects a non-http logo and invalid input, no role', async () => {
    await expect(completeOnboarding('l@x.co', input({ logoUrl: 'javascript:alert(1)' }))).rejects.toMatchObject({ status: 400 });
    await expect(completeOnboarding('l@x.co', input({ mobile: '123' }))).rejects.toMatchObject({ status: 400 });
    expect(await resolveRole('l@x.co')).toBe('customer');
  });
  it('after two concurrent calls the end state is one role row and one profile (primary keys; the lock itself is tested in pg-concurrency)', async () => {
    const rs = await Promise.all([completeOnboarding('race@x.co', input()), completeOnboarding('race@x.co', input())]);
    expect(rs.map(r => r.status).sort()).toEqual(['created', 'unchanged']);
    const u = await byEmail('race@x.co');
    expect(await roles(u.id)).toHaveLength(1);
    expect(await (await getTestDb()).select().from(sellerProfiles).where(eq(sellerProfiles.userId, u.id))).toHaveLength(1);
  });
  it('missing city is rejected, no role', async () => {
    await expect(completeOnboarding('nc@x.co', input({ cityRef: undefined }))).rejects.toMatchObject({ status: 400, message: 'Pick your city from the list.' });
    expect(await resolveRole('nc@x.co')).toBe('customer');
  });
  it('a profile write that fails after the role grant rolls the role back', async () => {
    const spy = vi.spyOn(people, 'ensureSellerProfile').mockRejectedValueOnce(new Error('profile write failed'));
    try {
      await expect(completeOnboarding('bad@x.co', input())).rejects.toThrow('profile write failed');
    } finally { spy.mockRestore(); }
    const u = await byEmail('bad@x.co');
    expect(u ? await roles(u.id) : []).toHaveLength(0);
    expect(await resolveRole('bad@x.co')).toBe('customer');
  });
  it('invalid cityRef is rejected, no role', async () => {
    await expect(completeOnboarding('bad2@x.co', input({ cityRef: 'garbage' }))).rejects.toBeDefined();
    expect(await resolveRole('bad2@x.co')).toBe('customer');
  });
});
