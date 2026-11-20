import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET as listRoute, POST as createRoute } from '@/app/api/workshop-topics/route';
import { PATCH as patchRoute } from '@/app/api/workshop-topics/[id]/route';
import { createWorkshop } from '@/lib/admin';
import { getWorkshopBySlug } from '@/lib/catalog';
import { workshopSlug } from '@/lib/catalog-shared';
import { createTopic, listActiveTopics, listTopics, setTopicActive } from '@/lib/topics';
import { workshopTopics } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { getTestDb, resetTestDb } from './helpers/testdb';

const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (method: string, body?: unknown) => new Request('http://x/api/x', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null);
  await resetTestDb();
  const d = await getTestDb();
  await d.delete(workshopTopics).where(inArray(workshopTopics.slug, ['prenatal-yoga', 'yoga-and-wellness', 'prenatal-yoga-2'])); // topics are reference data and survive resetTestDb
});

describe('topics lib', () => {
  it('creates "Prenatal Yoga" with the slug prenatal-yoga', async () => {
    expect(await createTopic({ name: 'Prenatal Yoga' })).toMatchObject({ name: 'Prenatal Yoga', slug: 'prenatal-yoga', active: true, parentId: null });
  });
  it('refuses the same name in another case', async () => {
    await createTopic({ name: 'Prenatal Yoga' });
    await expect(createTopic({ name: 'prenatal yoga' })).rejects.toMatchObject({ status: 409 });
  });
  it('turns & into "and" in the slug and rejects bad names', async () => {
    expect((await createTopic({ name: 'Yoga & Wellness' })).slug).toBe('yoga-and-wellness');
    await expect(createTopic({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(createTopic({ name: '<b>' })).rejects.toMatchObject({ status: 400 });
  });
  it('an inactive topic leaves the form list but a listing keeps showing its topic name', async () => {
    const t = await createTopic({ name: 'Prenatal Yoga' });
    const w = await createWorkshop({ title: 'Calm', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'A', description: 'd', topicId: t.id, status: 'APPROVED', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } });
    await setTopicActive(t.id, false);
    expect((await listActiveTopics()).map(x => x.name)).not.toContain('Prenatal Yoga');
    expect((await listTopics()).find(x => x.id === t.id)).toMatchObject({ active: false, listingCount: 1 });
    expect((await getWorkshopBySlug(workshopSlug(w)))?.topic?.name).toBe('Prenatal Yoga');
  });
  it('listActiveTopics follows the admin order and lists the seeded topics', async () => {
    expect((await listActiveTopics()).map(x => x.name).slice(0, 2)).toEqual(['Yoga', 'Crochet']);
  });
  it('an unknown topic id is a 404', async () => {
    await expect(setTopicActive(99999, false)).rejects.toMatchObject({ status: 404 });
  });
});

describe('topic routes are admin only', () => {
  it('401 anonymous, 403 customer, works for an admin', async () => {
    expect((await listRoute()).status).toBe(401);
    expect((await createRoute(req('POST', { name: 'Prenatal Yoga' }))).status).toBe(401);
    expect((await patchRoute(req('PATCH', { active: false }), ctx(1))).status).toBe(401);
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    expect((await createRoute(req('POST', { name: 'Prenatal Yoga' }))).status).toBe(403);
    asAdmin();
    const r = await createRoute(req('POST', { name: 'Prenatal Yoga' }));
    expect(r.status).toBe(201);
    const t = await r.json();
    expect((await (await patchRoute(req('PATCH', { active: false }), ctx(t.id))).json()).active).toBe(false);
    expect((await (await listRoute()).json()).map((x: { name: string }) => x.name)).toContain('Prenatal Yoga');
  });
});
