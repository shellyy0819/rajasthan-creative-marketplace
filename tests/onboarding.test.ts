import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { completeOnboarding } from '@/lib/onboarding';
import { MAX_CATEGORIES, ONBOARDING_CATEGORY_LIMIT, ONBOARDING_LIMIT_MESSAGE, createCategory } from '@/lib/categories';
import * as people from '@/db/people';
import { resolveRole } from '@/lib/roles';
import { categories, sellerProfiles, userRoles, users } from '@/db/schema';
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
  it('a user whose role was removed after onboarding is refused with 403 and gets no role back', async () => {
    const first = await completeOnboarding('rm@x.co', input());
    await (await getTestDb()).delete(userRoles).where(eq(userRoles.userId, first.userId));
    await expect(completeOnboarding('rm@x.co', input())).rejects.toMatchObject({ status: 403, message: 'Your seller access was removed. Please contact Craftofy.' });
    expect(await roles(first.userId)).toHaveLength(0);
    expect(await resolveRole('rm@x.co')).toBe('customer');
  });
  it('a roleless account whose profile has no onboarded_at still onboards', async () => {
    const u = await giveRole('fresh@x.co', 'customer');
    await (await getTestDb()).insert(sellerProfiles).values({ userId: u.id, displayName: 'X' });
    expect((await completeOnboarding('fresh@x.co', input())).status).toBe('created');
    expect(await resolveRole('fresh@x.co')).toBe('seller');
  });
  it('invalid category name and bad city pick fail with a field', async () => {
    await expect(completeOnboarding('f@x.co', input({ category: '<bad>' }))).rejects.toMatchObject({ status: 400, field: 'category' });
    await expect(completeOnboarding('f@x.co', input({ cityRef: 'garbage' }))).rejects.toMatchObject({ status: 400, field: 'cityRef', message: 'Pick your city from the list.' });
    await expect(completeOnboarding('f@x.co', input({ logoUrl: 'ftp://x/y.png' }))).rejects.toMatchObject({ status: 400, field: 'logoUrl' });
    expect(await resolveRole('f@x.co')).toBe('customer');
  });
  it('deactivated user refused and gets no role', async () => {
    const u = await giveRole('off@x.co', 'customer');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, u.id));
    await expect(completeOnboarding('off@x.co', input())).rejects.toMatchObject({ status: 403 });
    expect(await roles(u.id)).toHaveLength(0);
    expect(await profile(u.id)).toBeUndefined();
  });
  it('invalid category rejected, no role', async () => {
    await expect(completeOnboarding('c@x.co', input({ category: '<bad>' }))).rejects.toMatchObject({ status: 400 });
    expect(await resolveRole('c@x.co')).toBe('customer');
  });
  it('an absent or empty logo is stored as null and the maker still becomes a seller', async () => {
    for (const [email, logoUrl] of [['nl1@x.co', undefined], ['nl2@x.co', '']] as const) {
      const r = await completeOnboarding(email, input({ logoUrl }));
      expect(r.status).toBe('created');
      expect((await profile(r.userId)).logoUrl).toBeNull();
      expect(await resolveRole(email)).toBe('seller');
    }
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

  describe('"Other": a new category', () => {
    const cats = async () => (await (await getTestDb()).select().from(categories)).map(c => c.name);
    it('a new name creates exactly one category and the seller role together, stored on the profile', async () => {
      const before = (await cats()).length;
      const r = await completeOnboarding('n@x.co', input({ category: '  Bamboo   Craft ' }));
      const after = await cats();
      expect(after.length).toBe(before + 1);
      expect(after.filter(n => n === 'Bamboo Craft')).toHaveLength(1);
      expect((await profile(r.userId)).category).toBe('Bamboo Craft');
      expect(await resolveRole('n@x.co')).toBe('seller');
      const [row] = (await (await getTestDb()).select().from(categories)).filter(c => c.name === 'Bamboo Craft');
      expect(row.createdBy).toBe(r.userId);
    });
    it('an existing name in another case reuses the stored spelling and adds no row', async () => {
      const before = (await cats()).length;
      const r = await completeOnboarding('n@x.co', input({ category: ' pOTTERY' }));
      expect((await profile(r.userId)).category).toBe('Pottery');
      expect((await cats()).length).toBe(before);
    });
    it('two accounts onboarding with the same new name leave one category row', async () => {
      await Promise.all([completeOnboarding('a@x.co', input({ category: 'Bamboo Craft' })), completeOnboarding('b@x.co', input({ category: 'bamboo craft' }))]);
      expect((await cats()).filter(n => n.toLowerCase() === 'bamboo craft')).toHaveLength(1);
    });
    it('a rule-breaking name fails on category (field) and creates no category or role', async () => {
      const before = (await cats()).length;
      for (const bad of ['x', 'a'.repeat(41), '<b>x</b>', '123', 'tab\there']) {
        await expect(completeOnboarding('n@x.co', input({ category: bad }))).rejects.toMatchObject({ status: 400, field: 'category', message: expect.stringMatching(/2-40 characters/) });
      }
      expect((await cats()).length).toBe(before);
      expect(await resolveRole('n@x.co')).toBe('customer');
    });
    const fill = async (total: number) => {
      const have = (await cats()).length;
      await (await getTestDb()).insert(categories).values(Array.from({ length: total - have }, (_, i) => ({ name: `Filler ${have + i}` })));
    };
    it('onboarding may create the 80th category (79 exist) but not an 81st: headroom is kept for staff', async () => {
      await fill(ONBOARDING_CATEGORY_LIMIT - 1);
      await completeOnboarding('a@x.co', input({ category: 'Brand New' }));
      expect((await cats()).length).toBe(ONBOARDING_CATEGORY_LIMIT);
      await expect(completeOnboarding('b@x.co', input({ category: 'Another New' }))).rejects.toMatchObject({ status: 400, field: 'category', message: ONBOARDING_LIMIT_MESSAGE });
      expect(await cats()).not.toContain('Another New');
      expect(await resolveRole('b@x.co')).toBe('customer');
      // reuse still works at the limit
      expect((await completeOnboarding('c@x.co', input({ category: 'brand new' }))).status).toBe('created');
    });
    it('staff can still create categories up to the full 100 after onboarding stopped at 80', async () => {
      await fill(ONBOARDING_CATEGORY_LIMIT);
      const admin = await giveRole('adm@x.co', 'admin');
      await createCategory({ name: 'Staff One' }, admin.email);
      await fill(MAX_CATEGORIES - 1);
      await expect(createCategory({ name: 'Staff Last' }, admin.email)).resolves.toMatchObject({ created: true });
      await expect(createCategory({ name: 'Staff Over' }, admin.email)).rejects.toMatchObject({ status: 409 });
    });
    it('an existing category whose stored name breaks the rule is reused without error; a new rule-breaking name is still refused', async () => {
      await (await getTestDb()).insert(categories).values({ name: 'X' });
      const r = await completeOnboarding('n@x.co', input({ category: ' x ' }));
      expect((await profile(r.userId)).category).toBe('X');
      expect((await cats()).filter(n => n.toLowerCase() === 'x')).toHaveLength(1);
      await expect(completeOnboarding('m@x.co', input({ category: 'Y' }))).rejects.toMatchObject({ field: 'category', message: expect.stringMatching(/2-40 characters/) });
    });
    it('composed and decomposed spellings of an accented name are one category', async () => {
      const composed = 'Caf\u00e9 Ware', decomposed = 'Cafe\u0301 Ware';
      await completeOnboarding('a@x.co', input({ category: composed }));
      const r = await completeOnboarding('b@x.co', input({ category: decomposed }));
      expect((await profile(r.userId)).category).toBe(composed);
      expect((await cats()).filter(n => n.normalize('NFC') === composed)).toHaveLength(1);
    });
    it('a failed profile save (bad city) rolls the new category back with the role', async () => {
      const before = (await cats()).length;
      await expect(completeOnboarding('n@x.co', input({ category: 'Bamboo Craft', cityRef: 'garbage' }))).rejects.toMatchObject({ field: 'cityRef' });
      expect((await cats()).length).toBe(before);
      expect(await cats()).not.toContain('Bamboo Craft');
      expect(await resolveRole('n@x.co')).toBe('customer');
    });
  });
});
