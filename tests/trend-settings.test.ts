import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appSettings } from '@/db/schema';
import { listActiveCities } from '@/lib/cities';
import { DEFAULT_GEMINI_MODEL, clearTrendSettings, getTrendSettings, resolveGeminiConfig, saveTrendSettings } from '@/lib/trend-settings';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const KEY = 'AIzaSyTestKeyForGemini0000001234';
beforeEach(async () => { await resetTestDb(); delete process.env.GEMINI_API_KEY; });
afterEach(() => { delete process.env.GEMINI_API_KEY; });

describe('trend (Gemini) settings', () => {
  it('starts empty with the default model', async () => {
    expect(DEFAULT_GEMINI_MODEL).toMatch(/^[a-z0-9.-]{3,60}$/);
    expect(await getTrendSettings()).toEqual({ keySet: false, model: DEFAULT_GEMINI_MODEL, region: '', source: 'none', hasStoredRow: false });
    expect(await resolveGeminiConfig()).toBeNull();
  });
  it('saves the key sealed and only ever shows the last 4 characters', async () => {
    const v = await saveTrendSettings({ apiKey: ` ${KEY} `, model: 'gemini-test-1.5', region: ' Some region ' }, 'admin@x.co');
    expect(v).toEqual({ keySet: true, keyHint: '1234', model: 'gemini-test-1.5', region: 'Some region', source: 'saved', hasStoredRow: true });
    expect(JSON.stringify(v)).not.toContain(KEY);
    expect(await resolveGeminiConfig()).toEqual({ apiKey: KEY, model: 'gemini-test-1.5', region: 'Some region' });
    const [row] = await (await getTestDb()).select().from(appSettings);
    expect(row.key).toBe('trends');
    expect(JSON.stringify(row.value)).not.toContain(KEY); // encrypted at rest
    expect(row.updatedBy).toBe('admin@x.co');
  });
  it('uses the default model when none is typed', async () => {
    await saveTrendSettings({ apiKey: KEY }, 'a@x.co');
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: KEY, model: DEFAULT_GEMINI_MODEL });
  });
  it('keeps the saved key when the key box is left empty, and replaces it when one is typed', async () => {
    await saveTrendSettings({ apiKey: KEY, model: 'model-a' }, 'a@x.co');
    await saveTrendSettings({ apiKey: '', model: 'model-b' }, 'a@x.co');
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: KEY, model: 'model-b' });
    await saveTrendSettings({ model: 'model-b', apiKey: 'AIzaSyNewKeyForGemini00009999' }, 'a@x.co');
    expect(await getTrendSettings()).toMatchObject({ keyHint: '9999' });
  });
  it('needs a key the first time', async () => {
    await expect(saveTrendSettings({ model: 'model-a' }, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/key is required/) });
    await expect(saveTrendSettings({ apiKey: '' }, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/key is required/) });
  });
  it('validates the key, model and region', async () => {
    const bads: [Record<string, unknown>, RegExp][] = [
      [{ apiKey: 5 }, /key/], [{ apiKey: 'has a space' }, /key/], [{ apiKey: 'x'.repeat(301) }, /key/], [{ apiKey: 'bad\nkey123456' }, /key/],
      [{ apiKey: KEY, model: 'Has Capitals' }, /model/], [{ apiKey: KEY, model: 'ab' }, /model/], [{ apiKey: KEY, model: 'a'.repeat(61) }, /model/], [{ apiKey: KEY, model: 5 }, /model/],
      [{ apiKey: KEY, region: 'r'.repeat(201) }, /region/], [{ apiKey: KEY, region: 5 }, /region/],
    ];
    for (const [input, msg] of bads) await expect(saveTrendSettings(input, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(msg) });
    await expect(saveTrendSettings('nope', 'a@x.co')).rejects.toMatchObject({ status: 400 });
    expect(await getTrendSettings()).toMatchObject({ source: 'none' }); // nothing was saved
    await saveTrendSettings({ apiKey: KEY, region: 'r'.repeat(200), model: 'a'.repeat(60) }, 'a@x.co'); // the limits themselves are fine
  });
  it('accepts any visible-ASCII key, including the newer Google format that contains dots', async () => {
    for (const k of ['AQ.Ab8FakeKeyForTests_0123456789-abcdefghij', 'AIzaSyFakeKeyForTests0123456789abcdefghij', 'key~with+other/chars=12345']) {
      const v = await saveTrendSettings({ apiKey: k }, 'a@x.co');
      expect(v).toMatchObject({ keySet: true, keyHint: k.slice(-4) });
      expect(await resolveGeminiConfig()).toMatchObject({ apiKey: k });
    }
    for (const k of ['tab\tin-the-key-12345', 'accent-é-in-the-key-12345', 'emoji-🙂-in-the-key-12345']) {
      await expect(saveTrendSettings({ apiKey: k }, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/key/) });
    }
  });
  it('never puts the key in an error message', async () => {
    const bad = `${KEY} with spaces`;
    await expect(saveTrendSettings({ apiKey: bad }, 'a@x.co')).rejects.toMatchObject({ message: expect.not.stringContaining(KEY) });
  });
  it('uses the GEMINI_API_KEY variable when nothing is saved, prefers saved, and falls back after removal', async () => {
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    expect(await getTrendSettings()).toEqual({ keySet: true, keyHint: '7890', model: DEFAULT_GEMINI_MODEL, region: '', source: 'environment', hasStoredRow: false });
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: 'env-key-for-gemini-7890', model: DEFAULT_GEMINI_MODEL });
    await saveTrendSettings({ apiKey: KEY, model: 'model-a' }, 'a@x.co');
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: KEY, model: 'model-a' });
    expect(await clearTrendSettings()).toMatchObject({ source: 'environment', keyHint: '7890', model: DEFAULT_GEMINI_MODEL });
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: 'env-key-for-gemini-7890' });
  });
  it('falls back to the names of the cities in use when the region is empty', async () => {
    await saveTrendSettings({ apiKey: KEY }, 'a@x.co');
    const names = (await listActiveCities()).map(c => c.name);
    expect(names.length).toBeGreaterThan(0);
    expect((await resolveGeminiConfig())?.region).toBe(names.join(', '));
    expect((await getTrendSettings()).region).toBe(''); // the screen shows only what was typed
    await saveTrendSettings({ apiKey: '', region: 'Typed region' }, 'a@x.co');
    expect((await resolveGeminiConfig())?.region).toBe('Typed region');
  });
  it('has an empty region when there is nothing typed and no city is in use', async () => {
    await resetTestDb({ products: [], workshops: [], orders: [], bookings: [] } as never);
    await saveTrendSettings({ apiKey: KEY }, 'a@x.co');
    expect((await resolveGeminiConfig())?.region).toBe('');
  });
  it('falls back to the environment when the saved key cannot be decrypted', async () => {
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    await saveTrendSettings({ apiKey: KEY }, 'a@x.co');
    process.env.NEXTAUTH_SECRET = 'rotated';
    expect(await resolveGeminiConfig()).toMatchObject({ apiKey: 'env-key-for-gemini-7890' });
    expect(await getTrendSettings()).toMatchObject({ source: 'environment' });
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });
  it('saves model and region with no key when the key comes from the environment, and uses them with the environment key', async () => {
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    const v = await saveTrendSettings({ model: 'model-fixed', region: 'Typed region', apiKey: '' }, 'a@x.co');
    expect(v).toEqual({ keySet: true, keyHint: '7890', model: 'model-fixed', region: 'Typed region', source: 'environment', hasStoredRow: true });
    expect(await resolveGeminiConfig()).toEqual({ apiKey: 'env-key-for-gemini-7890', model: 'model-fixed', region: 'Typed region' });
    const [row] = await (await getTestDb()).select().from(appSettings);
    expect(row.value).toEqual({ model: 'model-fixed', region: 'Typed region' }); // no key stored
    expect(row.updatedBy).toBe('a@x.co');
    await saveTrendSettings({ model: 'model-fixed' }, 'a@x.co'); // key absent altogether is fine too
    expect(await getTrendSettings()).toMatchObject({ source: 'environment', model: 'model-fixed', region: '' });
  });
  it('a key typed later is stored beside the saved model and region and wins over the environment', async () => {
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    await saveTrendSettings({ model: 'model-fixed', apiKey: '' }, 'a@x.co');
    await saveTrendSettings({ apiKey: KEY, model: 'model-fixed' }, 'a@x.co');
    expect(await resolveGeminiConfig()).toEqual({ apiKey: KEY, model: 'model-fixed', region: expect.any(String) });
    expect(await getTrendSettings()).toMatchObject({ source: 'saved', keyHint: '1234' });
  });
  it('still needs a key the first time when there is no environment key either', async () => {
    await expect(saveTrendSettings({ model: 'model-a', apiKey: '' }, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/key is required/) });
    expect(await getTrendSettings()).toMatchObject({ hasStoredRow: false });
  });
  it('clearing removes the saved model and region too, so the defaults come back', async () => {
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    await saveTrendSettings({ model: 'model-fixed', region: 'Typed region' }, 'a@x.co');
    expect(await clearTrendSettings()).toEqual({ keySet: true, keyHint: '7890', model: DEFAULT_GEMINI_MODEL, region: '', source: 'environment', hasStoredRow: false });
    expect(await resolveGeminiConfig()).toMatchObject({ model: DEFAULT_GEMINI_MODEL });
  });
  it('reports a stored row whose key cannot be decrypted, so it can still be removed', async () => {
    await saveTrendSettings({ apiKey: KEY }, 'a@x.co');
    process.env.NEXTAUTH_SECRET = 'rotated';
    try {
      expect(await getTrendSettings()).toMatchObject({ keySet: false, source: 'none', hasStoredRow: true });
      expect(await clearTrendSettings()).toMatchObject({ source: 'none', hasStoredRow: false });
    } finally { process.env.NEXTAUTH_SECRET = 'test-secret'; }
  });
});
