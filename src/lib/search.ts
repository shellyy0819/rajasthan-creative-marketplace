import { ilike, or, sql, type SQL } from 'drizzle-orm';

/** Escape LIKE metacharacters so user text is matched literally (backslash is Postgres' default LIKE escape). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

const MAX_QUERY = 100;
/** Queries shorter than this are plain substring matches: trigrams need at least a few letters. */
export const FUZZY_MIN_LENGTH = 3;
/** pg_trgm word_similarity score (0..1) needed for a typo-tolerant match. Lower = more forgiving. */
export const FUZZY_THRESHOLD = 0.35;

/** Trim, collapse whitespace, cap the length. Empty string means "no search". */
export const normalizeQuery = (q: string | undefined) => (q ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);

export type TextSearch = { where?: SQL; rank?: SQL };

/**
 * Typo-tolerant free-text search over a document expression (several columns joined by spaces).
 *  - a literal, case-insensitive substring match always counts (LIKE wildcards are escaped);
 *  - for queries with a word of 3+ letters, a pg_trgm word_similarity match also counts, so "crochat" finds "Crochet";
 *  - rank is 1 for substring matches and the similarity (< 1) for fuzzy-only matches: order by it DESC.
 * Needs the pg_trgm extension (migration 0005).
 */
export function textSearch(doc: SQL, q: string | undefined): TextSearch {
  const needle = normalizeQuery(q);
  if (!needle) return {};
  const substring = ilike(doc, `%${escapeLike(needle)}%`);
  // Trigrams ignore punctuation and digits, so require a real word (3+ letters) before going fuzzy; otherwise a query
  // like "' or '1'='1" would be matched on its two-letter word alone.
  if (needle.length < FUZZY_MIN_LENGTH || !/\p{L}{3,}/u.test(needle)) return { where: substring };
  const lowered = needle.toLowerCase();
  const score = sql`word_similarity(${lowered}::text, lower(${doc}))`;
  return {
    where: or(substring, sql`${score} >= ${FUZZY_THRESHOLD}`),
    rank: sql`case when ${substring} then 1.0 else ${score} end`,
  };
}
