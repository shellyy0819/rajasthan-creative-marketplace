import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://x.test' }));

import sitemap from '@/app/sitemap';
import { createWorkshop } from '@/lib/admin';
import { artistSlug } from '@/lib/artist-slug';
import { makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' };

describe('sitemap profiles', () => {
  it('lists a host who has only a published class, once, next to the makers', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati Rao');
    await createWorkshop({ ...online, hostId: swati.id });
    await createWorkshop({ ...online, title: 'Second class', hostId: swati.id });
    const urls = (await sitemap()).map(e => e.url);
    const mine = `https://x.test/artists/${artistSlug('Swati Rao', swati.id)}`;
    expect(urls.filter(u => u === mine)).toHaveLength(1);
  });
  it('does not list a host whose listings are all drafts', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati Rao');
    await createWorkshop({ ...online, hostId: swati.id, status: 'DRAFT' });
    expect((await sitemap()).map(e => e.url)).not.toContain(`https://x.test/artists/${artistSlug('Swati Rao', swati.id)}`);
  });
});
