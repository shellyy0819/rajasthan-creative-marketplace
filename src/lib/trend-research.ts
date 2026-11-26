import { ApiError } from './errors';
import type { GeminiConfig } from './trend-settings';
import { parseItemInput, type TrendItem } from './trend-types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 90_000;
const MAX_ITEMS = 12;
/** Gemini often hands back its own redirect links; the host of those says nothing about the page, so it never counts as grounding. */
const REDIRECT_HOSTS = new Set(['vertexaisearch.cloud.google.com']);

/** Region text comes from admin settings and may hold newlines or runs of spaces: one line, single spaces. */
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The research request. Nothing here names a place or a brand: the region comes from settings (or is left out). */
export function buildPrompt(opts: { region: string; now: Date }): string {
  const region = oneLine(opts.region);
  const month = opts.now.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return [
    `You are a market researcher for an online marketplace of handmade crafts, art and creative workshops. The date is ${month}.`,
    region
      ? `Use Google Search to find what is trending right now in handmade crafts, art and creative workshops, with a focus on buyers and learners in or interested in: ${region}.`
      : 'Use Google Search to find what is trending right now in handmade crafts, art and creative workshops.',
    `Pick up to ${MAX_ITEMS} distinct trends from the last few months. Mix the kinds: "craft" (a handmade product style, material or technique people want), "art" (an art form or style people want), "workshop" (a class or experience people are signing up for).`,
    'Write every title and explanation in your own words. Never copy sentences from a page.',
    'Answer with JSON only, in exactly this shape, and nothing else:',
    '{"items":[{"kind":"craft|art|workshop","title":"3 to 120 characters","why":"10 to 400 characters on why it is trending and why buyers care","category":"a short category name","tags":["up to 6 short tags"],"sources":[{"title":"name of the site","url":"https://full link to the page you read"}]}]}',
    'Every item needs 1 to 4 sources. A source must be a real https page that Google Search returned for you. Never invent a link.',
  ].join('\n');
}

/** What we can read of a Gemini reply. */
type Chunk = { web?: { uri?: unknown; title?: unknown } };
type Reply = {
  candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] }; groundingMetadata?: { groundingChunks?: Chunk[] } }[];
};

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');
const HOSTLIKE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function hostOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try { return new URL(url).hostname; } catch { return null; }
}

/**
 * The hosts of the pages the search really found. Assumed response shape (not yet checked against a live call):
 * candidates[0].groundingMetadata.groundingChunks[].web = { uri, title }. `uri` is often a redirect link on a Google host and
 * `title` is usually the site's domain, so a chunk counts for its `title` when that looks like a hostname, and for the host of its
 * `uri` unless that is a Google redirect host. Hosts are compared in lower case without a leading "www.".
 */
function groundedHosts(reply: Reply): Set<string> {
  const hosts = new Set<string>();
  for (const c of reply.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const title = typeof c?.web?.title === 'string' ? c.web.title.trim() : '';
    if (HOSTLIKE.test(title)) hosts.add(bare(title));
    const h = hostOf(c?.web?.uri);
    if (h && !REDIRECT_HOSTS.has(h.toLowerCase())) hosts.add(bare(h));
  }
  return hosts;
}

/** Index just past the balanced {…} or […] that starts at `start`, or -1. Brackets inside strings are ignored. */
function balancedEnd(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** The raw items in the model's text: the first balanced JSON value that is `{items: [...]}` or a list holding objects. Fences and prose around it are ignored. */
function extractItems(s: string): unknown[] | null {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{' && s[i] !== '[') continue;
    const end = balancedEnd(s, i);
    if (end < 0) continue;
    let v: unknown;
    try { v = JSON.parse(s.slice(i, end)); } catch { continue; }
    if (Array.isArray(v) && v.some(x => x && typeof x === 'object')) return v;
    if (v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items)) return (v as { items: unknown[] }).items;
    i = end - 1; // a value that is not the answer (like a "[1]" citation): skip over it
  }
  return null;
}

/** Keeps only sources that are https pages (no credentials) on a host the search found; an https link alone proves nothing. */
function groundedSources(raw: unknown, hosts: Set<string>): { title: string; url: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { title: string; url: string }[] = [];
  for (const s of raw) {
    const url = s && typeof s === 'object' ? (s as { url?: unknown }).url : undefined;
    if (typeof url !== 'string') continue;
    let u: URL;
    if (url.trim().length > 300) continue; // the same limit parseItemInput enforces: drop this source, not the whole item
    try { u = new URL(url.trim()); } catch { continue; }
    if (u.protocol !== 'https:' || u.username || u.password || !hosts.has(bare(u.hostname))) continue;
    const t = (s as { title?: unknown }).title;
    out.push({ title: typeof t === 'string' && t.trim().length >= 2 ? t.trim().slice(0, 80) : bare(u.hostname), url: url.trim() });
  }
  return out.slice(0, 4);
}

function toItems(raw: unknown[], hosts: Set<string>): TrendItem[] {
  const items: TrendItem[] = [];
  for (const r of raw) {
    if (items.length >= MAX_ITEMS) break;
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const sources = groundedSources(o.sources, hosts);
    if (!sources.length) continue;
    try {
      const parsed = parseItemInput({ ...o, tags: Array.isArray(o.tags) ? o.tags.slice(0, 6) : o.tags, sources }, 'web');
      items.push({ ...parsed, id: crypto.randomUUID(), show: false });
    } catch { /* an item that fails the same checks as a typed one is dropped */ }
  }
  return items;
}

const fail = (message: string, apiKey: string) => new ApiError(502, message.split(apiKey).join('***'));

const REASON_MAX = 200;
/**
 * Google's own explanation from an error reply (`{ error: { message } }`), as one short line, so the admin can tell a quota limit from a billing
 * or model problem. Empty when the body has none. The key is scrubbed by `fail`, like every other message.
 */
async function googleReason(res: Response): Promise<string> {
  try {
    const message = ((await res.json()) as { error?: { message?: unknown } })?.error?.message;
    const line = typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : '';
    if (!line) return '';
    return ` Google says: ${line.length > REASON_MAX ? `${line.slice(0, REASON_MAX - 1).trimEnd()}…` : line}`;
  } catch { return ''; } // not JSON, or unreadable: say nothing extra
}

/**
 * Asks Gemini, with Google Search on, for current trends and returns them hidden (`show: false`) with origin `web`.
 * Plain fetch, no SDK; the key travels in the x-goog-api-key header only and never appears in an error message.
 * Throws ApiError(502) with a plain message when Gemini refuses, is out of quota, does not answer within 90 seconds or replies with nothing readable.
 */
export async function researchTrends(cfg: GeminiConfig, now: Date = new Date()): Promise<{ items: TrendItem[]; model: string }> {
  const { apiKey, model } = cfg;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let reply: Reply;
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt({ region: cfg.region, now }) }] }],
        tools: [{ google_search: {} }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const reason = await googleReason(res);
      if (res.status === 400 || res.status === 401 || res.status === 403) throw fail(`Gemini refused the key. Check the key and model in Settings.${reason}`, apiKey);
      if (res.status === 429) throw fail(`Gemini quota reached. Try again later.${reason}`, apiKey);
      throw fail(`Gemini is not answering. Try again in a few minutes.${reason}`, apiKey);
    }
    reply = (await res.json()) as Reply;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw fail('Gemini is not answering. Try again in a few minutes.', apiKey); // network error, timeout or unreadable body: nothing from it is shown
  } finally {
    clearTimeout(timer);
  }
  const text = (reply.candidates?.[0]?.content?.parts ?? []).map(p => (p && p.thought !== true && typeof p.text === 'string' ? p.text : '')).join('');
  const raw = extractItems(text);
  if (!raw) throw fail('Gemini answered, but not in a form we could read. Try again.', apiKey);
  return { items: toItems(raw, groundedHosts(reply)), model };
}
