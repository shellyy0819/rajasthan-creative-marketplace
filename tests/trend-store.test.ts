import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { isNotNull } from 'drizzle-orm';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { trendDigests } from '@/db/schema';
import type { TrendItem } from '@/lib/trend-types';
import {
  addItem, createDigest, getDigest, getPublishedDigest, listDigests, patchItem, publishDigest, unpublishDigest,
} from '@/lib/trend-store';

const item = (id: string, over: Partial<TrendItem> = {}): TrendItem => ({
  id, kind: 'craft', title: `Item ${id}`, why: 'Buyers keep asking for this lately.', category: 'Pottery', tags: ['clay'],
  origin: 'web', sources: [{ title: 'Design weekly', url: 'https://example.com/a' }], show: true, ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  kind: 'art', title: 'Miniature painting', why: 'Small framed pieces are selling well.', category: 'Painting', tags: ['miniature'],
  sources: [{ title: 'Art notes' }], ...over,
});
const make = (items: TrendItem[] = [item('a')], over: Partial<Parameters<typeof createDigest>[0]> = {}) =>
  createDigest({ createdBy: 'admin-1', model: 'test-model', status: 'ok', items, ...over });
const status = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return (e as { status?: number }).status ?? 'other'; }
  return 'none';
};
const publishedRows = async () => (await (await getTestDb()).select().from(trendDigests).where(isNotNull(trendDigests.publishedAt)));

beforeAll(async () => { await getTestDb(); }, 30_000);
beforeEach(async () => { await resetTestDb(); }, 30_000);

describe('createDigest and getDigest', () => {
  it('round-trips the items', async () => {
    const d = await make([item('a'), item('b', { show: false, kind: 'workshop' })]);
    expect(d).toMatchObject({ createdBy: 'admin-1', model: 'test-model', status: 'ok', error: null, publishedAt: null, publishedBy: null });
    expect(await getDigest(d.id)).toEqual(d);
    expect((await getDigest(d.id))!.items.map(i => i.id)).toEqual(['a', 'b']);
  });
  it('keeps the error of a failed run', async () => {
    const d = await make([], { status: 'failed', error: 'Research failed.' });
    expect(await getDigest(d.id)).toMatchObject({ status: 'failed', error: 'Research failed.', items: [] });
  });
  it('returns null for an unknown id and for a malformed id', async () => {
    expect(await getDigest('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await getDigest('not-a-uuid')).toBeNull();
    expect(await getDigest("'; drop table trend_digests; --")).toBeNull();
  });
});

describe('listDigests', () => {
  it('lists newest first with the item and shown counts and no items', async () => {
    const first = await make([item('a'), item('b', { show: false })]);
    await new Promise(r => setTimeout(r, 5));
    const second = await make([item('c')]);
    const rows = await listDigests();
    expect(rows.map(r => r.id)).toEqual([second.id, first.id]);
    expect(rows[1]).toMatchObject({ itemCount: 2, shownCount: 1 });
    expect(rows[0]).toMatchObject({ itemCount: 1, shownCount: 1 });
    expect(rows[0]).not.toHaveProperty('items');
  });
});

describe('patchItem', () => {
  it('toggles show and changes kind and text', async () => {
    const d = await make([item('a'), item('b')]);
    const shown = await patchItem(d.id, 'a', { show: false });
    expect(shown.items.find(i => i.id === 'a')!.show).toBe(false);
    expect(shown.items.find(i => i.id === 'b')!.show).toBe(true);
    const kind = await patchItem(d.id, 'a', { kind: 'workshop', title: 'Clay wheel class' });
    expect(kind.items.find(i => i.id === 'a')).toMatchObject({ kind: 'workshop', title: 'Clay wheel class', show: false, origin: 'web' });
    expect((await getDigest(d.id))!.items.find(i => i.id === 'a')).toMatchObject({ kind: 'workshop', title: 'Clay wheel class' });
  });
  it('rejects an invalid change with 400 and leaves the item alone', async () => {
    const d = await make();
    expect(await status(patchItem(d.id, 'a', { title: 'x' }))).toBe(400);
    expect(await status(patchItem(d.id, 'a', { kind: 'bogus' as never }))).toBe(400);
    expect(await status(patchItem(d.id, 'a', { show: 'yes' as never }))).toBe(400);
    expect((await getDigest(d.id))!.items[0]).toEqual(item('a'));
  });
  it('is 404 for an unknown item and an unknown digest', async () => {
    const d = await make();
    expect(await status(patchItem(d.id, 'zzz', { show: false }))).toBe(404);
    expect(await status(patchItem('00000000-0000-4000-8000-000000000000', 'a', { show: false }))).toBe(404);
    expect(await status(patchItem('not-a-uuid', 'a', { show: false }))).toBe(404);
  });
  it('is 409 on a published digest', async () => {
    const d = await make();
    await publishDigest(d.id, 'boss@example.com');
    await expect(patchItem(d.id, 'a', { show: false })).rejects.toMatchObject({ status: 409, message: 'Unpublish it first.' });
  });
  it('does not lose either change when two edits run together', async () => {
    const d = await make([item('a'), item('b')]);
    await Promise.all([patchItem(d.id, 'a', { show: false }), patchItem(d.id, 'b', { title: 'Renamed piece' })]);
    const after = await getDigest(d.id);
    expect(after!.items.find(i => i.id === 'a')!.show).toBe(false);
    expect(after!.items.find(i => i.id === 'b')!.title).toBe('Renamed piece');
  });
});

describe('addItem', () => {
  it('appends a hidden item with the given origin and a new id', async () => {
    const d = await make();
    const after = await addItem(d.id, input(), 'manual');
    expect(after.items).toHaveLength(2);
    const added = after.items[1];
    expect(added).toMatchObject({ kind: 'art', title: 'Miniature painting', origin: 'manual', show: false, tags: ['miniature'] });
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(added.id).not.toBe('a');
    expect((await addItem(d.id, input(), 'pinterest')).items[2].origin).toBe('pinterest');
  });
  it('rejects invalid input with 400', async () => {
    const d = await make();
    expect(await status(addItem(d.id, { ...input(), title: '' }, 'manual'))).toBe(400);
    expect(await status(addItem(d.id, 'nope', 'manual'))).toBe(400);
    expect(await status(addItem(d.id, input({ sources: [] }), 'manual'))).toBe(400);
    expect((await getDigest(d.id))!.items).toHaveLength(1);
  });
  it('is 404 for an unknown digest and 409 on a published one', async () => {
    expect(await status(addItem('00000000-0000-4000-8000-000000000000', input(), 'manual'))).toBe(404);
    const d = await make();
    await publishDigest(d.id, 'boss@example.com');
    await expect(addItem(d.id, input(), 'manual')).rejects.toMatchObject({ status: 409, message: 'Unpublish it first.' });
  });
  it('does not lose either item when two adds run together', async () => {
    const d = await make();
    await Promise.all([addItem(d.id, input({ title: 'First addition' }), 'manual'), addItem(d.id, input({ title: 'Second addition' }), 'manual')]);
    const titles = (await getDigest(d.id))!.items.map(i => i.title);
    expect(titles).toContain('First addition');
    expect(titles).toContain('Second addition');
    expect(titles).toHaveLength(3);
  });
});

describe('publishDigest', () => {
  it('publishes and records who did it', async () => {
    const d = await make();
    const p = await publishDigest(d.id, 'boss@example.com');
    expect(p.publishedAt).toBeInstanceOf(Date);
    expect(p.publishedBy).toBe('boss@example.com');
    expect(await publishedRows()).toHaveLength(1);
    expect((await getPublishedDigest())!.id).toBe(d.id);
  });
  it('needs a shown item and a status of ok', async () => {
    const hidden = await make([item('a', { show: false })]);
    expect(await status(publishDigest(hidden.id, 'boss@example.com'))).toBe(400);
    const empty = await make([], { status: 'empty' });
    expect(await status(publishDigest(empty.id, 'boss@example.com'))).toBe(400);
    const failed = await make([item('a')], { status: 'failed', error: 'boom' });
    expect(await status(publishDigest(failed.id, 'boss@example.com'))).toBe(400);
    expect(await publishedRows()).toHaveLength(0);
  });
  it('is 404 for an unknown or malformed id', async () => {
    expect(await status(publishDigest('00000000-0000-4000-8000-000000000000', 'x@example.com'))).toBe(404);
    expect(await status(publishDigest('not-a-uuid', 'x@example.com'))).toBe(404);
  });
  it('publishing B while A is published leaves exactly one published row, B', async () => {
    const a = await make([item('a')]);
    const b = await make([item('b')]);
    await publishDigest(a.id, 'first@example.com');
    expect((await publishedRows()).map(r => r.id)).toEqual([a.id]);
    await publishDigest(b.id, 'second@example.com');
    const rows = await publishedRows();
    expect(rows.map(r => r.id)).toEqual([b.id]);
    expect(rows[0].publishedBy).toBe('second@example.com');
    const oldA = await getDigest(a.id);
    expect(oldA).toMatchObject({ publishedAt: null, publishedBy: null });
    expect((await getPublishedDigest())!.id).toBe(b.id);
  });
  it('lets a new digest be published after the old one is unpublished', async () => {
    const a = await make([item('a')]);
    const b = await make([item('b')]);
    await publishDigest(a.id, 'first@example.com');
    expect(await publishedRows()).toHaveLength(1);
    await unpublishDigest(a.id);
    expect(await publishedRows()).toHaveLength(0);
    await publishDigest(b.id, 'second@example.com');
    expect((await publishedRows()).map(r => r.id)).toEqual([b.id]);
  });
  it('publishing the published digest again keeps one row', async () => {
    const a = await make();
    await publishDigest(a.id, 'first@example.com');
    await publishDigest(a.id, 'first@example.com');
    expect((await publishedRows()).map(r => r.id)).toEqual([a.id]);
  });
  it('leaves exactly one published row when two digests are published together', async () => {
    const a = await make([item('a')]);
    const b = await make([item('b')]);
    const results = await Promise.allSettled([publishDigest(a.id, 'one@example.com'), publishDigest(b.id, 'two@example.com')]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(await publishedRows()).toHaveLength(1);
  });
});

describe('unpublishDigest and getPublishedDigest', () => {
  it('leaves none published', async () => {
    const d = await make();
    await publishDigest(d.id, 'boss@example.com');
    const u = await unpublishDigest(d.id);
    expect(u).toMatchObject({ id: d.id, publishedAt: null, publishedBy: null });
    expect(await publishedRows()).toHaveLength(0);
    expect(await getPublishedDigest()).toBeNull();
  });
  it('is fine on a digest that is not published, and 404 on an unknown one', async () => {
    const d = await make();
    expect((await unpublishDigest(d.id)).publishedAt).toBeNull();
    expect(await status(unpublishDigest('00000000-0000-4000-8000-000000000000'))).toBe(404);
    expect(await status(unpublishDigest('not-a-uuid'))).toBe(404);
  });
  it('lets a digest be edited again once unpublished', async () => {
    const d = await make();
    await publishDigest(d.id, 'boss@example.com');
    await unpublishDigest(d.id);
    expect((await patchItem(d.id, 'a', { show: false })).items[0].show).toBe(false);
  });
  it('has no published digest to start with', async () => {
    expect(await getPublishedDigest()).toBeNull();
  });
});
