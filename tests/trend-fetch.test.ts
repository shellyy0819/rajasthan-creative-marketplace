import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { trendDigests } from '@/db/schema';
import { ApiError } from '@/lib/errors';
import type { TrendItem } from '@/lib/trend-types';
import { createDigest, listDigests } from '@/lib/trend-store';

vi.mock('@/lib/trend-research', () => ({ researchTrends: vi.fn() }));
import { researchTrends } from '@/lib/trend-research';
import { MIN_GAP_SECONDS, runTrendFetch } from '@/lib/trend-fetch';

process.env.NEXTAUTH_SECRET = 'test-secret';
const KEY = 'AIzaSyTestKeyForGemini0000001234';
const research = vi.mocked(researchTrends);

const item = (id: string, over: Partial<TrendItem> = {}): TrendItem => ({
  id, kind: 'craft', title: `Item ${id}`, why: 'Buyers keep asking for this lately.', category: 'Pottery', tags: ['clay'],
  origin: 'web', sources: [{ title: 'Design weekly', url: 'https://example.com/a' }], show: false, ...over,
});
const rows = async () => (await getTestDb()).select().from(trendDigests);
const outcome = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as ApiError; }
  return null;
};

beforeAll(async () => { await getTestDb(); }, 30_000);
beforeEach(async () => {
  await resetTestDb();
  process.env.GEMINI_API_KEY = KEY;
  research.mockReset();
}, 30_000);
afterEach(() => { delete process.env.GEMINI_API_KEY; });

describe('runTrendFetch', () => {
  it('asks for the key first and stores nothing without one', async () => {
    delete process.env.GEMINI_API_KEY;
    const err = await outcome(runTrendFetch('admin@x.co'));
    expect(err).toMatchObject({ status: 400, message: 'Add the Gemini key in Settings first.' });
    expect(research).not.toHaveBeenCalled();
    expect(await rows()).toHaveLength(0);
    // the failed attempt did not leave the fetch marked as running
    process.env.GEMINI_API_KEY = KEY;
    research.mockResolvedValue({ items: [item('a')], model: 'm-1' });
    await expect(runTrendFetch('admin@x.co')).resolves.toMatchObject({ status: 'ok' });
  });

  it('stores the result as an unpublished draft with every item hidden', async () => {
    research.mockResolvedValue({ items: [item('a'), item('b')], model: 'model-x' });
    const d = await runTrendFetch('admin@x.co');
    expect(d).toMatchObject({ status: 'ok', error: null, model: 'model-x', createdBy: 'admin@x.co', publishedAt: null, publishedBy: null });
    expect(d.items).toHaveLength(2);
    expect(d.items.every(i => i.show === false)).toBe(true);
    const [row] = await rows();
    expect(row.status).toBe('ok');
    expect(row.publishedAt).toBeNull();
    expect((row.items as TrendItem[]).every(i => i.show === false)).toBe(true);
    expect(research).toHaveBeenCalledTimes(1);
    expect(research.mock.calls[0][0]).toMatchObject({ apiKey: KEY });
  });

  it('stores an empty digest when nothing usable came back', async () => {
    research.mockResolvedValue({ items: [], model: 'model-x' });
    const d = await runTrendFetch('admin@x.co');
    expect(d).toMatchObject({ status: 'empty', error: null, items: [] });
    expect(await rows()).toHaveLength(1);
  });

  it('stores a failed digest with only the error message, then rethrows the same error', async () => {
    const boom = new ApiError(502, 'The research reply could not be read.');
    research.mockRejectedValue(boom);
    const err = await outcome(runTrendFetch('admin@x.co'));
    expect(err).toBe(boom);
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: 'failed', error: 'The research reply could not be read.', createdBy: 'admin@x.co', items: [] });
    expect(JSON.stringify(all[0])).not.toContain(KEY);
  });

  it('stores the plain message when the categories could not be read', async () => {
    const boom = new ApiError(503, 'Could not read the categories. Try again in a minute.');
    research.mockRejectedValue(boom);
    expect(await outcome(runTrendFetch('admin@x.co'))).toBe(boom);
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: 'failed', error: 'Could not read the categories. Try again in a minute.', items: [] });
  });
  it('rethrows the research error when the failed row cannot be stored either', async () => {
    const boom = new ApiError(502, 'The research reply could not be read.');
    research.mockRejectedValue(boom);
    const db = await getTestDb();
    const spy = vi.spyOn(db, 'insert').mockImplementation(() => { throw new Error('db down'); });
    try {
      const err = await outcome(runTrendFetch('admin@x.co'));
      expect(err).toBe(boom);
    } finally { spy.mockRestore(); }
    expect(await rows()).toHaveLength(0);
  });

  it('runs one fetch at a time: two started together make one research call and the second gets 409', async () => {
    let release!: (v: { items: TrendItem[]; model: string }) => void;
    research.mockImplementation(() => new Promise(r => { release = r; }));
    const first = runTrendFetch('admin@x.co');
    const second = runTrendFetch('other@x.co');
    const secondErr = await outcome(second);
    expect(secondErr).toMatchObject({ status: 409, message: 'A fetch is already running.' });
    await vi.waitFor(() => expect(research).toHaveBeenCalledTimes(1));
    release({ items: [item('a')], model: 'm-1' });
    await expect(first).resolves.toMatchObject({ status: 'ok' });
    expect(research).toHaveBeenCalledTimes(1);
    expect(await rows()).toHaveLength(1);
  });

  it('clears the running flag after a failure so the next fetch can run', async () => {
    research.mockRejectedValueOnce(new ApiError(502, 'Nope.'));
    expect(await outcome(runTrendFetch('admin@x.co'))).toMatchObject({ status: 502 });
    research.mockResolvedValueOnce({ items: [item('a')], model: 'm-1' });
    const later = new Date(Date.now() + (MIN_GAP_SECONDS + 5) * 1000);
    await expect(runTrendFetch('admin@x.co', later)).resolves.toMatchObject({ status: 'ok' });
    expect(research).toHaveBeenCalledTimes(2);
  });

  it('refuses a fetch within a minute of the newest digest and says how many seconds are left', async () => {
    expect(MIN_GAP_SECONDS).toBe(60);
    const last = await createDigest({ createdBy: 'a@x.co', model: 'm', status: 'failed', error: 'x', items: [] });
    const at = (s: number) => new Date(last.createdAt.getTime() + s * 1000);
    const err = await outcome(runTrendFetch('admin@x.co', at(30.5)));
    expect(err).toMatchObject({ status: 429, message: 'Wait 30 seconds before fetching again.' });
    expect(await outcome(runTrendFetch('admin@x.co', at(59)))).toMatchObject({ status: 429, message: 'Wait 1 seconds before fetching again.' });
    expect(research).not.toHaveBeenCalled();
    expect(await listDigests()).toHaveLength(1);
    // the refused attempts did not leave the fetch marked as running
    research.mockResolvedValue({ items: [item('a')], model: 'm-1' });
    await expect(runTrendFetch('admin@x.co', at(60))).resolves.toMatchObject({ status: 'ok' });
    expect(await listDigests()).toHaveLength(2);
  });
});
