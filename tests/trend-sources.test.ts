import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors';
import { buildQueries, feedParams, fetchHeadlines, parseFeed } from '@/lib/trend-sources';

const NOW = new Date('2026-11-25T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toUTCString();

type Spec = { title?: string; link?: string; date?: string; source?: string; raw?: string };
const itemXml = (s: Spec) =>
  '<item>' +
  (s.title !== undefined ? `<title>${s.title}</title>` : '') +
  (s.link !== undefined ? `<link>${s.link}</link>` : '') +
  (s.date !== undefined ? `<pubDate>${s.date}</pubDate>` : '') +
  (s.source !== undefined ? `<source url="https://pub.example">${s.source}</source>` : '') +
  (s.raw ?? '') +
  '</item>';
const rss = (...items: Spec[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>feed</title>${items.map(itemXml).join('')}</channel></rss>`;
const ok = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
const mockFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) => {
  const m = vi.fn((u: unknown, i?: RequestInit) => fn(String(u), i));
  vi.stubGlobal('fetch', m);
  return m;
};
const failure = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } return null; };
const art = (n: number, over: Spec = {}): Spec => ({
  title: `Story number ${n}`, link: `https://news.example/a/${n}`, date: day(1), source: 'Daily Example', ...over,
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('feedParams', () => {
  it('turns en_IN into language, country and edition', () => {
    expect(feedParams('en_IN')).toEqual({ hl: 'en-IN', gl: 'IN', ceid: 'IN:en' });
  });
  it('turns en_US into language, country and edition', () => {
    expect(feedParams('en_US')).toEqual({ hl: 'en-US', gl: 'US', ceid: 'US:en' });
  });
  it('gives only the language for a bare language', () => {
    expect(feedParams('en')).toEqual({ hl: 'en' });
  });
  it('falls back to en for garbage', () => {
    expect(feedParams('')).toEqual({ hl: 'en' });
    expect(feedParams('!!??')).toEqual({ hl: 'en' });
    expect(feedParams('english_unitedstates')).toEqual({ hl: 'en' });
  });
});

describe('buildQueries', () => {
  it('starts with the two generic queries, then one per category, trimmed and de-duplicated', () => {
    expect(buildQueries(['Pottery', 'pottery', 'Block Printing', ''])).toEqual([
      'handmade crafts trends', 'craft workshops trends', 'Pottery trends', 'Block Printing trends',
    ]);
  });
  it('trims whitespace and skips blank categories', () => {
    expect(buildQueries(['  Weaving  ', '   '])).toEqual(['handmade crafts trends', 'craft workshops trends', 'Weaving trends']);
  });
  it('works with no categories', () => {
    expect(buildQueries([])).toEqual(['handmade crafts trends', 'craft workshops trends']);
  });
  it('returns at most 8 queries', () => {
    const cats = Array.from({ length: 20 }, (_, i) => `Category ${i}`);
    const q = buildQueries(cats);
    expect(q).toHaveLength(8);
    expect(q[2]).toBe('Category 0 trends');
    expect(q[7]).toBe('Category 5 trends');
  });
  it('keeps every query within 80 characters', () => {
    const q = buildQueries(['x'.repeat(200)]);
    expect(q).toHaveLength(3);
    expect(q[2].length).toBeLessThanOrEqual(80);
    expect(q[2].endsWith(' trends')).toBe(true);
  });
});

describe('parseFeed', () => {
  it('reads title, link, date and publisher, and removes the publisher suffix', () => {
    const out = parseFeed(rss({ title: 'Linen is back - Daily Example', link: 'https://news.example/a/1', date: 'Mon, 24 Nov 2026 08:00:00 GMT', source: 'Daily Example' }));
    expect(out).toEqual([{ title: 'Linen is back', publisher: 'Daily Example', url: 'https://news.example/a/1', date: new Date('2026-11-24T08:00:00Z') }]);
  });
  it('keeps a dash in the title that is not the publisher suffix', () => {
    const out = parseFeed(rss({ title: 'Clay - the new luxury - Daily Example', link: 'https://news.example/a/1', source: 'Daily Example' }));
    expect(out[0].title).toBe('Clay - the new luxury');
    const other = parseFeed(rss({ title: 'Clay - the new luxury', link: 'https://news.example/a/1', source: 'Daily Example' }));
    expect(other[0].title).toBe('Clay - the new luxury');
  });
  it('reads CDATA titles literally', () => {
    const out = parseFeed(rss({ title: '<![CDATA[Weavers & makers: a guide]]>', link: 'https://news.example/a/1', source: 'P' }));
    expect(out[0].title).toBe('Weavers & makers: a guide');
  });
  it('decodes the five XML entities and numeric entities', () => {
    const out = parseFeed(rss({ title: 'Tea &amp; clay &quot;cups&quot; &apos;n&apos; mugs &#8211; &#x2014; 1 &lt; 2 &gt; 0', link: 'https://news.example/a/1' }));
    expect(out[0].title).toBe('Tea & clay "cups" \'n\' mugs – — 1 < 2 > 0');
  });
  it('decodes once only, so an escaped entity stays text', () => {
    const out = parseFeed(rss({ title: 'a &amp;amp; b', link: 'https://news.example/a/1' }));
    expect(out[0].title).toBe('a &amp; b');
  });
  it('decodes entities in the link', () => {
    const out = parseFeed(rss({ title: 'T', link: 'https://news.example/a?x=1&amp;y=2' }));
    expect(out[0].url).toBe('https://news.example/a?x=1&y=2');
  });
  it('drops an invalid numeric entity instead of throwing', () => {
    const out = parseFeed(rss({ title: 'a&#99999999;b&#xD800;c', link: 'https://news.example/a/1' }));
    expect(out[0].title).toBe('abc');
  });
  it('gives null for a missing or invalid date', () => {
    const out = parseFeed(rss({ title: 'A', link: 'https://news.example/1', date: 'not a date' }, { title: 'B', link: 'https://news.example/2' }));
    expect(out.map((i) => i.date)).toEqual([null, null]);
  });
  it('skips an item with no link or no title', () => {
    const out = parseFeed(rss({ title: 'No link here' }, { link: 'https://news.example/untitled' }, { title: 'Fine', link: 'https://news.example/2' }));
    expect(out.map((i) => i.title)).toEqual(['Fine']);
  });
  it('skips an item whose title is only markup', () => {
    expect(parseFeed(rss({ title: '<b></b>', link: 'https://news.example/1' }))).toEqual([]);
  });
  it('strips tags inside the title and the encoded tags too', () => {
    const out = parseFeed(rss(
      { title: 'Big <b>news</b> for <a href="x">potters</a>', link: 'https://news.example/1' },
      { title: '&lt;script&gt;alert(1)&lt;/script&gt;Safe title', link: 'https://news.example/2' },
    ));
    expect(out[0].title).toBe('Big news for potters');
    expect(out[1].title).toBe('alert(1)Safe title');
    expect(out[1].title).not.toContain('<');
  });
  it('removes control characters and collapses whitespace', () => {
    const out = parseFeed(rss({ title: 'a\u0000b\u0007c\n\t  d&#1;e\u202Ef', link: 'https://news.example/1', source: 'Pub\u0000 lisher' }));
    expect(out[0].title).toBe('abc def');
    expect(out[0].publisher).toBe('Pub lisher');
  });
  it('caps a title at 200 and a publisher at 80 characters', () => {
    const out = parseFeed(rss({ title: 'x'.repeat(500), link: 'https://news.example/1', source: 'p'.repeat(300) }));
    expect(out[0].title).toHaveLength(200);
    expect(out[0].publisher).toHaveLength(80);
  });
  it('uses an empty publisher when there is no source', () => {
    expect(parseFeed(rss({ title: 'T', link: 'https://news.example/1' }))[0].publisher).toBe('');
  });
  it('returns an empty list for HTML, an empty string and non-feed text', () => {
    expect(parseFeed('<html><body><h1>Blocked</h1><p>captcha</p></body></html>')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
    expect(parseFeed('just words')).toEqual([]);
  });
  it('ignores an unclosed item without throwing and still reads the closed ones', () => {
    const xml = '<rss><channel><item><title>Open</title><link>https://news.example/1</link>' + itemXml({ title: 'Closed', link: 'https://news.example/2' });
    expect(() => parseFeed(xml)).not.toThrow();
    expect(parseFeed(xml).map((i) => i.title)).toEqual(['Closed']);
    expect(parseFeed('<rss><channel><item><title>Open</title><link>https://news.example/1</link>')).toEqual([]);
  });
  it('does not treat an items wrapper tag as an item', () => {
    expect(parseFeed('<items><title>No</title><link>https://news.example/1</link></items>')).toEqual([]);
  });
  it('never throws on non-string input', () => {
    expect(parseFeed(undefined as unknown as string)).toEqual([]);
    expect(parseFeed(null as unknown as string)).toEqual([]);
  });
});

describe('fetchHeadlines', () => {
  const base = 'https://news.google.com/rss/search';

  it('requests only the fixed feed host, with the exact URL for an en_IN locale', async () => {
    const f = mockFetch(async () => ok(rss(art(1))));
    await fetchHeadlines({ queries: ['handmade crafts trends'], locale: 'en_IN', now: NOW });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(`${base}?q=handmade%20crafts%20trends&hl=en-IN&gl=IN&ceid=IN:en`);
  });
  it('encodes a query that contains & and #', async () => {
    const f = mockFetch(async () => ok(rss(art(1))));
    await fetchHeadlines({ queries: ['arts & crafts #1'], locale: 'en_US', now: NOW });
    const url = String(f.mock.calls[0][0]);
    expect(url.startsWith(`${base}?q=arts%20%26%20crafts%20%231&hl=en-US&gl=US&ceid=US:en`)).toBe(true);
    expect(new URL(url).host).toBe('news.google.com');
  });
  it('sends only the language when the locale has no country', async () => {
    const f = mockFetch(async () => ok(rss(art(1))));
    await fetchHeadlines({ queries: ['a'], locale: 'en', now: NOW });
    expect(f.mock.calls[0][0]).toBe(`${base}?q=a&hl=en`);
  });
  it('sends a generic user-agent and an abort signal', async () => {
    const f = mockFetch(async () => ok(rss(art(1))));
    await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(init.headers).toLowerCase()).toContain('user-agent');
  });

  it('requests every query in parallel, before the first one resolves', async () => {
    const gates: ((r: Response) => void)[] = [];
    const f = mockFetch(() => new Promise<Response>((res) => { gates.push(res); }));
    const p = fetchHeadlines({ queries: ['a', 'b', 'c'], locale: 'en_US', now: NOW });
    await new Promise((r) => setTimeout(r, 0));
    expect(f).toHaveBeenCalledTimes(3);
    gates.forEach((g, i) => g(ok(rss(art(i + 1)))));
    expect(await p).toHaveLength(3);
  });

  it('skips a feed that rejects or answers with an error status, while the others count', async () => {
    mockFetch(async (url) => {
      if (url.includes('q=a&')) throw new Error('network down');
      if (url.includes('q=b&')) return new Response('nope', { status: 503 });
      return ok(rss(art(1)));
    });
    const out = await fetchHeadlines({ queries: ['a', 'b', 'c'], locale: 'en_US', now: NOW });
    expect(out.map((h) => h.title)).toEqual(['Story number 1']);
  });
  it('throws a 502 ApiError that names the feed and the manual route when every feed fails', async () => {
    mockFetch(async () => { throw new Error('down'); });
    const e = await failure(fetchHeadlines({ queries: ['a', 'b'], locale: 'en_US', now: NOW }));
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(502);
    expect((e as ApiError).message).toMatch(/news feed/i);
    expect((e as ApiError).message).toMatch(/start a digest by hand/i);
  });
  it('treats a feed that never answers as failed after 10 seconds', async () => {
    vi.useFakeTimers();
    mockFetch((url) => (url.includes('q=slow&') ? new Promise<Response>(() => {}) : Promise.resolve(ok(rss(art(1))))));
    const p = fetchHeadlines({ queries: ['slow', 'fast'], locale: 'en_US', now: NOW });
    await vi.advanceTimersByTimeAsync(9_999);
    let settled = false;
    p.then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).map((h) => h.title)).toEqual(['Story number 1']);
  });
  it('fails with the 502 when the only feed times out', async () => {
    vi.useFakeTimers();
    mockFetch(() => new Promise<Response>(() => {}));
    const p = failure(fetchHeadlines({ queries: ['slow'], locale: 'en_US', now: NOW }));
    await vi.advanceTimersByTimeAsync(10_000);
    const e = await p;
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(502);
  });
  it('aborts the request when it times out', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    mockFetch((_u, init) => { signal = init?.signal as AbortSignal; return new Promise<Response>(() => {}); });
    const p = failure(fetchHeadlines({ queries: ['slow'], locale: 'en_US', now: NOW }));
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(signal?.aborted).toBe(true);
  });
  it('ignores a body larger than 1 MB', async () => {
    const huge = rss(art(1)) + ' '.repeat(1_048_576 + 10);
    mockFetch(async (url) => (url.includes('q=big&') ? ok(huge) : ok(rss(art(2)))));
    const out = await fetchHeadlines({ queries: ['big', 'small'], locale: 'en_US', now: NOW });
    expect(out.map((h) => h.title)).toEqual(['Story number 2']);
  });
  it('treats an oversized body as a failed feed', async () => {
    mockFetch(async () => ok(rss(art(1)) + ' '.repeat(1_048_576 + 10)));
    const e = await failure(fetchHeadlines({ queries: ['big'], locale: 'en_US', now: NOW }));
    expect((e as ApiError).status).toBe(502);
  });
  it('accepts a body just under 1 MB', async () => {
    const body = rss(art(1));
    mockFetch(async () => ok(body + ' '.repeat(1_048_576 - body.length)));
    expect(await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW })).toHaveLength(1);
  });

  it('drops items older than 14 days and keeps an item with no date', async () => {
    mockFetch(async () => ok(rss(
      art(1, { date: day(13) }),
      art(2, { date: day(15) }),
      art(3, { date: undefined }),
    )));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(out.map((h) => h.title).sort()).toEqual(['Story number 1', 'Story number 3']);
  });
  it('drops http, javascript and credentialed links', async () => {
    mockFetch(async () => ok(rss(
      art(1, { link: 'http://news.example/a/1' }),
      art(2, { link: 'javascript:alert(1)' }),
      art(3, { link: 'https://user:pw@news.example/a/3' }),
      art(4, { link: 'https://user@news.example/a/4' }),
      art(5, { link: 'not a url' }),
      art(6),
    )));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(out.map((h) => h.url)).toEqual(['https://news.example/a/6']);
  });
  it('removes duplicates by URL, keeping the newest', async () => {
    mockFetch(async () => ok(rss(
      art(1, { title: 'Older copy', link: 'https://news.example/same', date: day(5) }),
      art(2, { title: 'Newer copy', link: 'https://news.example/same', date: day(2) }),
    )));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(out.map((h) => h.title)).toEqual(['Newer copy']);
  });
  it('removes duplicates by normalised title across feeds, keeping the newest', async () => {
    mockFetch(async (url) => (url.includes('q=a&')
      ? ok(rss(art(1, { title: 'Hand-Made Pots: A Boom!', link: 'https://one.example/x', date: day(6) })))
      : ok(rss(art(2, { title: 'hand made   pots a boom', link: 'https://two.example/y', date: day(3) })))));
    const out = await fetchHeadlines({ queries: ['a', 'b'], locale: 'en_US', now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://two.example/y');
  });
  it('sorts newest first, puts undated items last, and numbers from 1', async () => {
    mockFetch(async () => ok(rss(
      art(1, { date: day(5) }),
      art(2, { date: undefined }),
      art(3, { date: day(1) }),
      art(4, { date: day(3) }),
    )));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(out.map((h) => [h.n, h.title])).toEqual([
      [1, 'Story number 3'], [2, 'Story number 4'], [3, 'Story number 1'], [4, 'Story number 2'],
    ]);
    expect(out[0].date).toBeInstanceOf(Date);
    expect(out[3].date).toBeNull();
  });
  it('returns at most 60 headlines', async () => {
    mockFetch(async () => ok(rss(...Array.from({ length: 90 }, (_, i) => art(i + 1, { date: new Date(NOW.getTime() - i * 3_600_000).toUTCString() })))));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(out).toHaveLength(60);
    expect(out.map((h) => h.n)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(out[0].title).toBe('Story number 1');
  });
  it('caps long titles and publishers', async () => {
    mockFetch(async () => ok(rss(art(1, { title: 't'.repeat(400), source: 'p'.repeat(200) }))));
    const [h] = await fetchHeadlines({ queries: ['a'], locale: 'en_US', now: NOW });
    expect(h.title).toHaveLength(200);
    expect(h.publisher).toHaveLength(80);
  });
  it('gives an empty list, not an error, when every feed is empty', async () => {
    mockFetch(async () => ok(rss()));
    expect(await fetchHeadlines({ queries: ['a', 'b'], locale: 'en_US', now: NOW })).toEqual([]);
  });
  it('defaults now to the current time', async () => {
    mockFetch(async () => ok(rss(art(1, { date: new Date().toUTCString() }), art(2, { date: day(30) }))));
    const out = await fetchHeadlines({ queries: ['a'], locale: 'en_US' });
    expect(out.map((h) => h.title)).toEqual(['Story number 1']);
  });
  it('treats an empty query list as nothing to fetch', async () => {
    const f = mockFetch(async () => ok(rss(art(1))));
    expect(await fetchHeadlines({ queries: [], locale: 'en_US', now: NOW })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
