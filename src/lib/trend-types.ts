import { bad, obj, oneOf, optionalText, text, type Raw } from './validate';

export const TREND_KINDS = ['craft', 'art', 'workshop'] as const;
export type TrendKind = (typeof TREND_KINDS)[number];
export const TREND_ORIGINS = ['web', 'pinterest', 'manual'] as const;
export type TrendOrigin = (typeof TREND_ORIGINS)[number];

/** The longest link a source may have. The news step drops longer links, so a headline shown to the model can always be cited. */
export const MAX_SOURCE_URL = 300;

export type TrendSource = { title: string; url?: string };
export type TrendItem = {
  id: string;
  kind: TrendKind;
  title: string;
  why: string;
  category?: string;
  tags: string[];
  origin: TrendOrigin;
  sources: TrendSource[];
  show: boolean;
};

function sourceUrl(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const msg = `source url must be an https link up to ${MAX_SOURCE_URL} characters.`;
  if (typeof v !== 'string' || v.trim().length > MAX_SOURCE_URL) throw bad(msg);
  let u: URL;
  try { u = new URL(v.trim()); } catch { throw bad(msg); }
  if (u.protocol !== 'https:' || u.username || u.password) throw bad(msg);
  return u.toString();
}

function parseSource(input: unknown): TrendSource {
  const s: Raw = obj(input);
  const title = text(s.title, 'source title', 80);
  if (title.length < 2) throw bad('source title must be 2 to 80 characters.');
  const url = sourceUrl(s.url);
  return url ? { title, url } : { title };
}

/** Checks one item typed by an admin (or one coming back from research) and returns it cleaned. Text is kept as typed, it is escaped when shown. */
export function parseItemInput(input: unknown, origin: TrendOrigin): Omit<TrendItem, 'id' | 'show'> {
  const b = obj(input);
  const kind = oneOf(b.kind, 'kind', TREND_KINDS);
  const title = text(b.title, 'title', 120);
  if (title.length < 3) throw bad('title must be 3 to 120 characters.');
  const why = text(b.why, 'why', 400);
  if (why.length < 10) throw bad('why must be 10 to 400 characters.');
  const category = optionalText(b.category, 'category', 60);
  const rawTags = b.tags === undefined || b.tags === null ? [] : b.tags;
  if (!Array.isArray(rawTags) || rawTags.length > 6) throw bad('tags must be a list of up to 6 tags.');
  const tags = rawTags.map(t => text(t, 'tag', 30));
  if (!Array.isArray(b.sources) || b.sources.length < 1 || b.sources.length > 4) throw bad('sources must list 1 to 4 sources.');
  const sources = b.sources.map(parseSource);
  return { kind, title, why, ...(category ? { category } : {}), tags, origin, sources };
}

/** Heading of the crafts and art block, from the kinds of the shown items. Null when there is nothing for the block. */
export function trendBlockHeading(kinds: TrendKind[]): string | null {
  const craft = kinds.includes('craft');
  const art = kinds.includes('art');
  if (craft && art) return 'Arts and crafts to look at';
  if (craft) return 'Crafts to look at';
  if (art) return 'Art to look at';
  return null;
}

/** The credit line under the block, from where the shown items came from. */
export function trendSourceLine(origins: TrendOrigin[]): string {
  const parts: string[] = [];
  if (origins.includes('web')) parts.push('Google News');
  if (origins.includes('pinterest')) parts.push('Pinterest');
  if (origins.includes('manual')) parts.push('our own research');
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? 'our own research';
  return `Gathered from ${list}, then picked by our team.`;
}
