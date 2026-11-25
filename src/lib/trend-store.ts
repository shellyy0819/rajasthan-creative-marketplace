import { randomUUID } from 'node:crypto';
import { desc, eq, ne, and, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { trendDigests, type TrendDigestRow } from '../db/schema';
import { ApiError } from './errors';
import { parseItemInput, TREND_KINDS, type TrendItem, type TrendKind, type TrendOrigin } from './trend-types';
import { bad } from './validate';

export type Digest = {
  id: string; createdAt: Date; createdBy: string; model: string; status: 'ok' | 'empty' | 'failed'; error: string | null;
  items: TrendItem[]; publishedAt: Date | null; publishedBy: string | null;
};
export type DigestSummary = Omit<Digest, 'items'> & { itemCount: number; shownCount: number };
export type ItemPatch = { show?: boolean; kind?: TrendKind } & Partial<Pick<TrendItem, 'title' | 'why' | 'category' | 'tags' | 'sources'>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new ApiError(404, 'Digest not found.');
const locked = () => new ApiError(409, 'Unpublish it first.');

const toDigest = (r: TrendDigestRow): Digest => ({
  id: r.id, createdAt: r.createdAt, createdBy: r.createdBy, model: r.model, status: r.status as Digest['status'], error: r.error,
  items: r.items, publishedAt: r.publishedAt, publishedBy: r.publishedBy,
});

export async function createDigest(i: { createdBy: string; model: string; status: Digest['status']; error?: string; items: TrendItem[] }): Promise<Digest> {
  const [row] = await getDb().insert(trendDigests).values({ createdBy: i.createdBy, model: i.model, status: i.status, error: i.error ?? null, items: i.items }).returning();
  return toDigest(row);
}

/** Every digest, newest first, without the items: how many there are and how many are shown. */
export async function listDigests(): Promise<DigestSummary[]> {
  const rows = await getDb().select({
    id: trendDigests.id, createdAt: trendDigests.createdAt, createdBy: trendDigests.createdBy, model: trendDigests.model, status: trendDigests.status,
    error: trendDigests.error, publishedAt: trendDigests.publishedAt, publishedBy: trendDigests.publishedBy,
    itemCount: sql<number>`jsonb_array_length(${trendDigests.items})::int`,
    shownCount: sql<number>`(select count(*)::int from jsonb_array_elements(${trendDigests.items}) e where e->>'show' = 'true')`,
  }).from(trendDigests).orderBy(desc(trendDigests.createdAt), desc(trendDigests.id));
  return rows.map(r => ({ ...r, status: r.status as Digest['status'] }));
}

/** One digest, or null when it does not exist. An id that is not a uuid is null without asking the database. */
export async function getDigest(id: string): Promise<Digest | null> {
  if (!UUID_RE.test(id)) return null;
  const [row] = await getDb().select().from(trendDigests).where(eq(trendDigests.id, id));
  return row ? toDigest(row) : null;
}

export async function getPublishedDigest(): Promise<Digest | null> {
  const [row] = await getDb().select().from(trendDigests).where(isNotNull(trendDigests.publishedAt));
  return row ? toDigest(row) : null;
}

/** Runs `change` on the items of an unpublished digest while holding its row, so two edits together cannot lose each other's change. */
async function editItems(digestId: string, change: (items: TrendItem[]) => TrendItem[]): Promise<Digest> {
  if (!UUID_RE.test(digestId)) throw notFound();
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(trendDigests).where(eq(trendDigests.id, digestId)).for('update');
    if (!row) throw notFound();
    if (row.publishedAt) throw locked();
    const [saved] = await tx.update(trendDigests).set({ items: change(row.items) }).where(eq(trendDigests.id, digestId)).returning();
    return toDigest(saved);
  });
}

export async function patchItem(digestId: string, itemId: string, patch: ItemPatch): Promise<Digest> {
  return editItems(digestId, items => {
    const at = items.findIndex(i => i.id === itemId);
    if (at < 0) throw new ApiError(404, 'Item not found.');
    const cur = items[at];
    if (patch.show !== undefined && typeof patch.show !== 'boolean') throw bad('show must be true or false.');
    if (patch.kind !== undefined && !(TREND_KINDS as readonly string[]).includes(patch.kind)) throw bad(`kind must be one of ${TREND_KINDS.join(', ')}.`);
    // The merged item goes through the same checks as a new one, so an edit can never store what an add would refuse.
    const checked = parseItemInput({
      kind: patch.kind ?? cur.kind, title: patch.title ?? cur.title, why: patch.why ?? cur.why,
      category: patch.category !== undefined ? patch.category : cur.category, tags: patch.tags ?? cur.tags, sources: patch.sources ?? cur.sources,
    }, cur.origin);
    const next = [...items];
    next[at] = { ...checked, id: cur.id, show: patch.show ?? cur.show };
    return next;
  });
}

/** Adds an item typed by an admin. It starts hidden, so it only reaches the public after the admin ticks it. */
export async function addItem(digestId: string, input: unknown, origin: Extract<TrendOrigin, 'pinterest' | 'manual'>): Promise<Digest> {
  const checked = parseItemInput(input, origin);
  return editItems(digestId, items => [...items, { ...checked, id: randomUUID(), show: false }]);
}

const isUniqueViolation = (e: unknown): boolean => {
  for (let cur: unknown = e, depth = 0; cur && typeof cur === 'object' && depth < 4; cur = (cur as { cause?: unknown }).cause, depth++)
    if ((cur as { code?: unknown }).code === '23505') return true;
  return false;
};

/** Makes this digest the published one and clears the previous one, in one transaction. */
export async function publishDigest(id: string, actorEmail: string): Promise<Digest> {
  if (!UUID_RE.test(id)) throw notFound();
  try {
    return await getDb().transaction(async tx => {
      const [row] = await tx.select().from(trendDigests).where(eq(trendDigests.id, id)).for('update');
      if (!row) throw notFound();
      if (row.status !== 'ok') throw bad('Only a digest with results can be published.');
      if (!row.items.some(i => i.show)) throw bad('Show at least one item before publishing.');
      if (row.publishedAt) return toDigest(row);
      await tx.update(trendDigests).set({ publishedAt: null, publishedBy: null }).where(and(ne(trendDigests.id, id), isNotNull(trendDigests.publishedAt)));
      const [saved] = await tx.update(trendDigests).set({ publishedAt: new Date(), publishedBy: actorEmail }).where(eq(trendDigests.id, id)).returning();
      return toDigest(saved);
    });
  } catch (e) {
    // The unique index lets one published row through: a second publish at the same moment loses here.
    if (isUniqueViolation(e)) throw new ApiError(409, 'Another digest was published at the same moment. Try again.');
    throw e;
  }
}

export async function unpublishDigest(id: string): Promise<Digest> {
  if (!UUID_RE.test(id)) throw notFound();
  const [row] = await getDb().update(trendDigests).set({ publishedAt: null, publishedBy: null }).where(eq(trendDigests.id, id)).returning();
  if (!row) throw notFound();
  return toDigest(row);
}
