import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { workshopTopics } from '../db/schema';
import { ApiError } from './errors';
import { checkCategoryName } from './category-name';
import { bad, obj } from './validate';

export type TopicOption = { id: number; name: string };
export type Topic = { id: number; slug: string; name: string; parentId: number | null; active: boolean };
export type AdminTopic = Topic & { listingCount: number };

/** Topics a host can pick in the form, in the order the admin set. */
export async function listActiveTopics(): Promise<TopicOption[]> {
  const rows = await getDb().select({ id: workshopTopics.id, name: workshopTopics.name, active: workshopTopics.active }).from(workshopTopics)
    .orderBy(asc(workshopTopics.position), asc(workshopTopics.id));
  return rows.filter(r => r.active).map(({ id, name }) => ({ id, name }));
}

/** Every topic with how many listings use it, for the dashboard. */
export async function listTopics(): Promise<AdminTopic[]> {
  const rows = await getDb().select({
    id: workshopTopics.id, slug: workshopTopics.slug, name: workshopTopics.name, parentId: workshopTopics.parentId, active: workshopTopics.active,
    listingCount: sql<number>`(select count(*)::int from workshops w where w.topic_id = workshop_topics.id)`,
  }).from(workshopTopics).orderBy(asc(workshopTopics.position), asc(workshopTopics.id));
  return rows;
}

/** "Yoga & Wellness" becomes "yoga-and-wellness": lower case, accents folded, anything else a single dash. */
function slugBase(name: string): string {
  const s = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'topic';
}

export async function createTopic(input: unknown): Promise<Topic> {
  const checked = checkCategoryName(obj(input).name);
  if (!checked.ok) throw bad(checked.error);
  return getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rr_workshop_topics'))`);
    const existing = await tx.select({ name: workshopTopics.name, slug: workshopTopics.slug, position: workshopTopics.position }).from(workshopTopics);
    if (existing.some(t => t.name.toLowerCase() === checked.name.toLowerCase())) throw new ApiError(409, 'A topic with that name already exists.');
    const base = slugBase(checked.name);
    const taken = new Set(existing.map(t => t.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const position = existing.reduce((m, t) => Math.max(m, t.position), 0) + 1;
    const [row] = await tx.insert(workshopTopics).values({ slug, name: checked.name, position }).returning();
    return { id: row.id, slug: row.slug, name: row.name, parentId: row.parentId, active: row.active };
  });
}

export async function setTopicActive(id: number, active: boolean): Promise<Topic> {
  const [row] = await getDb().update(workshopTopics).set({ active }).where(eq(workshopTopics.id, id)).returning();
  if (!row) throw new ApiError(404, 'Topic not found.');
  return { id: row.id, slug: row.slug, name: row.name, parentId: row.parentId, active: row.active };
}
