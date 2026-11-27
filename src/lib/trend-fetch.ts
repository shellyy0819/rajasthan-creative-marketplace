import { ApiError } from './errors';
import { researchTrends } from './trend-research';
import { resolveGeminiConfig } from './trend-settings';
import { createDigest, listDigests, type Digest } from './trend-store';

/** The shortest time between two fetches, measured from the newest digest of any status. */
export const MIN_GAP_SECONDS = 60;

// One fetch at a time per server process. Set before the first await and cleared in `finally`.
let running = false;

/**
 * One manual fetch for an admin: reads recent news headlines, has Gemini group them into trends, and stores the result as an
 * unpublished draft (`ok` with items, `empty` with none). When the research fails, a `failed` draft
 * keeps the message and the same error is thrown again.
 */
export async function runTrendFetch(actorEmail: string, now: Date = new Date()): Promise<Digest> {
  if (running) throw new ApiError(409, 'A fetch is already running.');
  running = true;
  try {
    const cfg = await resolveGeminiConfig();
    if (!cfg) throw new ApiError(400, 'Add the Gemini key in Settings first.');

    const [newest] = await listDigests();
    if (newest) {
      const wait = Math.ceil(MIN_GAP_SECONDS - (now.getTime() - newest.createdAt.getTime()) / 1000);
      if (wait > 0) throw new ApiError(429, `Wait ${wait} seconds before fetching again.`);
    }

    let result: Awaited<ReturnType<typeof researchTrends>>;
    try {
      result = await researchTrends(cfg, now);
    } catch (e) {
      // Only the message is kept: researchTrends already keeps the key out of it.
      const error = e instanceof ApiError ? e.message : 'The research failed.';
      try {
        await createDigest({ createdBy: actorEmail, model: cfg.model, status: 'failed', error, items: [] });
      } catch { /* the research error below is the one the admin needs to see */ }
      throw e;
    }
    return await createDigest({
      createdBy: actorEmail, model: result.model, status: result.items.length ? 'ok' : 'empty',
      items: result.items.map(i => ({ ...i, show: false })),
    });
  } finally {
    running = false;
  }
}
