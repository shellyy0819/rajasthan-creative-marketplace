import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { buildPrompt, researchTrends } from '@/lib/trend-research';

const KEY = 'AIzaSyFAKEKEY1234567890abcdef';
const cfg = { apiKey: KEY, model: 'gemini-test-model', region: 'Jaipur and Udaipur' };
const NOW = new Date('2026-11-25T10:00:00Z');

const item = (over: Record<string, unknown> = {}) => ({
  kind: 'craft',
  title: 'Block printed linen',
  why: 'Buyers are searching for natural dyes and hand block prints.',
  category: 'Textiles',
  tags: ['linen', 'block print'],
  sources: [{ title: 'Design weekly', url: 'https://designweekly.example/linen' }],
  ...over,
});
const chunks = [
  { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'designweekly.example' } },
  { web: { uri: 'https://crafts.example.org/article', title: 'Crafts Example Journal' } },
];
const geminiBody = (text: string, groundingChunks: unknown[] = chunks) => ({
  candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks } }],
});
const reply = (text: string, groundingChunks?: unknown[]) =>
  new Response(JSON.stringify(geminiBody(text, groundingChunks)), { status: 200, headers: { 'content-type': 'application/json' } });
const mockFetch = (fn: (...a: unknown[]) => Promise<Response>) => {
  const m = vi.fn(fn);
  vi.stubGlobal('fetch', m);
  return m;
};
const asJson = (items: unknown[]) => JSON.stringify({ items });
const failure = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } return null; };

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('buildPrompt', () => {
  it('names the region when given and asks for the JSON fields', () => {
    const p = buildPrompt({ region: 'Jaipur and Udaipur', now: NOW });
    expect(p).toContain('Jaipur and Udaipur');
    for (const word of ['JSON', 'kind', 'title', 'why', 'category', 'tags', 'sources']) expect(p).toContain(word);
  });
  it('has no place or brand name when the region is empty', () => {
    expect(buildPrompt({ region: '', now: NOW })).not.toMatch(/Rajasthan|Craftofy/);
    expect(buildPrompt({ region: '   \n ', now: NOW })).not.toMatch(/Rajasthan|Craftofy/);
  });
  it('collapses newlines and runs of spaces in the region to single spaces', () => {
    const p = buildPrompt({ region: 'Jaipur,\n\nUdaipur\t and   Jodhpur', now: NOW });
    expect(p).toContain('Jaipur, Udaipur and Jodhpur');
    expect(p).not.toContain('Jaipur,\n');
  });
  it('mentions the month so results are current', () => {
    expect(buildPrompt({ region: '', now: NOW })).toContain('November 2026');
  });
});

describe('researchTrends request', () => {
  it('posts to the model url with the key in a header, never in the url, and asks for Google Search', async () => {
    const f = mockFetch(async () => reply(asJson([item()])));
    const out = await researchTrends(cfg, NOW);
    expect(out.model).toBe('gemini-test-model');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
    expect(url).not.toContain(KEY);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body as string);
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.contents[0].parts[0].text).toContain('Jaipur and Udaipur');
  });
});

describe('researchTrends parsing', () => {
  const run = (text: string) => { mockFetch(async () => reply(text)); return researchTrends(cfg, NOW); };

  it('returns hidden web items with fresh ids and grounded sources', async () => {
    const { items } = await run(asJson([item(), item({ title: 'Second craft' })]));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'craft', title: 'Block printed linen', origin: 'web', show: false, category: 'Textiles' });
    expect(items[0].sources).toEqual([{ title: 'Design weekly', url: 'https://designweekly.example/linen' }]);
    expect(items[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(items[0].id).not.toBe(items[1].id);
  });
  it('parses JSON inside a json fence', async () => {
    const { items } = await run('```json\n' + asJson([item()]) + '\n```');
    expect(items).toHaveLength(1);
  });
  it('parses JSON with prose before and after', async () => {
    const { items } = await run('Here is what I found {not json yet} for you:\n' + asJson([item()]) + '\nHope this helps [1].');
    expect(items).toHaveLength(1);
  });
  it('parses a bare array and braces inside strings', async () => {
    const { items } = await run(JSON.stringify([item({ why: 'Buyers like {braces} and ] brackets in their words.' })]));
    expect(items).toHaveLength(1);
  });
  it('fails with a plain 502 when there is no JSON at all', async () => {
    const e = await failure(run('Sorry, I could not find anything.'));
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(502);
  });
  it('fails with a plain 502 when the reply has no candidates', async () => {
    mockFetch(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const e = await failure(researchTrends(cfg, NOW));
    expect((e as ApiError).status).toBe(502);
  });
});

describe('researchTrends grounding', () => {
  const run = (items: unknown[], groundingChunks?: unknown[]) => { mockFetch(async () => reply(asJson(items), groundingChunks)); return researchTrends(cfg, NOW); };

  it('drops javascript: and http: sources, and an item left with none', async () => {
    const { items } = await run([
      item({ sources: [{ title: 'Bad', url: 'javascript:alert(1)' }, { title: 'Design weekly', url: 'https://designweekly.example/linen' }] }),
      item({ title: 'Only plain http', sources: [{ title: 'Design weekly', url: 'http://designweekly.example/linen' }] }),
      item({ title: 'Only script', sources: [{ title: 'x', url: 'javascript:alert(1)' }] }),
    ]);
    expect(items.map(i => i.title)).toEqual(['Block printed linen']);
    expect(items[0].sources).toEqual([{ title: 'Design weekly', url: 'https://designweekly.example/linen' }]);
  });
  it('drops sources whose host the search did not find, and the item when none is left', async () => {
    const { items } = await run([
      item({ sources: [{ title: 'Invented', url: 'https://invented.example/page' }, { title: 'Real', url: 'https://designweekly.example/x' }] }),
      item({ title: 'All invented', sources: [{ title: 'Invented', url: 'https://invented.example/page' }] }),
    ]);
    expect(items.map(i => i.title)).toEqual(['Block printed linen']);
    expect(items[0].sources.map(s => s.url)).toEqual(['https://designweekly.example/x']);
  });
  it('drops only the source whose url is over 300 characters, and keeps the item', async () => {
    const long = `https://designweekly.example/${'a'.repeat(280)}`;
    const { items } = await run([item({ sources: [{ title: 'Too long', url: long }, { title: 'Design weekly', url: 'https://designweekly.example/linen' }] })]);
    expect(items).toHaveLength(1);
    expect(items[0].sources).toEqual([{ title: 'Design weekly', url: 'https://designweekly.example/linen' }]);
  });
  it('drops an item whose only source is over 300 characters', async () => {
    const long = `https://designweekly.example/${'a'.repeat(280)}`;
    const { items } = await run([item({ sources: [{ title: 'Too long', url: long }] })]);
    expect(items).toEqual([]);
  });
  it('matches the host of a chunk uri that is not a redirect', async () => {
    const { items } = await run([item({ sources: [{ title: 'Journal', url: 'https://crafts.example.org/other-page' }] })]);
    expect(items).toHaveLength(1);
  });
  it('matches a title that looks like a host, ignoring case and a leading www.', async () => {
    const { items } = await run(
      [item({ sources: [{ title: 'Shop', url: 'https://www.Shop.Example.com/a' }] })],
      [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/zzz', title: 'shop.example.com' } }],
    );
    expect(items).toHaveLength(1);
  });
  it('does not let a title that is not a host, or a redirect host, ground anything', async () => {
    const { items } = await run([
      item({ title: 'By title words', sources: [{ title: 'x', url: 'https://crafts.example.org.evil.example/a' }] }),
      item({ title: 'By the redirect host', sources: [{ title: 'x', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc' }] }),
    ]);
    expect(items).toEqual([]);
  });
  it('keeps nothing when the search found no pages at all', async () => {
    expect((await run([item()], [])).items).toEqual([]);
    mockFetch(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: asJson([item()]) }] } }] }), { status: 200 }));
    expect((await researchTrends(cfg, NOW)).items).toEqual([]);
  });
  it('gives an empty list when every item is dropped', async () => {
    const out = await run([item({ sources: [{ title: 'Invented', url: 'https://invented.example/' }] })]);
    expect(out).toEqual({ items: [], model: 'gemini-test-model' });
  });
  it('drops an item with an unknown kind or invalid fields but keeps the others', async () => {
    const { items } = await run([item({ kind: 'furniture' }), item({ title: 'ok' }), item({ title: 'Fine one', kind: 'workshop' })]);
    expect(items.map(i => i.title)).toEqual(['Fine one']);
  });
  it('keeps at most 12 items', async () => {
    const many = Array.from({ length: 15 }, (_, i) => item({ title: `Craft number ${i}` }));
    expect((await run(many)).items).toHaveLength(12);
  });
});

describe('researchTrends failures', () => {
  const status = async (code: number, body = '{}') => {
    mockFetch(async () => new Response(body, { status: code }));
    return failure(researchTrends(cfg, NOW)) as Promise<ApiError>;
  };

  it.each([
    [400, 'Gemini refused the key'],
    [401, 'Gemini refused the key'],
    [403, 'Gemini refused the key'],
    [404, 'Gemini does not offer that model'],
    [429, 'Gemini quota reached'],
    [500, 'Gemini is not answering'],
  ])('HTTP %i gives ApiError(502) "%s"', async (code, message) => {
    const e = await status(code);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
    expect(e.message).toContain(message);
  });
  it("adds Google's own reason to the message, so the admin can see why (quota limit, billing, wrong model)", async () => {
    const reason = 'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: grounding, limit: 0';
    const e = await status(429, JSON.stringify({ error: { code: 429, message: reason, status: 'RESOURCE_EXHAUSTED' } }));
    expect(e.message).toBe(`Gemini quota reached. Try again later. Google says: ${reason}`);
    const notFound = await status(404, JSON.stringify({ error: { message: 'models/nope is not found for API version v1beta' } }));
    expect(notFound.message).toContain('Google says: models/nope is not found');
  });
  it("keeps Google's reason short and on one line, and leaves it out when there is none", async () => {
    const long = await status(429, JSON.stringify({ error: { message: `line one\n\n   line two ${'x'.repeat(400)}` } }));
    const detail = long.message.split('Google says: ')[1];
    expect(detail.startsWith('line one line two')).toBe(true);
    expect(detail.length).toBeLessThanOrEqual(200);
    expect(detail.endsWith('…')).toBe(true);
    for (const body of ['not json at all', '{}', JSON.stringify({ error: {} }), JSON.stringify({ error: { message: 5 } }), JSON.stringify({ error: { message: '   ' } })]) {
      expect((await status(429, body)).message).toBe('Gemini quota reached. Try again later.');
    }
  });
  it("scrubs the key out of Google's reason too", async () => {
    const e = await status(403, JSON.stringify({ error: { message: `API key ${KEY} not valid. Please pass a valid API key.` } }));
    expect(e.message).toContain('Google says: API key *** not valid.');
    expect(e.message).not.toContain(KEY);
  });
  it('never puts the key in the message, even when the body echoes it', async () => {
    for (const code of [400, 403, 429, 500]) {
      const e = await status(code, JSON.stringify({ error: { message: `API key ${KEY} not valid` } }));
      expect(e.message).not.toContain(KEY);
    }
  });
  it('a network error that mentions the key is scrubbed', async () => {
    mockFetch(async () => { throw new TypeError(`fetch failed for key=${KEY}`); });
    const e = (await failure(researchTrends(cfg, NOW))) as ApiError;
    expect(e.status).toBe(502);
    expect(e.message).toContain('Gemini is not answering');
    expect(e.message).not.toContain(KEY);
  });
  it('aborts a fetch that never resolves after 90 seconds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mockFetch((_url, init) => {
      signal = (init as RequestInit).signal as AbortSignal;
      return new Promise<Response>((_res, rej) => signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    });
    const p = failure(researchTrends(cfg, NOW));
    await vi.advanceTimersByTimeAsync(89_000);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(signal!.aborted).toBe(true);
    const e = (await p) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
    expect(e.message).toContain('Gemini is not answering');
  });
});
