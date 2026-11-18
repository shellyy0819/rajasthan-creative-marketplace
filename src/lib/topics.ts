import { asc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { workshopTopics } from '../db/schema';

export type TopicOption = { id: number; name: string };

/** Topics a host can pick in the form, in the order the admin set. */
export async function listActiveTopics(): Promise<TopicOption[]> {
  const rows = await getDb().select({ id: workshopTopics.id, name: workshopTopics.name, active: workshopTopics.active }).from(workshopTopics)
    .orderBy(asc(workshopTopics.position), asc(workshopTopics.id));
  return rows.filter(r => r.active).map(({ id, name }) => ({ id, name }));
}
