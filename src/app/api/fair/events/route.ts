import { clientIp, isBot } from '@/lib/actors';
import { handle, json, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { parseEvents, recordEvents } from '@/lib/fair-events';
import { eventCodeLimiter, eventIpLimiter } from '@/lib/fair-limits';
import { requireFairOpen } from '@/lib/fair-settings';
export const dynamic = 'force-dynamic';

/** What a player did at the exhibition (stalls opened, items shortlisted, activities, quests), in small batches from the browser. No sign-in; the visitor must own the code they send it under. */
export const POST = (req: Request) => handle(async () => {
  if (isBot(req.headers.get('user-agent'))) throw new ApiError(403, 'Not available.');
  await requireFairOpen();
  if (!eventIpLimiter.hit(clientIp(req.headers))) throw new ApiError(429, 'Too many requests. Please try again shortly.');
  const e = parseEvents(await readJson(req));
  if (!eventCodeLimiter.hit(e.code)) throw new ApiError(429, 'Too many requests. Please try again shortly.');
  return json(await recordEvents(e), 200, { 'cache-control': 'no-store' });
});
