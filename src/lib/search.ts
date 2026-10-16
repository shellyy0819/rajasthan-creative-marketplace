import { ilike, or, sql, type SQL } from 'drizzle-orm';

/** Escape LIKE metacharacters so user text is matched literally (backslash is Postgres' default LIKE escape). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

const MAX_QUERY = 100;
/** A query needs a word of at least this many letters to go fuzzy; shorter words match as plain substrings only. */
export const FUZZY_MIN_WORD = 4;
/** pg_trgm word_similarity score (0..1) needed for a typo-tolerant match. Lower = more forgiving. */
export const FUZZY_THRESHOLD = 0.45;

/** Trim, collapse whitespace, cap the length. Empty string means "no search". */
export const normalizeQuery = (q: string | undefined) => (q ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY);

export type TextSearch = { where?: SQL; rank?: SQL };

/**
 * Typo-tolerant free-text search over a document expression (several columns joined by spaces).
 *  - a literal, case-insensitive substring match always counts (LIKE wildcards are escaped);
 *  - for queries with a word of 4+ letters, a pg_trgm word_similarity match also counts, so "crochat" finds "Crochet";
 *  - rank is 1 for substring matches and the similarity (< 1) for fuzzy-only matches: order by it DESC.
 * Needs the pg_trgm extension (migration 0005).
 */
export function textSearch(doc: SQL, q: string | undefined): TextSearch {
  const needle = normalizeQuery(q);
  if (!needle) return {};
  const substring = ilike(doc, `%${escapeLike(needle)}%`);
  // Trigrams ignore punctuation and digits, and a 3-letter word shares most of its trigrams with every word that starts
  // the same way ("pot" vs "pond"), so require a real word of 4+ letters before going fuzzy.
  if (!new RegExp(`\\p{L}{${FUZZY_MIN_WORD},}`, 'u').test(needle)) return { where: substring };
  const lowered = needle.toLowerCase();
  const score = sql`word_similarity(${lowered}::text, lower(${doc}))`;
  return {
    where: or(substring, sql`${score} >= ${FUZZY_THRESHOLD}`),
    rank: sql`case when ${substring} then 1.0 else ${score} end`,
  };
}
