import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { workshops } from '../db/schema';
import { countProducts } from './catalog';
import { istParts } from './ist';
import { listActiveTopics, type TopicOption } from './topics';
import type { TrendItem } from './trend-types';
import { isCurrent } from './workshop-listing';

export type MatchedItem = TrendItem & { count: number; href: string };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is `name` in `hay` as a whole word (case-insensitive)? Letters, marks and digits on either side rule it out, in any script (\b is ASCII-only). */
function hasWord(hay: string, name: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{M}\\p{N}])`, 'iu').test(hay);
}

/** The active topic whose name appears in the text as a whole word (case-insensitive); the longest name wins. */
function topicIn(text: string, topics: TopicOption[]): TopicOption | null {
  let best: TopicOption | null = null;
  for (const t of topics) {
    const name = t.name.trim();
    if (name && hasWord(text, name) && (!best || name.length > best.name.trim().length)) best = t;
  }
  return best;
}

/** Approved workshops that have not ended, per topic. */
async function currentWorkshopCounts(topicIds: number[], now: Date): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!topicIds.length) return counts;
  const rows = await getDb().select({ topicId: workshops.topicId, startsAt: workshops.startsAt, endsOn: workshops.endsOn, kind: workshops.kind })
    .from(workshops).where(and(eq(workshops.status, 'APPROVED'), inArray(workshops.topicId, topicIds)));
  for (const r of rows) {
    if (r.topicId === null || !isCurrent({ date: istParts(r.startsAt).date, endsOn: r.endsOn, kind: r.kind }, now)) continue;
    counts.set(r.topicId, (counts.get(r.topicId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Says how much of what each trend names we already have. A workshop item is matched to one of the active workshop topics (named in its title or tags)
 * and counts that topic's current workshops. A craft or art item tries its category and each tag as a shop search and keeps the term with the most products.
 */
export async function matchItems(items: TrendItem[], now: Date = new Date()): Promise<MatchedItem[]> {
  const topics = items.some(i => i.kind === 'workshop') ? await listActiveTopics() : [];
  const topicOf = new Map<string, TopicOption | null>();
  for (const i of items) if (i.kind === 'workshop') topicOf.set(i.id, topicIn([i.title, ...i.tags].join('\n'), topics));
  const counts = await currentWorkshopCounts([...new Set([...topicOf.values()].flatMap(t => (t ? [t.id] : [])))], now);

  const shop = new Map<string, Promise<number>>();
  const productCount = (q: string) => {
    const key = q.toLowerCase();
    if (!shop.has(key)) shop.set(key, countProducts({ q }));
    return shop.get(key)!;
  };

  return Promise.all(items.map(async (i): Promise<MatchedItem> => {
    if (i.kind === 'workshop') {
      const t = topicOf.get(i.id);
      return t ? { ...i, count: counts.get(t.id) ?? 0, href: `/workshops?q=${encodeURIComponent(t.name)}` } : { ...i, count: 0, href: '/workshops' };
    }
    const terms = [...new Set([i.category, ...i.tags].map(t => (t ?? '').trim()).filter(Boolean))];
    const found = await Promise.all(terms.map(async term => ({ term, n: await productCount(term) })));
    const best = found.reduce<{ term: string; n: number } | null>((b, f) => (f.n > (b?.n ?? 0) ? f : b), null);
    return best ? { ...i, count: best.n, href: `/shop?q=${encodeURIComponent(best.term)}` } : { ...i, count: 0, href: '/shop' };
  }));
}
