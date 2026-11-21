import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { POST as eventsRoute } from '@/app/api/events/route';
import { workshopEvents, workshops } from '@/db/schema';
import { createWorkshop } from '@/lib/admin';
import { recordEvent, recordWorkshopEvent } from '@/lib/engagement';
import { createBooking } from '@/lib/orders';
import { qualifies } from '@/lib/trending';
import { HOME_WORKSHOPS, scoreWorkshopSignals, trendingWorkshops, trendingWorkshopsBreakdown, workshopQualifies, type WorkshopSignals } from '@/lib/trending-workshops';
import { cityRef } from './helpers/cities';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });

/** Invented listings, dated far ahead so they have not ended. */
const base = { type: 'FREE', cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 20, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'APPROVED' };
const make = (title: string, over: Record<string, unknown> = {}) => createWorkshop({ ...base, title, ...over });
const view = (workshopId: string, actor: string) => recordWorkshopEvent({ workshopId, type: 'view', actor });
const contact = (workshopId: string, actor: string) => recordWorkshopEvent({ workshopId, type: 'contact', actor });
const reserve = (workshopId: string, email = 'v@x.co') => createBooking({ workshopId, attendeeName: 'V', email, quantity: 1 }, email);
const ids = async (limit?: number) => (await trendingWorkshops({ limit })).map(w => w.id);

describe('recordWorkshopEvent', () => {
  it('counts a visitor once per type and day, and a published workshop only', async () => {
    const w = await make('Lac Craft');
    expect(await view(w.id, 'h:a')).toBe('recorded');
    expect(await view(w.id, 'h:a')).toBe('duplicate');
    expect(await view(w.id, 'h:b')).toBe('recorded');
    expect(await contact(w.id, 'h:a')).toBe('recorded'); // another type for the same visitor
    expect((await (await getTestDb()).select().from(workshopEvents)).length).toBe(3);
    const draft = await make('Draft one', { status: 'DRAFT' });
    expect(await view(draft.id, 'h:a')).toBe('ignored');
    expect(await view('w999', 'h:a')).toBe('ignored');
  });
  it('a later day counts again, and deleting the workshop removes its events', async () => {
    const w = await make('Lac Craft');
    await recordWorkshopEvent({ workshopId: w.id, type: 'view', actor: 'h:a' }, new Date('2026-10-20T10:00:00Z'));
    expect(await recordWorkshopEvent({ workshopId: w.id, type: 'view', actor: 'h:a' }, new Date('2026-10-21T10:00:00Z'))).toBe('recorded');
    const d = await getTestDb();
    await d.delete(workshops).where(eq(workshops.id, w.id));
    expect(await d.select().from(workshopEvents)).toEqual([]);
  });
  it('every contact way is a valid type, and anything else is refused by the database', async () => {
    const w = await make('Lac Craft');
    for (const type of ['contact_whatsapp', 'contact_call', 'contact_instagram', 'contact_website'] as const) expect(await recordWorkshopEvent({ workshopId: w.id, type, actor: 'h:a' })).toBe('recorded');
    await expect((await getTestDb()).insert(workshopEvents).values({ workshopId: w.id, type: 'like', actor: 'h:a', day: '2026-10-20' })).rejects.toThrow();
  });
});

describe('the score', () => {
  const sig = (id: string, o: Partial<WorkshopSignals> = {}): WorkshopSignals => ({ workshopId: id, hostKey: id, views: 0, contact: 0, reservations: 0, ...o });
  it('qualifies like products do, with reservations in place of likes', () => {
    expect(workshopQualifies(sig('w1', { views: 2 }))).toBe(false);
    expect(workshopQualifies(sig('w1', { views: 3 }))).toBe(true);
    expect(workshopQualifies(sig('w1', { contact: 1 }))).toBe(true);
    expect(workshopQualifies(sig('w1', { reservations: 1 }))).toBe(true);
    expect(qualifies({ views: 0, contact: 0, likes: 0 })).toBe(false); // the products rule is unchanged
  });
  it('weights views 0.4, contacts 0.3 and reservations 0.3 against the best of each, and breaks ties on reservations then the newer listing', () => {
    const out = scoreWorkshopSignals([sig('w1', { views: 10 }), sig('w2', { views: 5, contact: 4, reservations: 2 }), sig('w3', { reservations: 2 }), sig('w4', { views: 1 })]);
    expect(out.map(r => r.workshopId)).toEqual(['w2', 'w1', 'w3']); // w4 does not qualify
    expect(out[0].score).toBeCloseTo(0.4 * 0.5 + 0.3 * 1 + 0.3 * 1, 5);
    expect(scoreWorkshopSignals([sig('w5', { contact: 1 }), sig('w9', { contact: 1 })]).map(r => r.workshopId)).toEqual(['w9', 'w5']);
  });
});

describe('trendingWorkshops()', () => {
  it('is empty when nothing has any activity', async () => {
    await make('Lac Craft');
    expect(await ids()).toEqual([]);
  });
  it('ranks by views, contact clicks and reservations, and returns the public listing without private fields', async () => {
    const a = await make('Lac Craft', { host: 'Host A', contactEmail: 'private-a@x.co', contactPhone: '9000000001' });
    const b = await make('Block Print', { host: 'Host B' });
    for (const n of ['1', '2', '3']) await view(a.id, `h:${n}`);
    await contact(b.id, 'h:1'); await reserve(b.id);
    const out = await trendingWorkshops();
    expect(out.map(w => w.id)).toEqual([b.id, a.id]);
    expect(out[1]).toMatchObject({ title: 'Lac Craft' });
    expect(JSON.stringify(out)).not.toMatch(/private-a@x\.co|9000000001/);
  });
  it('a reservation alone qualifies, and only counts for the last seven days', async () => {
    const w = await make('Lac Craft');
    await reserve(w.id);
    expect(await ids()).toEqual([w.id]);
    expect(await ids()).toEqual([w.id]);
    const later = new Date(Date.now() + 8 * 86_400_000);
    expect((await trendingWorkshops({ now: later })).map(x => x.id)).toEqual([]); // eight days on, that booking is outside the window
  });
  it('leaves out drafts, archived and ended workshops, and a one-day event once its day has passed', async () => {
    const live = await make('Live one');
    const draft = await make('Draft', { status: 'DRAFT' });
    const ended = await make('Ended', { date: '2099-12-01' });
    await contact(live.id, 'h:1'); await contact(ended.id, 'h:1');
    const d = await getTestDb();
    await d.insert(workshopEvents).values({ workshopId: draft.id, type: 'contact', actor: 'h:1', day: new Date().toISOString().slice(0, 10) });
    await d.update(workshops).set({ startsAt: new Date('2020-01-02T10:00:00Z'), endsOn: null }).where(eq(workshops.id, ended.id));
    expect(await ids()).toEqual([live.id]);
  });
  it('shows one workshop per host, the best one, and respects the limit', async () => {
    const seller = await makeSeller('host@x.co', 'Host');
    const a1 = await make('A first', { hostId: seller.id, host: 'Host' });
    const a2 = await make('A second', { hostId: seller.id, host: 'Host' });
    const b = await make('B', { host: 'Other' });
    const c = await make('C', { host: 'Third' });
    await contact(a1.id, 'h:1'); await contact(a2.id, 'h:1'); await contact(a2.id, 'h:2');
    await contact(b.id, 'h:1'); await contact(c.id, 'h:1');
    const out = await ids();
    expect(out).toContain(a2.id);
    expect(out).not.toContain(a1.id);
    expect(out).toHaveLength(3);
    expect(await ids(2)).toHaveLength(2);
    expect(await ids(999)).toHaveLength(3);
    expect(HOME_WORKSHOPS).toBe(3);
  });
  it('an online class with no end date can trend', async () => {
    const cls = await createWorkshop({ title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2026-01-05', host: 'Asha', description: 'Gentle yoga.', status: 'APPROVED', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } });
    await contact(cls.id, 'h:1');
    expect(await ids()).toEqual([cls.id]);
  });
});

describe('the admin breakdown', () => {
  it('lists every live published workshop with its signals, the score parts and why it is or is not shown', async () => {
    const hot = await make('Hot', { host: 'H1' });
    const quiet = await make('Quiet', { host: 'H2' });
    await make('Draft', { status: 'DRAFT', host: 'H3' });
    await contact(hot.id, 'h:1'); await view(hot.id, 'h:1'); await reserve(hot.id);
    await view(quiet.id, 'h:1');
    const b = await trendingWorkshopsBreakdown();
    expect(b.rows.map(r => r.title)).not.toContain('Draft'); // the draft is not listed; the fixture's own published workshops are, with no activity
    expect(b.rows[0]).toMatchObject({ workshopId: hot.id, title: 'Hot', views: 1, contact: 1, reservations: 1, rank: 1, status: 'shown' });
    expect(b.rows.find(r => r.workshopId === quiet.id)).toMatchObject({ title: 'Quiet', views: 1, rank: null, status: 'below-threshold', score: 0 });
    expect(b.rows.slice(1).every(r => r.rank === null && r.score === 0)).toBe(true);
    expect(b.max).toEqual({ views: 1, contact: 1, reservations: 1 });
    expect(b.rows[0].parts.views + b.rows[0].parts.contact + b.rows[0].parts.reservations).toBeCloseTo(1, 5);
    expect(b).toMatchObject({ windowDays: 7, minViews: 3, homeLimit: 3, pageLimit: 12 });
  });
});

describe('POST /api/events for workshops', () => {
  const post = (body: unknown, ua = 'Mozilla/5.0 (Macintosh) Safari') => eventsRoute(new Request('http://x/api/events', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'user-agent': ua, 'x-forwarded-for': '203.0.113.7' } }));
  it('records a workshop view and contact (204), counting a repeat once', async () => {
    const w = await make('Lac Craft');
    expect((await post({ type: 'view', workshopId: w.id })).status).toBe(204);
    expect((await post({ type: 'view', workshopId: w.id })).status).toBe(204);
    expect((await post({ type: 'contact_whatsapp', workshopId: w.id })).status).toBe(204);
    expect((await (await getTestDb()).select().from(workshopEvents)).map(r => r.type).sort()).toEqual(['contact_whatsapp', 'view']);
  });
  it('refuses a bad id, a bad type, a product-only type, and both ids at once', async () => {
    const w = await make('Lac Craft');
    expect((await post({ type: 'view', workshopId: 'p1' })).status).toBe(400);
    expect((await post({ type: 'view', workshopId: 'w1; drop' })).status).toBe(400);
    expect((await post({ type: 'artist', workshopId: w.id })).status).toBe(400);
    expect((await post({ type: 'view', workshopId: w.id, productId: 'p1' })).status).toBe(400);
    expect((await (await getTestDb()).select().from(workshopEvents)).length).toBe(0);
  });
  it('ignores bots and unknown workshops quietly, and product events still work as before', async () => {
    const w = await make('Lac Craft');
    expect((await post({ type: 'view', workshopId: w.id }, 'Googlebot/2.1')).status).toBe(204);
    expect((await post({ type: 'view', workshopId: 'w9999' })).status).toBe(204);
    expect((await (await getTestDb()).select().from(workshopEvents)).length).toBe(0);
    expect((await post({ type: 'view', productId: 'p1' })).status).toBe(204);
    expect(await recordEvent({ productId: 'p1', type: 'view', actor: 'h:z' })).toBe('recorded');
  });
});
