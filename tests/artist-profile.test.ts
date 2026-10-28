import { describe, it, expect, beforeEach } from 'vitest';
import { getProfileByEmail, saveProfile } from '@/lib/users';
import { getArtist } from '@/lib/artists';
import { listProducts } from '@/lib/catalog';
import { createProduct } from '@/lib/admin';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

beforeEach(async () => { await resetTestDb(); });
const mk = async (email = 'bio@x.co') => {
  const s = await makeSeller(email, 'Bio Studio');
  const p = await createProduct({ name: 'Bowl', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
  return { s, p };
};

describe('artist bio and city', () => {
  it('saveProfile stores and trims bio and city, and an empty value clears them', async () => {
    const { s } = await mk();
    const saved = await saveProfile(s.id, { displayName: 'Bio Studio', bio: '  Third-generation potter.\nBlue pottery from Jaipur.  ', cityRef: cityRef('Jaipur') });
    expect(saved).toMatchObject({ bio: 'Third-generation potter.\nBlue pottery from Jaipur.', city: 'Jaipur' });
    expect(await getProfileByEmail('bio@x.co')).toMatchObject({ bio: 'Third-generation potter.\nBlue pottery from Jaipur.', city: 'Jaipur' });
    const cleared = await saveProfile(s.id, { displayName: 'Bio Studio', bio: '  ' });
    expect(cleared).not.toHaveProperty('bio');
    expect(cleared).not.toHaveProperty('city');
  });
  it('saveProfile with a cityRef sets the artist city (creating a new city), with neither it clears it, and cityId of an existing city works', async () => {
    const { s } = await mk();
    const kota = await saveProfile(s.id, { displayName: 'Bio Studio', cityRef: cityRef('Kota') });
    expect(kota).toMatchObject({ city: 'Kota', cityId: expect.any(Number) });
    const again = await saveProfile(s.id, { displayName: 'Bio Studio', cityId: kota.cityId });
    expect(again).toMatchObject({ city: 'Kota', cityId: kota.cityId });
    expect(await saveProfile(s.id, { displayName: 'Bio Studio' })).not.toHaveProperty('city');
  });
  it('saveProfile rejects a tampered cityRef, an unknown cityId and a free-text city', async () => {
    const { s } = await mk();
    for (const bad of [{ cityRef: cityRef('Kota') + 'x' }, { cityId: 99999 }, { city: 'Jaipur' }])
      await expect(saveProfile(s.id, { displayName: 'Bio Studio', ...bad })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects a bio over 500 characters, and non-text values', async () => {
    const { s } = await mk();
    for (const bad of [{ bio: 'x'.repeat(501) }, { bio: 5 }])
      await expect(saveProfile(s.id, { displayName: 'Bio Studio', ...bad })).rejects.toMatchObject({ status: 400 });
    await expect(saveProfile(s.id, { displayName: 'Bio Studio', bio: 'x'.repeat(500) })).resolves.toBeDefined();
  });
  it('saving a profile without bio/city keys leaves nothing behind (an old client that does not send them clears them)', async () => {
    const { s } = await mk();
    await saveProfile(s.id, { displayName: 'Bio Studio', bio: 'Hello', cityRef: cityRef('Udaipur') });
    const next = await saveProfile(s.id, { displayName: 'Bio Studio' });
    expect(next).not.toHaveProperty('bio');
  });
  it('public products carry artistBio and artistCity only when set, never null', async () => {
    const { s, p } = await mk();
    const before = (await listProducts()).find(x => x.id === p.id)!;
    expect(before).not.toHaveProperty('artistBio'); expect(before).not.toHaveProperty('artistCity');
    await saveProfile(s.id, { displayName: 'Bio Studio', bio: 'Potter.', cityRef: cityRef('Jaipur') });
    const after = (await listProducts()).find(x => x.id === p.id)!;
    expect(after).toMatchObject({ artistBio: 'Potter.', artistCity: 'Jaipur' });
    expect(JSON.stringify(after)).not.toContain('bio@x.co');
  });
  it('the artist page data includes bio and city', async () => {
    const { s, p } = await mk();
    await saveProfile(s.id, { displayName: 'Bio Studio', bio: 'Potter.', cityRef: cityRef('Jaipur') });
    const slug = (await listProducts()).find(x => x.id === p.id)!.sellerSlug!;
    expect(await getArtist(slug)).toMatchObject({ bio: 'Potter.', city: 'Jaipur' });
  });
});
