import { ApiError } from './errors';

/** The only address this module ever fetches. The search words go in the query string; the host never changes. */
const FEED_ENDPOINT = 'https://news.google.com/rss/search';
const FEED_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_AGE_DAYS = 14;
const MAX_HEADLINES = 60;
const MAX_QUERIES = 8;
const MAX_QUERY_LENGTH = 80;
const MAX_TITLE = 200;
const MAX_PUBLISHER = 80;
const MAX_URL = 2000;
const DEFAULT_LANGUAGE = 'en';
const USER_AGENT = 'Mozilla/5.0 (compatible; TrendHeadlineReader/1.0)';

/** Generic search words that always run. Search words for each category name are added after these. */
const BASE_QUERIES = ['handmade crafts trends', 'craft workshops trends'];
const QUERY_SUFFIX = ' trends';

export type Headline = { n: number; title: string; publisher: string; url: string; date: Date | null };
type RawHeadline = Omit<Headline, 'n'>;

/** Feed language and country from a locale such as `en_IN`. A locale that cannot be read leaves only the language. */
export function feedParams(locale: string): { hl: string; gl?: string; ceid?: string } {
  const text = typeof locale === 'string' ? locale.trim() : '';
  const full = /^([A-Za-z]{2,3})[_-]([A-Za-z]{2})$/.exec(text);
  if (full) {
    const lang = full[1].toLowerCase();
    const country = full[2].toUpperCase();
    return { hl: `${lang}-${country}`, gl: country, ceid: `${country}:${lang}` };
  }
  if (/^[A-Za-z]{2,3}$/.test(text)) return { hl: text.toLowerCase() };
  return { hl: DEFAULT_LANGUAGE };
}

/** The feed searches: the generic ones first, then one per category name (trimmed, no repeats ignoring case), 8 at most, each 80 characters at most. */
export function buildQueries(categories: string[]): string[] {
  const queries = [...BASE_QUERIES];
  const seen = new Set(queries.map((q) => q.toLowerCase()));
  for (const raw of Array.isArray(categories) ? categories : []) {
    if (queries.length >= MAX_QUERIES) break;
    if (typeof raw !== 'string') continue;
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH - QUERY_SUFFIX.length).trim();
    if (!name) continue;
    const query = `${name}${QUERY_SUFFIX}`;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(query);
  }
  return queries;
}

const ENTITY = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** Control characters (not tab or newline, which become spaces), plus invisible direction and zero-width marks. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-\u200F\u202A-\u202E\u2066-\u2069﻿]/g;

/**
 * The feed body is hostile input, so nothing here backtracks: every scan moves forward only and never searches again from a point it
 * has already passed. An item longer than MAX_ITEM_RAW is skipped, and a field longer than MAX_FIELD_RAW is cut, before any decoding.
 */
const MAX_ITEM_RAW = 32 * 1024;
const MAX_FIELD_RAW = 4 * 1024;

const isSpace = (ch: string) => ch !== '' && /\s/.test(ch);
const isLetter = (ch: string) => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');

function decodeEntities(s: string): string {
  return s.replace(ENTITY, (_m, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (name) return NAMED[name];
    const cp = dec !== undefined ? Number(dec) : parseInt(hex as string, 16);
    if (!Number.isFinite(cp) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '';
    return String.fromCodePoint(cp);
  });
}

/** Text inside an XML element: CDATA is taken literally, everything else has its entities decoded once. One forward pass. */
function xmlText(inner: string): string {
  let out = '';
  let pos = 0;
  for (;;) {
    const open = inner.indexOf('<![CDATA[', pos);
    if (open < 0) break;
    const close = inner.indexOf(']]>', open + 9);
    if (close < 0) break;
    out += decodeEntities(inner.slice(pos, open)) + inner.slice(open + 9, close);
    pos = close + 3;
  }
  return out + decodeEntities(inner.slice(pos));
}

/** Remove tags and comments in one forward pass. A `<` that starts no tag, or a tag or comment that is never closed, stays as text. */
function stripTags(s: string): string {
  let out = '';
  let pos = 0;
  let noTagEnd = false;
  let noCommentEnd = false;
  for (;;) {
    const lt = s.indexOf('<', pos);
    if (lt < 0) break;
    let end = -1;
    if (s.startsWith('!--', lt + 1)) {
      if (!noCommentEnd) {
        const c = s.indexOf('-->', lt + 4);
        if (c < 0) noCommentEnd = true;
        else end = c + 3;
      }
    } else if (isLetter(s.charAt(lt + 1)) || (s.charAt(lt + 1) === '/' && isLetter(s.charAt(lt + 2)))) {
      if (!noTagEnd) {
        const g = s.indexOf('>', lt + 1);
        if (g < 0) noTagEnd = true;
        else end = g + 1;
      }
    }
    if (end < 0) {
      out += s.slice(pos, lt + 1);
      pos = lt + 1;
    } else {
      out += s.slice(pos, lt);
      pos = end;
    }
  }
  return out + s.slice(pos);
}

/** Untrusted text made safe to show: no tags, no control characters, single spaces. */
function clean(s: string): string {
  return stripTags(s).replace(CONTROL, '').replace(/\s+/g, ' ').trim();
}

function cap(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** Lower case that keeps every index the same as in the original (toLowerCase can change the length of some characters). */
function lowerKeepingIndexes(s: string): string {
  const lower = s.toLowerCase();
  return lower.length === s.length ? lower : s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/** The raw inner text of the first `<name>` element in a block (cut at MAX_FIELD_RAW), or null. `lower` is the lower-cased copy of `block`. */
function tagInner(block: string, lower: string, name: string): string | null {
  const open = `<${name}`;
  let p = 0;
  for (;;) {
    p = lower.indexOf(open, p);
    if (p < 0) return null;
    const ch = lower.charAt(p + open.length);
    if (ch === '>' || isSpace(ch)) break;
    p += open.length;
  }
  const gt = lower.indexOf('>', p + open.length);
  if (gt < 0) return null;
  const end = lower.indexOf(`</${name}>`, gt + 1);
  if (end < 0) return null;
  return block.slice(gt + 1, Math.min(end, gt + 1 + MAX_FIELD_RAW));
}

/** Where the content of each complete `<item>` starts and ends: forward pointers only, so the total work is linear in the body. */
function itemRanges(lower: string): [number, number][] {
  const opens: number[] = [];
  for (let p = lower.indexOf('<item'); p >= 0; p = lower.indexOf('<item', p + 5)) {
    const ch = lower.charAt(p + 5);
    if (ch === '>' || isSpace(ch)) opens.push(p);
  }
  const closes: number[] = [];
  for (let p = lower.indexOf('</item>'); p >= 0; p = lower.indexOf('</item>', p + 7)) closes.push(p);

  const ranges: [number, number][] = [];
  let gt = 0; // the first ">" after the current open tag; it only ever moves forward
  let ci = 0;
  let oi = 0;
  let consumed = 0;
  for (const open of opens) {
    if (open < consumed) continue;
    if (gt < open + 5) {
      gt = lower.indexOf('>', open + 5);
      if (gt < 0) break;
    }
    const start = gt + 1;
    while (ci < closes.length && closes[ci] < start) ci++;
    if (ci >= closes.length) break;
    const close = closes[ci];
    while (oi < opens.length && opens[oi] < start) oi++;
    if (oi < opens.length && opens[oi] < close) continue; // another item starts first: this one is never closed
    consumed = close + 7;
    if (close - start <= MAX_ITEM_RAW) ranges.push([start, close]);
  }
  return ranges;
}

/** Read the items of an RSS feed: title, link, date and publisher. Pure, never throws, and linear in the size of the text. An item without a title or a link is skipped. */
export function parseFeed(xml: string): RawHeadline[] {
  const out: RawHeadline[] = [];
  if (typeof xml !== 'string') return out;
  try {
    const lowerXml = lowerKeepingIndexes(xml);
    for (const [start, end] of itemRanges(lowerXml)) {
      const block = xml.slice(start, end);
      const lower = lowerXml.slice(start, end);
      const rawTitle = tagInner(block, lower, 'title');
      const rawLink = tagInner(block, lower, 'link');
      if (rawTitle === null || rawLink === null) continue;
      const url = xmlText(rawLink).trim();
      const sourceInner = tagInner(block, lower, 'source');
      const publisher = sourceInner === null ? '' : clean(xmlText(sourceInner));
      let title = clean(xmlText(rawTitle));
      const suffix = ` - ${publisher}`.toLowerCase();
      if (publisher && title.length > suffix.length && title.toLowerCase().endsWith(suffix)) title = title.slice(0, title.length - suffix.length).trim();
      if (!title || !url) continue;
      const dateInner = tagInner(block, lower, 'pubdate');
      const parsed = dateInner === null ? null : new Date(clean(xmlText(dateInner)));
      out.push({
        title: cap(title, MAX_TITLE),
        publisher: cap(publisher, MAX_PUBLISHER),
        url,
        date: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      });
    }
  } catch {
    return out;
  }
  return out;
}

/** An https link without credentials, in its normal form, or null. */
function safeUrl(raw: string): string | null {
  if (raw.length > MAX_URL) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** The body as text, or null when it is longer than the cap. Stops reading as soon as the cap is passed. */
async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** One feed's text, or null when it could not be had in time (network error, bad status, too large, too slow). */
async function fetchFeed(url: string): Promise<string | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, FEED_TIMEOUT_MS);
  });
  const work = (async () => {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8' },
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return readCapped(res);
  })();
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const titleKey = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const time = (d: Date | null) => (d ? d.getTime() : Number.NEGATIVE_INFINITY);

/**
 * Recent headlines for the given searches, newest first, numbered from 1, at most 60. Every search is requested at once; a feed that
 * fails is skipped, and if none can be reached the call fails with a 502. Items older than 14 days are dropped, items without a date
 * are kept (last), and repeats by link or by title are removed keeping the newest.
 */
export async function fetchHeadlines(opts: { queries: string[]; locale: string; now?: Date }): Promise<Headline[]> {
  const queries = Array.isArray(opts.queries) ? opts.queries : [];
  if (queries.length === 0) return [];
  const now = opts.now ?? new Date();
  const params = feedParams(opts.locale);
  const urls = queries.map((q) => {
    let url = `${FEED_ENDPOINT}?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(params.hl)}`;
    if (params.gl) url += `&gl=${encodeURIComponent(params.gl)}`;
    if (params.ceid) url += `&ceid=${params.ceid.split(':').map(encodeURIComponent).join(':')}`;
    return url;
  });
  const bodies = await Promise.all(urls.map(fetchFeed));
  const reached = bodies.filter((b): b is string => b !== null);
  if (reached.length === 0) throw new ApiError(502, 'Could not reach the news feed. Try again later, or start a digest by hand.');

  const oldest = now.getTime() - MAX_AGE_DAYS * 86_400_000;
  const items: RawHeadline[] = [];
  for (const body of reached) {
    for (const it of parseFeed(body)) {
      const url = safeUrl(it.url);
      if (!url) continue;
      if (it.date && it.date.getTime() < oldest) continue;
      items.push({ ...it, url });
    }
  }
  items.sort((a, b) => time(b.date) - time(a.date));

  const urlsSeen = new Set<string>();
  const titlesSeen = new Set<string>();
  const out: Headline[] = [];
  for (const it of items) {
    const key = titleKey(it.title);
    if (urlsSeen.has(it.url) || (key && titlesSeen.has(key))) continue;
    urlsSeen.add(it.url);
    if (key) titlesSeen.add(key);
    out.push({ n: out.length + 1, ...it });
    if (out.length >= MAX_HEADLINES) break;
  }
  return out;
}
