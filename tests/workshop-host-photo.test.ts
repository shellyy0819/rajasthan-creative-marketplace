import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { sellerProfiles } from '@/db/schema';
import { createWorkshop } from '@/lib/admin';
import { getWorkshopHostPhoto } from '@/lib/workshop-host';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

const cls = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } };
const setLogo = async (id: string, url: string | null) => (await getTestDb()).update(sellerProfiles).set({ logoUrl: url }).where(eq(sellerProfiles.userId, id));

describe('the instructor photo on a class page', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('is the profile photo of the seller account linked to the class', async () => {
    const s = await makeSeller('swati@x.co', 'Swati');
    await setLogo(s.id, 'https://img.test/swati.jpg');
    const w = await createWorkshop({ ...cls, hostId: s.id });
    expect(await getWorkshopHostPhoto(w.id)).toBe('https://img.test/swati.jpg');
  });
  it('is found through the account email the class was made with, whatever its letter case', async () => {
    const s = await makeSeller('swati@x.co', 'Swati');
    await setLogo(s.id, 'https://img.test/swati.jpg');
    const w = await createWorkshop({ ...cls, contactEmail: 'Swati@X.co' });
    expect(await getWorkshopHostPhoto(w.id)).toBe('https://img.test/swati.jpg');
  });
  it('is nothing when no account is linked, the seller has no photo, or the photo is not https', async () => {
    const s = await makeSeller('swati@x.co', 'Swati');
    expect(await getWorkshopHostPhoto((await createWorkshop({ ...cls, host: 'Swati' })).id)).toBeUndefined(); // same name alone does not link
    const w = await createWorkshop({ ...cls, hostId: s.id });
    expect(await getWorkshopHostPhoto(w.id)).toBeUndefined();
    await setLogo(s.id, 'javascript:alert(1)');
    expect(await getWorkshopHostPhoto(w.id)).toBeUndefined();
    expect(await getWorkshopHostPhoto('w-none')).toBeUndefined();
  });
});
