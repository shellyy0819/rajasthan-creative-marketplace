import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET } from '@/app/api/host-prefill/route';
import { getDb } from '@/db/client';
import { ensureUser } from '@/db/people';
import { sellerProfiles } from '@/db/schema';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); });

describe('GET /api/host-prefill', () => {
  it('is empty for a visitor who is not signed in', async () => {
    const r = await GET();
    expect(await r.json()).toEqual({});
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('gives a signed-in customer only their name and email', async () => {
    authMock.mockResolvedValue({ user: { email: 'c@x.co', name: 'Chitra Rao', role: 'customer' } });
    expect(await (await GET()).json()).toEqual({ name: 'Chitra Rao', email: 'c@x.co' });
  });
  it('adds the public profile of a seller: studio name, phone, WhatsApp, Instagram, website', async () => {
    const u = await ensureUser(getDb(), 'asha@x.co', 'Asha Rao');
    await getDb().insert(sellerProfiles).values({ userId: u.id, displayName: 'Asha Yoga', publicPhone: '+919989898999', whatsapp: '+919989898999', instagram: '@asha.yoga', website: 'https://asha.yoga' });
    authMock.mockResolvedValue({ user: { email: 'asha@x.co', name: 'Asha Rao', role: 'seller' } });
    expect(await (await GET()).json()).toEqual({ name: 'Asha Rao', email: 'asha@x.co', hostName: 'Asha Yoga', phone: '9989898999', whatsapp: '9989898999', instagram: '@asha.yoga', website: 'https://asha.yoga' });
  });
  it('never returns anything about another person: only the signed-in user\'s own details', async () => {
    authMock.mockResolvedValue({ user: { email: 'x@x.co', name: 'X', role: 'customer' } });
    expect(Object.keys(await (await GET()).json()).sort()).toEqual(['email', 'name']);
  });
});
