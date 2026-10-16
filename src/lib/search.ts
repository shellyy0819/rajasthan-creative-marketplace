import { ilike, sql, type SQL } from 'drizzle-orm';

/** Escape LIKE metacharacters so user text is matched literally (backslash is Postgres' default LIKE escape). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

/** Where-clause for free-text search over a document expression. undefined when there is nothing to search for. */
export function textMatch(doc: SQL, q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  return ilike(doc, `%${escapeLike(q)}%`);
}
