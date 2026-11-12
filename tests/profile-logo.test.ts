import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { addMissingLogo, getProfileByEmail, saveProfile } from '@/lib/users';
import { sellerProfiles } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

const KEYS = ['S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL', 'S3_KEY_PREFIX'] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(async () => { await resetTestDb(); for (const k of KEYS) saved[k] = process.env[k]; });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

const LOGO = 'https://cdn.example.com/logos/me.png';
async function lockedSeller(email: string, logo?: string) {
  const s = await makeSeller(email, 'S');
  await saveProfile(s.id, { displayName: 'S', ...(logo ? { logoUrl: logo } : {}) });
  await (await getTestDb()).update(sellerProfiles).set({ onboardedAt: new Date() }).where(eq(sellerProfiles.userId, s.id));
  return s;
}

describe('addMissingLogo', () => {
  it('adds a logo to a locked profile that has none, leaving every other field alone', async () => {
    const s = await lockedSeller('a@x.co');
    const before = await getProfileByEmail('a@x.co');
    const after = await addMissingLogo(s.id, { logoUrl: LOGO });
    expect(after.logoUrl).toBe(LOGO);
    expect({ ...after, logoUrl: undefined }).toEqual({ ...before, logoUrl: undefined });
  });
  it('refuses to replace a logo that is already stored (403)', async () => {
    const s = await lockedSeller('b@x.co', LOGO);
    await expect(addMissingLogo(s.id, { logoUrl: 'https://cdn.example.com/logos/new.png' })).rejects.toMatchObject({ status: 403 });
    expect((await getProfileByEmail('b@x.co')).logoUrl).toBe(LOGO);
  });
  it('rejects missing, blank and non-http logos (400, field logoUrl)', async () => {
    const s = await lockedSeller('c@x.co');
    for (const logoUrl of [undefined, '', '   ', 'javascript:alert(1)', 5]) await expect(addMissingLogo(s.id, { logoUrl })).rejects.toMatchObject({ status: 400, field: 'logoUrl' });
    expect((await getProfileByEmail('c@x.co')).logoUrl).toBeUndefined();
  });
  it('with uploads configured the logo must sit in the seller own logos/ folder', async () => {
    const s = await lockedSeller('d@x.co');
    const other = await lockedSeller('e@x.co');
    Object.assign(process.env, { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' });
    delete process.env.S3_PUBLIC_BASE_URL; delete process.env.S3_KEY_PREFIX;
    await expect(addMissingLogo(s.id, { logoUrl: `https://b.s3.ap-south-1.amazonaws.com/logos/${other.id}/a.png` })).rejects.toMatchObject({ status: 400, field: 'logoUrl' });
    await expect(addMissingLogo(s.id, { logoUrl: 'https://evil.example.com/a.png' })).rejects.toMatchObject({ status: 400 });
    const own = `https://b.s3.ap-south-1.amazonaws.com/logos/${s.id}/a.png`;
    expect((await addMissingLogo(s.id, { logoUrl: own })).logoUrl).toBe(own);
  });
});
